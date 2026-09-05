<script setup lang="ts">
import { defineComponent, h, ref } from '@bsgames/cue';

const count = ref(1);
const items = ref([
  'first',
  'second',
]);
const StatusLabel = defineComponent(() => () => h('div', 'count:' + count.value));

function advance(): void {
  count.value = 2;
  items.value = [
    ...items.value,
  ].reverse();
}

defineExpose({
  advance,
});
</script>

<template>
  <div>
    <counter-display :value="count">
      {{ count }}
    </counter-display>
    <StatusLabel />
    <div
      v-for="item in items"
      :key="item"
    >
      {{ item }}
    </div>
    <div v-if="count > 1">ready</div>
  </div>
</template>
