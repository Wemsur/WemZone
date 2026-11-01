<script setup lang="ts">
// @ts-nocheck
import ScreenshotsPage from '@launcher/components/ui/screenshots-page/index.vue'

import { injectInstancePage } from '../instance-context'

const instancePage = injectInstancePage()
</script>

<template>
	<ScreenshotsPage :instance-id="instancePage.instanceId.value" />
</template>
