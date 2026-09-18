<template>
  <div class="unsupported">Unsupported CSS values report diagnostics.</div>
</template>

<style>
.fixed { position: fixed; }
.sticky { position: sticky; }
.bolder { font-weight: bolder; }
.lighter { font-weight: lighter; }
.relative-stroke { -cue-text-stroke: 1em #fff; }
.negative-stroke { -cue-text-stroke-width: -1px; }
.unitless-stroke { -cue-text-stroke-width: 1; }
.extra-stroke { -cue-text-stroke: 1px #fff #000; }
.wrong-stroke-color { -cue-text-stroke-color: 2px; }
.unknown-stroke-color { -cue-text-stroke-color: cerulean42; }
</style>
