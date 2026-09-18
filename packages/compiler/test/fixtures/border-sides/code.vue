<template>
  <div class="frame" />
</template>

<style>
.frame {
  width: 200px;
  height: 120px;
  border-top: 2px solid red;
  border-right: 4px solid green;
  border-bottom: 6px solid blue;
  border-left: 8px solid white;
  border-radius: 20px 40% / 10px 25%;
  outline: 3px solid #fedcba;
  outline-offset: -2px;
  box-shadow:
    6px 8px 12px 2px rgb(0 0 0 / 40%),
    inset 2px 3px 6px 1px rgb(255 255 255 / 30%);
}
</style>
