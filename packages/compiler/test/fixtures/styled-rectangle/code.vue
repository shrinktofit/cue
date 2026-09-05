<template>
  <div class="card strong">
    <div class="item first" />
    <div class="item second" />
  </div>
</template>

<style>
.card {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  width: 240px;
  height: 96px;
  background-color: #3366cc;
  border-radius: 24px;
  color: white;
}

.item,
.badge {
  width: 40px;
  height: 24px;
  background-color: #ffcc33;
  border-radius: 6px;
}

.card.strong {
  height: 104px !important;
}

div {
  width: 999px;
}
</style>
