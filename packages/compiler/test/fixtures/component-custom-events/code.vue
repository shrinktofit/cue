<script setup lang="ts">
import { defineComponent, h, onMounted } from '@bsgames/cue';

const calls: string[] = [];
const eventName = 'dynamic';
function handle(value: string) { calls.push(value); }
const listeners = { mapped: handle };
const CustomPanel = defineComponent({
  emits: ['value-changed', 'keydown', 'ready', 'dynamic', 'mapped'],
  setup(_props, { emit }) {
    onMounted(() => {
      emit('value-changed', 'changed');
      emit('keydown', 'custom-keydown');
      emit('ready', 'first-ready');
      emit('ready', 'second-ready');
      emit('dynamic', 'dynamic');
      emit('mapped', 'mapped');
    });
    return () => h('div');
  },
});
defineExpose({ calls });
</script>

<template>
  <CustomPanel
    @value-changed="handle"
    @keydown="handle"
    @ready.once="handle"
    @[eventName]="handle"
    v-on="listeners"
  />
</template>
