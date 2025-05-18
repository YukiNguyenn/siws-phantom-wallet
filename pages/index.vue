<template>
  <div class="h-screen flex-col gap-2 flex items-center justify-center">
    <ClientOnly>
      <WalletMultiButton />
    </ClientOnly>
    <UButton v-if="connected" @click="onClickSignMessage">Sign message</UButton>
    <template v-if="user">
      <UCard>
        <pre >{{ user }}</pre>
      </UCard>
    </template>
    <UButton v-if="token && !ws" @click="connectionWS">Connect webwocket</UButton>
    <UButton v-if="token && wsConnected" @click="disconnect">Disconnect webwocket</UButton>
  </div>
</template>

<script setup>
import { WalletMultiButton } from 'solana-wallets-vue';
import { useWallet } from 'solana-wallets-vue';

const toast = useToast();
const { connected, publicKey, wallet } = useWallet();
const user = ref();
const token = ref('');
const ws = ref();
const wsConnected = ref(false);

onMounted(() => {
  token.value = localStorage.getItem('token');
});

const connectionWS = () => {
  ws.value = new WebSocket(`${useRuntimeConfig().public.wsUrl}/ws?token=${token.value}`);
    ws.value.onopen = () => {
    wsConnected.value = true;
  };
  ws.value.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Nhận tin nhắn từ server:', data);
    if (Array.isArray(data.message)) {
      data.message.forEach((item) => {
        toast.add({
          title: data.type,
          color: data.type === 'error' ? 'error' : 'primary',
          description: typeof item === 'string' ? item : JSON.stringify(item),
        });
      });
    } else {
      toast.add({
        title: data.type,
        color: data.type === 'error' ? 'error' : 'primary',
        description: data.message,
      });
    }
  };
}

const disconnect = () => {
  ws.value.close();
  ws.value = null;
  wsConnected.value = false;
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
        $fetch(`${useRuntimeConfig().public.baseUrl}/user/info`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.accessToken}`
          }
        })
          .then((data) => {
            user.value = data.data
          })
      })
  })

}
</script>
