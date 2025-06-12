<template>
  <div class="h-screen flex-col gap-2 flex items-center justify-center">
    <ClientOnly>
      <WalletMultiButton />
    </ClientOnly>
    <UButton v-if="connected" @click="onClickSignMessage">Sign message</UButton>
    <template v-if="user">
      <UCollapsible :unmount-on-hide="false" class="flex flex-col gap-2 w-1/2">
          <UButton
            label="User Info"
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-chevron-down"
            block
          />

          <template #content>
            <pre >{{ user }}</pre>
          </template>
        </UCollapsible>
    </template>
    <div class="w-xl gap-4 flex flex-col">
      <UButton v-if="token && !ws" @click="connectionWS">Connect main websocket to view all event</UButton>
      <UButton v-if="token && wsConnected" @click="disconnect">Disconnect websocket</UButton>
      <div class="flex gap-2">
        <USelectMenu
          v-model="itemSelected"
          :items="items"
          placeholder="Select Item"
          class="w-full"
          size="md"
          :ui="{
            item: 'h-[48px] p-1 gap-4 items-center',
            itemLeading: 'gap-4',
            // itemLeadingIcon: 'size-8',
            itemTrailing: '',
          }"
        >
          <template #item-leading="{ item }">
            <span class="size-5 text-center">
              <UAvatar
                :src="item.avatar.src"
                size="sm"
              />
            </span>
          </template>
        </USelectMenu>
        <UButton class="shrink-0" @click="onClickBuyItem">Buy Item</UButton>
      </div>
    </div>
    <div class="w-full p-2 flex-wrap flex gap-4">
      <UCard v-for="i in packages" :key="i._id" class="w-[calc(16.6vw-16px)]" :ui="{ root: 'p-2!', header: 'p-2!', body: 'p-2!', footer: 'p-2!' }">
        <template #header>
          {{ i.name }}
        </template>
        <template #footer>
          <UButton @click="onClickSelectPackage(i)">Buy with {{ i.price }} {{ i.currency }}</UButton>
        </template>
      </UCard>
    </div>
    <UModal
      v-model:open="open"
      title="Purchase Package"
      :description="`Package: ${selectedPackage?.name}`"
      :ui="{ footer: 'justify-end', content: 'max-w-5xl' }"
    >
      <template #body>
        <UCollapsible :unmount-on-hide="false" class="flex flex-col gap-2 w-full">
          <UButton
            label="Reward Info"
            color="neutral"
            variant="subtle"
            trailing-icon="i-lucide-chevron-down"
            block
          />

          <template #content>
            <pre>
            {{ selectedPackage?.rewards }}
          </pre>
          </template>
        </UCollapsible>
        
        <UInputNumber v-model="quantity" :min="1" :max="selectedPackage.maxPerTime || 1" />
      </template>

      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="oncancel" />
        <UButton :label="`Purchase with ${quantity * selectedPackage.price} ${selectedPackage.currency}`" :loading="loading" color="neutral" @click="onClickRequestPurchasePackage" />
      </template>
    </UModal>
  </div>
</template>

<script setup>
import { WalletMultiButton, useWallet } from 'solana-wallets-vue'
import { createMemoInstruction } from '@solana/spl-memo'
import { Connection, clusterApiUrl, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'

const toast = useToast()
const { connected, publicKey, wallet, sendTransaction } = useWallet()
const user = ref()
const token = ref('')
const open = ref(false)
const loading = ref(false)
const ws = ref()
const quantity = ref(1)
const selectedPackage = ref()
const packages = ref([])
const config = ref()
const wsConnected = ref(false)

const items = ref([])
const itemSelected = ref()

watch(() => open, (val) => {
  if (!val) selectedPackage.value = undefined
})

onMounted(() => {
  getMasterData()
  token.value = localStorage.getItem('token')
  if (token.value) {
    getData(token.value)
    getItems(token.value)
  }
})

const getMasterData = () => {
  $fetch(`${useRuntimeConfig().public.baseUrl}/masterdata`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .then((data) => {
      config.value = data
    })
}

const oncancel = () => {
  open.value = false
}

const onClickBuyItem = () => {
  if (!itemSelected.value) return
  $fetch(`${useRuntimeConfig().public.baseUrl}/items/buy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        itemId: itemSelected.value.value,
        quantity: 1, // or any value > 0
      })
    })
      .then(async ({ data }) => {
        processPayment(data)
          .then((data1) => {
            console.log(data1)
          })
          .finally(() => {
            loading.value = false
          })
      })
      .catch((error) => {
        toast.add({
          title: 'Error',
          description: `${error.data.message}`,
        })
        loading.value = false
      })
}

const connectionWS = () => {
  ws.value = new WebSocket(`${useRuntimeConfig().public.wsUrl}/ws?token=${token.value}`)
    ws.value.onopen = () => {
    wsConnected.value = true
  }
  ws.value.onmessage = (event) => {
    getData()
    const data = JSON.parse(event.data)
    console.log('Nhận tin nhắn từ server:', data)
    if (Array.isArray(data.message)) {
      data.message.forEach((item) => {
        toast.add({
          title: data.type,
          color: data.type === 'error' ? 'error' : 'primary',
          description: typeof item === 'string' ? item : JSON.stringify(item),
        })
      })
    } else {
      toast.add({
        title: data.type,
        color: data.type === 'error' ? 'error' : 'primary',
        description: data.message,
      })
    }
  }
}

const disconnect = () => {
  ws.value.close()
  ws.value = null
  wsConnected.value = false
}

const onClickSelectPackage = (pkg) => {
  selectedPackage.value = pkg
  open.value = true
}

const processPayment = async (data) => {
  const connection = new Connection(clusterApiUrl('devnet'))
  if (!publicKey.value) return
  
  const memoInstruction = createMemoInstruction(data.transaction.transactionId, [publicKey.value])
  const blockhash = await connection.getLatestBlockhash()
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey.value,
      toPubkey: config.value?.settings?.wallet || 'Aho4P8t2smbr8GoQV5szmDkhpsVsJth4uVBvYRVUw6V6',
      lamports: data.transaction.amount * LAMPORTS_PER_SOL,
    })
  ).add(memoInstruction)

  transaction.feePayer = publicKey.value
  transaction.recentBlockhash = blockhash.blockhash
  const controller = new AbortController()
  const { signal } = controller

  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction({
    blockhash,
    signature,
    abortSignal: signal,
  }, 'confirmed');
}

const onClickRequestPurchasePackage = () => {
  loading.value = true
  $fetch(`${useRuntimeConfig().public.baseUrl}/shop/create-transaction`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        packageId: selectedPackage.value._id,
        quantity: quantity.value,
      })
    })
      .then(async ({ data }) => {
        if (selectedPackage.value.currency === 'sol') {
          processPayment(data)
            .then((data1) => {
              console.log(data1)
            })
            .finally(() => {
              loading.value = false
            })
        } else {
          loading.value = false
        }
      })
      .catch((error) => {
        toast.add({
          title: 'Error',
          description: `${error.data.message}`,
        })
        loading.value = false
      })
}

const onClickSignMessage = () => {
  $fetch(
    `${useRuntimeConfig().public.baseUrl}/authentication/create-message`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        address: publicKey.value
      })
    }
  ).then(async ({ data }) => {
    let output = await wallet.value.adapter.signIn(data.signInInput);
    output = {
      account: {
        address: output.account.address,
        chains: output.account.chains,
        features: output.account.features,
        icon: output.account.icon,
        label: output.account.label,
        publicKey: Object.values(output.account.publicKey)
      },
      signature: Array.from(output.signature),
      signedMessage: Array.from(output.signedMessage)
    };
    console.log(data.signInInput);
    console.log(output);
    const _ = $fetch(
      `${useRuntimeConfig().public.baseUrl}/authentication/verify-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ input: data.signInInput, output })
      }
    )
      .then(({ data }) => {
        localStorage.setItem('token', data.accessToken);
        token.value = data.accessToken;
        getData(data.accessToken);
      })
  })

}

const getData = async (token) => {
  $fetch(`${useRuntimeConfig().public.baseUrl}/user/info`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then((data) => {
        user.value = data.data
        $fetch(`${useRuntimeConfig().public.baseUrl}/shop`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
          .then((data) => {
            packages.value = data.data
          })
          .catch(() => {
            token.value = ''
            localStorage.setItem('token', '')
          })
      })
}

const getItems = async (token) => {
  $fetch(`${useRuntimeConfig().public.baseUrl}/items?limit=200`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then((data) => {
        items.value = data.data.results.map(item => {
          return {
            id: item._id,
            label: item.name,
            value: item._id,
            avatar: {
              src: `${useRuntimeConfig().public.baseUrl}/media/${item.slug}.png`,
              alt: item.slug,
            }
          }
        })
      })
}
</script>
