<template>
	<ModrinthAccountRequiredModal ref="accountRequiredModal" :request-auth="requestAuth" />
	<SharedInstanceInstallModal ref="installModal" />
	<SharedInstanceAlreadyInstalledModal
		ref="alreadyInstalledModal"
		@cancel="handleAlreadyInstalledCancel"
		@go-to-instance="handleAlreadyInstalledGoToInstance"
		@install-anyway="handleAlreadyInstalledInstallAnyway"
	/>
</template>

<script setup lang="ts">
// @ts-nocheck
import { injectAuth } from '@modrinth/ui'
import { nextTick, ref } from 'vue'

import ModrinthAccountRequiredModal from '@launcher/components/ui/modal/ModrinthAccountRequiredModal.vue'
import SharedInstanceInstallModal from '@launcher/components/ui/shared-instances/shared-instance-install-modal/index.vue'
import SharedInstanceAlreadyInstalledModal from '@launcher/components/ui/shared-instances/SharedInstanceAlreadyInstalledModal.vue'
import type { ModrinthAuthFlow } from '@launcher/helpers/mr_auth'

import type { SharedInstanceInviteHandler } from './shared-instance-invite-types'
import { useSharedInstanceInviteHandler } from './use-shared-instance-invite-handler'

const auth = injectAuth()
const installModal = ref<InstanceType<typeof SharedInstanceInstallModal>>()
const alreadyInstalledModal = ref<InstanceType<typeof SharedInstanceAlreadyInstalledModal>>()
const accountRequiredModal = ref<InstanceType<typeof ModrinthAccountRequiredModal>>()
const {
	handleNotification,
	installFromInviteId,
	clearNotifications,
	handleAlreadyInstalledCancel,
	handleAlreadyInstalledGoToInstance,
	handleAlreadyInstalledInstallAnyway,
} = useSharedInstanceInviteHandler(installModal, alreadyInstalledModal, accountRequiredModal)

async function requestAuth(flow: ModrinthAuthFlow) {
	await auth.requestSignIn('', flow, { showModal: false })
	await nextTick()
	return !!auth.session_token.value
}

defineExpose<SharedInstanceInviteHandler>({
	handleNotification,
	installFromInviteId,
	clearNotifications,
})
</script>
