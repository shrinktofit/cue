<template>
  <div class="body">
    <div class="title">Player profile</div>
    <div class="value">Level 24</div>
    <div class="outlined">Outlined text</div>
    <div class="transparent">Transparent stroke</div>
    <div class="named">Named stroke color</div>
  </div>
</template>

<style>
.body {
  font-weight: normal;
  -cue-text-stroke: 0;
}

.title {
  font-weight: bold;
  -cue-text-stroke: 2px #fff;
}

.value {
  font-weight: 650.5;
  -cue-text-stroke-width: 1.5px;
  -cue-text-stroke-color: rgba(10, 20, 30, 0.5);
}

.outlined {
  -cue-text-stroke: white 3px;
  -cue-text-stroke-color: currentColor;
}

.transparent {
  -cue-text-stroke: transparent 2px;
}

.named {
  -cue-text-stroke-color: RebeccAPurple;
}

.minimum {
  font-weight: 1;
}

.maximum {
  font-weight: 1000;
}
</style>
