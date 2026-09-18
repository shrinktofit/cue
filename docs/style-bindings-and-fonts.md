# Style API and fonts

## Typed runtime style

```vue
<script setup lang="ts">
import { Length, ref, shallowRef, watchEffect, type CueElement } from '@bsgames/cue';

const progress = ref(40);
const fill = shallowRef<CueElement>();
watchEffect(() => {
  if (fill.value) {
    fill.value.style.width = Length.percent(progress.value);
  }
});
</script>

<template>
  <div class="track">
    <div ref="fill" class="fill" />
  </div>
</template>

<style>
.track { position: relative; width: 280px; height: 28px; }
.fill { position: absolute; inset: 0 auto 0 0; background-color: #b7ff00; }
</style>
```

运行时不解析 CSS。状态切换使用 Vue `:class` 选择预编译规则；连续值使用 `CueElement.style` 修改所有元素共用的 longhand 样式。它是类型化 API，不是 Web `CSSStyleDeclaration` 或 Vue `:style` 字符串接口。

```ts
element.style.width = Length.percent(75); // 75%，不是 0.75
element.style.height = Length.px(24);
element.style.fontSize = 24; // 长度 API 的 number 简写为 px
element.style.backgroundColor = { red: 255, green: 128, blue: 0, alpha: 1 };
element.style.fontFamily = [font.fontFamily, 'sans-serif']; // 名称数据，不含 CSS 引号
element.style.lineHeight = Length.px(32);
element.style.width = undefined; // 删除 API 覆盖，恢复静态样式
```

长度支持 `Length.px()` / `Length.percent()` 与属性合法的 keyword；enum 从 `@bsgames/cue` 导出，例如 `CuePosition.absolute`、`CueTextAlign.center`。只支持 px 的属性不接受百分比。RGB 为 0..255，alpha 为 0..1。`flexGrow`、`order` 等 number 仍是无单位数值；`lineHeight` 要求显式 px 或 `CueLineHeightKeyword.normal`，不把 CSS 的无单位倍数重新解释为像素。复合值使用结构化数据，例如 `borderTopLeftRadius = [Length.percent(50), Length.px(8)]`；transform 角度以度为单位。API 不接收 shorthand 或 `!important` 字符串；动态背景图片使用已规范化的 `uuid:` 资源引用。

API 覆盖高于 stylesheet normal 和静态 inline normal，低于任何静态 `!important`；清除后恢复该元素原有的静态样式、继承或初始值。每个元素有独立的 style 对象，修改会在下一次样式计算 / 绘制时生效。Vue 中使用 `shallowRef<CueElement>` 保存元素引用，避免深层响应式代理宿主节点。

`<style>` 和静态 `style="..."` 仅由 compiler 的 native Lightning CSS 解析并生成 IR；静态 inline normal / important 保留 CSS 层叠顺序。`:style` 编译时报错；render function 或动态属性透传产生的 `style` prop 也会在 runtime 报错。没有 runtime CSS parser、样式 WASM 或 `initializeCueStyles()` 初始化入口。`CueDocument.prepare()` 只准备布局与渲染资源。

内部仍把百分比编码为已有 Style IR 的紧凑字符串，以复用 layout / paint 契约；该字符串由类型化数值生成，不是对用户 CSS 文本的解析。Lightning AST lowering 回到 compiler 内部，不再保留只有一个消费者的共享 compiler 包。

## Positioning

支持 `static`、`relative`、`absolute` 以及 `top/right/bottom/left/inset` 的 px、%、auto。绝对定位不会占据 Flex / Block 流内空间，定位祖先为最近的 positioned / transformed element，而不是直接父节点。

推荐为完整 UI case 的根设置 `position: relative`。根之外的初始 containing block 取 CueDocument 节点的 UITransform 尺寸；裸 renderer 的 paint-list 调用可显式传 viewport。当前不支持 fixed、sticky、logical inset 或完整 stacking context。

## Imported TTF and text stroke

```ts
import { CueDocument, loadCueFont } from '@bsgames/cue/host';

await CueDocument.prepare();
const font = await loadCueFont('your-imported-ttf-asset-uuid');
documentHost.mount(Profile, { fontFamily: font.fontFamily });

// 在使用字体的 UI 卸载之后释放：
documentHost.unmount();
font.dispose();
```

`loadCueFont` 也接受已加载的 Cocos TTFFont。它复用 Cocos 字体注册，等待字体可用，保留资源引用；返回的 `fontFamily` 是未加引号的单一家族名，用于 `element.style.fontFamily = [font.fontFamily]`。加载/释放会使文本纹理缓存失效，测量与绘制使用同一字体。

支持 `font-weight: normal / bold / 1..1000`；相对 weight、font-style 与 @font-face 尚未实现。字重可用效果由加载的字体和浏览器字体匹配决定。

```css
.name {
  font-size: 24px;
  font-weight: bold;
  color: white;
  -cue-text-stroke: 2px #15122a;
}
```

`-cue-text-stroke-width` 和 `-cue-text-stroke-color` 可分别覆盖 shorthand。三者为明确的 Cue 扩展：居中描边、圆角连接，先 stroke 后 fill；不占布局空间。纹理为字形 overhang 和描边扩边，仍受祖先 overflow clip 约束。Web CSS `text-shadow` 没有被重解释为描边。

当前仍为 Web Preview 的 Canvas→RGBA texture 过渡实现，不涉及 SDF、glyph atlas、远程头像或 Native 字体后端。
