<template>
  <div class="container">
    <div class="absolute">Pinned overlay</div>
    <div class="inset">Inset shorthand</div>
    <div class="relative">Relative offset</div>
    <div class="static">Normal flow</div>
  </div>
</template>

<style>
.container {
  position: relative;
  width: 320px;
  height: 180px;
}

.absolute {
  position: absolute;
  inset: 10% 12px auto -4px;
  top: 5px;
  right: 6%;
  bottom: 0;
  left: auto;
}

.inset {
  position: absolute;
  inset: 10% 12px auto -4px;
}

.relative {
  position: relative;
  top: -12px;
  left: 25%;
}

.static {
  position: static;
  inset: 0;
}
</style>
