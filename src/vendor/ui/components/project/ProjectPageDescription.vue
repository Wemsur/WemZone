<template>
	<div class="markdown-body" v-html="renderHighlightedString(description ?? '')" />
</template>
<script setup lang="ts">
// @ts-nocheck
import { renderHighlightedString } from '@modrinth/utils'

withDefaults(
	defineProps<{
		description: string
	}>(),
	{},
)
</script>
