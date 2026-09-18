<template>
  <div
    class="overlay"
    @pointerdown.stop="handle"
    @pointermove.passive="handle"
    @pointerup.once="handle"
    @pointercancel="handle"
    @pointerover.capture="handle"
    @pointerout="handle"
    @pointerenter="handle"
    @pointerleave="handle"
    @gotpointercapture="handle"
    @lostpointercapture="handle"
    @click.self.prevent="handle"
  >
    <div style="pointer-events: auto" />
    <cue-image src="uuid:image" @pointerdown="handle" />
    <custom-control @click="handle" />
  </div>
</template>

<style>
.overlay { pointer-events: none; }
.interactive { pointer-events: AUTO !important; }
</style>
