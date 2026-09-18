<template>
  <div class="frame">
    <div class="back" />
    <div class="front" />
  </div>
</template>

<style>
.frame {
  display: flex;
  width: 180px;
  height: 100px;
  overflow: hidden;
  border-radius: 20px;
  outline: 3px solid white;
  outline-offset: 4px;
}

.back {
  width: 120px;
  height: 80px;
  -cue-opacity: 0;
  z-index: -1;
}

.front {
  width: 120px;
  height: 80px;
  -cue-opacity: 0.5;
  z-index: 2;
}
</style>
