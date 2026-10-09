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

复合样式按**值拷贝**赋值。颜色、Length、点、数组及其嵌套对象都成为 Cue 所有的只读快照；修改原对象不会更新元素，从 `element.style` 读回的复合值也不可原地修改。更新时重新赋值顶层属性，相等值不会触发失效：

```ts
const color = { red: 255, green: 128, blue: 0, alpha: 1 };
element.style.color = color;
color.green = 200; // 不影响已赋给元素的颜色
element.style.color = color; // 显式提交新值
element.style.color = { ...element.style.color!, alpha: 0.5 };
```

这是相对早期 Cue 引用赋值行为的 breaking change，依赖原地修改分量的代码须迁移为重新赋值。普通 Web CSSOM 的 `style.color` 接收 CSS 字符串，本来没有保留 Color 对象引用的语义；[CSS Typed OM 的 set 算法](https://www.w3.org/TR/css-typed-om-1/#dom-stylepropertymap-set)也从输入创建内部表示。Cue 的对象接口不是 Web 原样 API，但这里采用相同的值语义方向。

变更通知、缓存边界与验证方式见 [Runtime performance](runtime-performance.md)。

`<style>` 和静态 `style="..."` 仅由 compiler 的 native Lightning CSS 解析并生成 IR；静态 inline normal / important 保留 CSS 层叠顺序。`:style` 编译时报错；render function 或动态属性透传产生的 `style` prop 也会在 runtime 报错。没有 runtime CSS parser、样式 WASM 或 `initializeCueStyles()` 初始化入口。

`@bsgames/cue/host` 在模块顶层通过 `await` 等待布局初始化和各个共享 Effect 的加载尝试；导入完成后，`CueDocument` 同步使用成功加载的资源，不需要调用 `CueDocument.prepare()`。共享资源始终是一个 `Partial` 对象：单个 Effect 加载失败会记录错误并省略对应字段，其余成功项继续使用；依赖缺失 Effect 的渲染路径会跳过。布局是全部绘制的必需能力，初始化失败仍会使模块导入失败，并释放已保留的 Effect 引用。

`CueDocument` 不启用 `executeInEditMode`，由 Cocos 在编辑器非预览模式下跳过组件生命周期。模块导入仍可能发生，因此资源模块通过 `EDITOR_NOT_IN_PREVIEW` 跳过资源准备并返回空对象。每个成功加载的共享 Effect 立即由模块保留引用，组件销毁只释放自己的渲染对象。运行环境与模块加载器需要支持 top-level await。

内部仍把百分比编码为已有 Style IR 的紧凑字符串，以复用 layout / paint 契约；该字符串由类型化数值生成，不是对用户 CSS 文本的解析。Lightning AST lowering 回到 compiler 内部，不再保留只有一个消费者的共享 compiler 包。

## Positioning

支持 `static`、`relative`、`absolute` 以及 `top/right/bottom/left/inset` 的 px、%、auto。绝对定位不会占据 Flex / Block 流内空间，定位祖先为最近的 positioned / transformed element，而不是直接父节点。

推荐为完整 UI case 的根设置 `position: relative`。根之外的初始 containing block 取 CueDocument 节点的 UITransform 尺寸；裸 renderer 的 paint-list 调用可显式传 viewport。当前不支持 fixed、sticky、logical inset 或完整 stacking context。

## Imported TTF and text stroke

```ts
import { loadCueFont } from '@bsgames/cue/host';

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
