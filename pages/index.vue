<template>
  <div class="h-screen flex-col gap-2 flex items-center justify-center">
    <ClientOnly>
      <WalletMultiButton />
    </ClientOnly>
    <UButton v-if="connected" @click="onClickSignMessage">Sign message</UButton>
  </div>
</template>

<script setup>
import { WalletMultiButton } from 'solana-wallets-vue';
import { useWallet } from 'solana-wallets-vue';

const { connected, publicKey, wallet } = useWallet();

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
      ...output,
      account: {
      address: output.account.address,
      chains: output.account.chains,
      features: output.account.features,
      icon: output.account.icon,
      label: output.account.label,
      publicKey: output.account.publicKey
    }
    };
    let strPayload = JSON.stringify({ input: data.signInInput, output });
    const _ = await $fetch(
      `${useRuntimeConfig().public.baseUrl}/authentication/verify-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: strPayload
        })
      }
    )
  })

}
</script>
