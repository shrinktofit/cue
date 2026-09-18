<script setup lang="ts">
import { defineComponent, h, Length, ref, shallowRef, watchEffect, type CueElement } from '@bsgames/cue';

const count = ref(1);
const panel = shallowRef<CueElement>();
watchEffect(() => {
  if (panel.value) {
    panel.value.style.width = Length.percent(count.value * 25);
    panel.value.style.fontWeight = count.value === 1 ? 400 : 700;
  }
});
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
  <div ref="panel" style="height: 120px; background-color: #123456;">
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
    <div class="static-grid">
      <div class="static-item" />
      <div class="static-item" />
      <div class="static-item" />
      <div class="static-item" />
      <div class="static-item" />
      <div class="static-item" />
    </div>
    <div v-if="count > 1">ready</div>
  </div>
</template>
