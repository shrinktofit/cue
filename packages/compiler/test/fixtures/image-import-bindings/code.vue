<script setup lang="ts">
const _cue_image_0 = 'setup text';
const SlotHost = {};
</script>

<template>
  <div>{{ _cue_image_0 }}</div>
  <div :_cue_image_3 :title="_cue_image_\u0034">{{ _cue_image_1 }}</div>
  <cue-image v-for="_cue_image_0 in [1, 2]" :key="_cue_image_0" src="./image.ts">{{ _cue_image_0 }}</cue-image>
  <SlotHost v-slot="{ value: _cue_image_2 }">
    <cue-image src="./image.ts">{{ _cue_image_2 }}</cue-image>
  </SlotHost>
</template>
