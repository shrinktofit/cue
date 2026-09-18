<script setup lang="ts">
import { ref } from '@bsgames/cue';

const toggle = ref(false);
const slider = ref(20);
const selection = ref<string>();
const text = ref('initial');
const number = ref<number>();
const lazy = ref('saved');
const presses = ref(0);
const inputValues: unknown[] = [];

function current() {
  return { toggle: toggle.value, slider: slider.value, selection: selection.value, text: text.value, number: number.value, lazy: lazy.value, presses: presses.value, inputValues: [...inputValues] };
}

function replace() {
  toggle.value = false;
  slider.value = 75;
  selection.value = undefined;
  text.value = 'external';
  number.value = undefined;
}

defineExpose({ current, replace });
</script>

<template>
  <div class="controls">
    <cue-toggle v-model="toggle" />
    <cue-slider id="volume" v-model="slider" />
    <cue-select v-model="selection" :options="[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]" />
    <cue-text-input v-model="text" @input="inputValues.push($event.value)" />
    <cue-number-input v-model="number" />
    <cue-text-input v-model.lazy="lazy" />
    <cue-button @keydown.enter.ctrl.exact.prevent="presses++">Apply</cue-button>
  </div>
</template>

<style>
* { font-size: 16px; }
.controls > cue-slider#volume { width: 180px; }
cue-toggle:checked, cue-button:hover { background-color: #124578; }
.controls .cue-slider-thumb { width: 12px; }
cue-text-input:focus, cue-number-input:focus-within { outline: 1px solid blue; }
cue-button:active { background-color: red; }
cue-select:enabled { color: black; }
cue-select:disabled { color: gray; }
</style>
