<script setup lang="ts">
defineOptions({ name: 'NamedBranch' });
defineProps<{ depth: number }>();
</script>

<template>
  <div>
    {{ depth }}
    <tree-node v-if="depth > 1" :depth="depth - 1" />
    <NamedBranch v-else-if="depth > 0" :depth="depth - 1" />
  </div>
</template>
