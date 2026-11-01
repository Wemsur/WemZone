<template>
	<EmptyState type="empty-inbox">
		<template #heading>{{ heading }}</template>
		<template #description
			><slot name="description">{{ description }}</slot></template
		>
		<template v-if="$slots.actions" #actions><slot name="actions" /></template>
	</EmptyState>
</template>

<script setup lang="ts">
// @ts-nocheck
import { EmptyState } from '@modrinth/ui'

defineProps<{ heading: string; description?: string }>()
</script>
