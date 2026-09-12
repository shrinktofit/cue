<template>
  <div class="container">
    <div class="item override" />
    <div class="item" />
    <div class="item" />
  </div>
</template>

<style>
.container {
  display: flex;
  flex-flow: row wrap;
  align-content: space-between;
  align-items: stretch;
  justify-content: space-evenly;
  gap: 10px 5%;
  box-sizing: border-box;
  width: 320px;
  min-width: 50%;
  max-width: none;
  height: auto;
  margin: 4px auto 8px 10%;
  padding: 12px 5%;
  border: 4px solid #335577;
  border-radius: 30px;
}

.item {
  flex: 2 1 25%;
  align-self: center;
  order: -1;
  min-width: 40px;
  max-width: 120px;
  height: 36px;
  background-color: #f29d49;
}

.override {
  flex-grow: 3;
  flex-wrap: wrap-reverse;
  column-gap: 6px;
  margin-left: 14px;
  padding-right: 8px;
}
</style>
