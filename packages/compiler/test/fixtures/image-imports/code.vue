<template>
  <cue-image src="./icon.png" style="background-image: url('./icon.png') !important;" />
  <cue-image src="./icon.png" />
  <cue-image src="uuid:existing-sprite-frame" />
</template>

<style>
.tile { background-image: url('./icon.png'); }
.tile:hover { background-image: url('../assets/other.png') !important; }
</style>
