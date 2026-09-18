<template>
  <div :style="{ width: '40px' }" />
  <div v-bind:style="style" />
  <div :style.prop="'font-weight: bold'" />
  <StatusLabel :style="style" />
  <div __cueInlineStyle="reserved" />
</template>
