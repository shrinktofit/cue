<template>
  <div @keydown="handle" @click.enter="handle" @click.passive.prevent="handle" />
  <div @[eventName]="handle" v-on="listeners" />
  <cue-image @load="handle" />
  <custom-control @change="handle" />
  <CustomPanel @ready.enter="handle" />
</template>
