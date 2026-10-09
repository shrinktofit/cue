<script setup lang="ts">
defineProps<{ depth: number }>();
</script>

<template>
  <div>
    {{ depth }}
    <TreeNode v-if="depth > 0" :depth="depth - 1" />
  </div>
</template>
