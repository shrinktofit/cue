# Cue Implementation Status

更新日期：2026-09-16

本页追踪 Cue 相对产品目标的当前实现状态，依据仓库源码、测试和可运行示例维护，不代替 [`PLANS.md`](PLANS.md) 中的路线与架构决策。

- `✅`：当前链路已经实现；若与标准 Web CSS 仍有差异，状态后附脚注。
- `❌`：尚未实现，或底层依赖虽具备能力但 Cue 尚未接通。
- 部分实现的能力应拆成可独立验收的行，不使用含糊的“部分支持”状态。
- 对用户公开的样式语法和语义必须是 Web CSS 的严格子集；新增差异必须先提出，再在这里明确记录。

## SFC 与 Compiler

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| 使用 Vue SFC 语法解析 `.cue` | ✅ | 基于 `@vue/compiler-sfc` |
| `<script>` 与 `<script setup>` | ✅ | JavaScript / TypeScript 输出为 JavaScript |
| `<template>` 编译为 Vue render function | ✅ | runtime helper 指向 `@bsgames/cue` |
| 项目配置声明 Custom Element | ✅ | 通过 `CompileCueOptions.customElements` 传入 |
| 多个 `<style>` block | ✅ | 按源码顺序合并进入一份 Style IR |
| 使用 Lightning CSS 解析样式 | ✅ | 不手写 CSS parser |
| 版本化 Style IR | ✅ | 当前 schema version 为 `1` |
| 多文件 JavaScript 产物 | ✅ | entry、script、template、style 按实际内容生成 |
| `cue compile <file> --out-dir=<dir>` | ✅ | CLI 仅调用 compiler library |
| `<cue-image src>` 静态资源规范化 | ✅[^cue-image] | `uuid:` 原样保留；相对 `.cue` 的路径由 compiler host 规范化为 SpriteFrame UUID |
| Compiler → runtime 可执行 fixture | ✅ | 覆盖 Vue 响应式更新、Custom Element 与组件样式挂载 |
| Source map | ❌ | script、template、style 均未回映到 `.cue` |
| 稳定 diagnostic code 与精确 source range | ❌ | 当前主要透传 parser/compiler error |
| 对不支持 CSS 的显式 diagnostics | ❌ | 当前会忽略无法编译的 selector、property 或 value |
| `<style scoped>` | ❌ | 尚未定义公开语义 |
| CSS Modules | ❌ | 尚未定义公开语义 |
| CSS preprocessors | ❌ | 尚未实现 |
| Asset reference / dependency metadata | ❌ | 尚未实现 |
| HMR metadata 与增量 patch 分类 | ❌ | 尚未实现 |
| OMS source compiler 接入 | ❌ | examples 仍使用 CLI 预编译 |

## Element 与 Vue Runtime

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| `CueNode` 树及父子关系 | ✅ | 支持插入、移除、移动、清空与环检测 |
| `CueElement` | ✅ | 保存标签名、子节点和 renderer 写入的 properties |
| `Text` 与 `Comment` | ✅ | 作为 `CharacterData` 节点保存可变 `data` |
| `CueRootElement` | ✅ | 作为 Vue app 的脱离 Cocos Node 的挂载根 |
| Vue custom renderer | ✅ | 覆盖 element、text、comment、property patch 与 keyed reorder |
| Vue 响应式更新 | ✅ | 已由 compiler → runtime fixture 执行验证 |
| `globalElementRegistry.define/get` | ✅ | `div` 与项目 Custom Element 使用同一路径创建 |
| `div` | ✅[^display] | 内建通用容器元素 |
| `cue-image` | ✅[^cue-image] | 内建 replaced element；公开接口当前只有 `src` |
| `span` | ❌ | 尚未实现 inline formatting context |
| `br` | ❌ | 尚未实现 inline formatting context |
| `img` | ❌ | 当前不作为 `cue-image` 的 Web 兼容别名 |
| 纯文本元素的 intrinsic measure | ✅[^text-raster] | 文本宽高参与 Taffy Block/Flex 布局 |
| 整文本块 TTF 栅格化与绘制 | ✅[^text-raster] | Web Preview 使用 Canvas 2D 生成独立 RGBA 纹理 |
| Inline formatting context | ❌ | 混合文本与子元素、`span`、`br` 和跨 run 排版尚未实现；纯文本 Element 已有独立换行路径 |
| DOM 风格事件派发 | ❌ | 尚未实现 |
| Element 生命周期 / document 归属 | ❌ | 尚未形成完整 attach / detach 契约 |

## CSS Selector 与 Cascade

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| 单 class selector（`.item`） | ✅ | 编译、匹配与运行时更新已接通 |
| 复合 class selector（`.item.selected`） | ✅[^selector-subset] | specificity 按 class 数量计算 |
| Selector list（`.a, .b`） | ✅[^selector-subset] | 列表中的每项仍必须是纯 class selector |
| Class 的 string / array / object Vue binding | ✅ | runtime 会归一化为 class name set |
| `!important` | ✅[^selector-subset] | 参与当前 class-only cascade |
| Specificity 与 source order | ✅[^selector-subset] | 只覆盖当前 class-only selector profile |
| 组件样式随 mount / unmount 生效 | ✅ | 相同 stylesheet 按组件实例引用计数 |
| Type selector（`div`） | ❌ | 尚未实现 |
| ID selector（`#app`） | ❌ | 尚未实现 |
| Universal / attribute selector | ❌ | 尚未实现 |
| Descendant / child / sibling combinator | ❌ | 尚未实现 |
| Pseudo-class / pseudo-element | ❌ | 尚未实现 |
| Inline `style` attribute | ❌ | renderer 会保存 property，但 cascade 不消费它 |
| Inheritance | ❌ | 尚未实现 |
| `initial` / `inherit` / `unset` / `revert` | ❌ | 尚未实现 |
| Custom properties 与 `var()` | ❌ | 尚未实现 |
| Cascade layers | ❌ | 尚未实现 |
| Media / container queries | ❌ | 尚未实现 |
| `@supports` | ❌ | 尚未实现 |

## Box Model 与基础布局

| CSS 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| `display: block` | ✅[^display] | Taffy block layout；不存在 inline formatting context |
| `display: flex` | ✅[^display] | 详见 Flexbox 表 |
| `display: none` | ❌ | 尚未实现 |
| `width` / `height` | ✅[^lengths] | `px`、`%`、`auto` |
| `min-width` / `min-height` | ✅[^lengths] | `px`、`%`、`auto`；尚无内容 intrinsic sizing |
| `max-width` / `max-height` | ✅[^lengths] | `px`、`%`、`none`；尚无内容 intrinsic sizing |
| `box-sizing` | ✅ | `content-box`、`border-box` |
| `margin` shorthand 与四个 physical longhand | ✅[^lengths] | `px`、`%`、`auto` |
| `padding` shorthand 与四个 physical longhand | ✅[^lengths] | `px`、`%` |
| `background-color` | ✅[^colors] | 编译为单个 RGBA 实色并由 GPU 绘制 |
| `border` shorthand | ✅[^border] | 仅四边一致的 color / style / width |
| `border-color` | ✅[^border] | 仅四边同色 |
| `border-style` | ✅[^border] | `none`、`solid`；当前还把 `hidden` 归一化为 `none` |
| `border-width` | ✅[^border] | 仅四边同宽；支持 `thin` / `medium` / `thick` / `px` |
| `border-radius` | ✅[^radius] | 四角可不同，但每角仅支持水平与垂直半径相同的 `px` 圆角 |
| Logical size / margin / padding / border properties | ❌ | 尚未实现 |
| `em` / `rem` / viewport 等长度单位 | ❌ | 尚未实现 |
| `calc()` / `min()` / `max()` / `clamp()` | ❌ | 尚未实现 |
| Intrinsic size keywords | ❌ | `min-content`、`max-content`、`fit-content` 尚未实现为用户样式 |
| `position` / inset | ❌ | 尚未实现 |
| `overflow` / scrolling | ❌ | 尚未实现 |
| `aspect-ratio` | ❌ | 尚未实现 |

## Typography

| CSS 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| `color` | ✅[^text-raster] | RGB 颜色及 alpha；按标准继承 |
| `font-family` | ✅[^text-raster] | 标准 fallback list；字体须已由运行平台注册 |
| `font-size` | ✅[^text-raster] | `px`；按标准继承 |
| `line-height` | ✅[^text-raster] | `normal` 与 `px`；按标准继承 |
| `text-align` | ✅[^text-align] | `start`、`end`、`left`、`right`、`center`；按标准继承 |
| `white-space` | ✅[^text-wrap] | `normal`、`nowrap`、`pre`、`pre-wrap`、`pre-line`；标准属性名、值与继承语义 |
| 自动换行 | ✅[^text-wrap] | 纯文本 Element 按可用 inline size 和 Unicode / CSS Text 换行机会分行 |
| 显式 segment break | ✅[^text-wrap] | 在 `pre`、`pre-wrap`、`pre-line` 中保留；在 `normal`、`nowrap` 中折叠 |
| `white-space: break-spaces` | ❌ | 尚未实现 preserved-space 的逐空格换行与行尾占位语义 |
| `overflow-wrap` / `word-break` / `line-break` / `hyphens` | ❌ | 当前使用这些属性的标准初始行为，不接受非初始值 |
| `font-weight` / `font-style` | ❌ | 尚未进入 Style IR |
| `text-align: justify` / `justify-all` | ❌ | 依赖尚未实现的 inline formatting 与空白分配 |
| 字距与词距 | ❌ | `letter-spacing`、`word-spacing` 尚未实现 |
| 完整 shaping / bidi / fallback diagnostics | ❌ | 当前委托 Canvas 2D，不声明跨平台一致性 |

## Flexbox

本表以 [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/) 与 [CSS Box Alignment Module Level 3](https://www.w3.org/TR/css-align-3/) 为目标参照。

| CSS 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Flex formatting context（`display: flex`） | ✅[^flex-engine] | 通过 Taffy WASM 计算 `CueElement` box |
| Inline flex container（`display: inline-flex`） | ❌ | Cue 尚无 inline formatting context |
| `flex-direction` | ✅ | `row`、`row-reverse`、`column`、`column-reverse` |
| `flex-wrap` | ✅ | `nowrap`、`wrap`、`wrap-reverse` |
| `flex-flow` shorthand | ✅ | direction 与 wrap 均接入 |
| `flex-grow` | ✅ | number |
| `flex-shrink` | ✅ | number |
| `flex-basis` | ✅[^flex-basis] | `px`、`%`、`auto` |
| `flex` shorthand | ✅[^flex-basis] | grow / shrink / basis 可被当前 Style IR 表示时生效 |
| `order` | ✅[^order] | 改变 layout / paint 顺序；尚无 accessibility semantic order |
| `justify-content` | ✅[^alignment-values] | `start` / `end` / `flex-start` / `flex-end` / `center` / `space-*` / `stretch` |
| `align-items` | ✅[^alignment-values] | `start` / `end` / `flex-start` / `flex-end` / `center` / `stretch` |
| `align-self` | ✅[^alignment-values] | `auto` 及 `align-items` 的当前非 baseline 值域 |
| `align-content` | ✅[^alignment-values] | `start` / `end` / `flex-start` / `flex-end` / `center` / `space-*` / `stretch` |
| First-baseline keyword 的解析与布局桥接 | ✅[^baseline] | 没有文本 baseline 测量，不能视为完整 baseline alignment |
| `gap` / `row-gap` / `column-gap` | ✅[^lengths] | `px`、`%`；Flex 中的 `normal` 以 used value `0` 存入内部 IR |
| Main-axis auto margins | ✅[^flex-engine] | 由 Taffy 处理 |
| Cross-axis auto margins | ✅[^flex-engine] | 由 Taffy 处理 |
| Multi-line flex layout | ✅[^flex-engine] | 由 Taffy 处理 |
| 纯文本元素的 intrinsic / content-based flex sizing | ✅[^text-raster] | Taffy measure callback 使用与绘制一致的 Canvas 字体测量 |
| `cue-image` intrinsic sizing | ✅[^cue-image] | SpriteFrame 加载后以其 `rect` 宽高参与 measure function |
| 其他 Custom Element intrinsic sizing | ❌ | 尚未定义自定义测量契约 |
| `flex-basis: content` 与 intrinsic keywords | ❌ | 尚未进入 Style IR |
| `safe` / `unsafe` overflow alignment | ❌ | 当前会忽略这些值 |
| Last baseline / self-start / self-end | ❌ | 尚未进入 Style IR |
| `direction`、writing modes 与 RTL | ❌ | 主轴只按当前物理坐标计算 |
| Anonymous text flex items | ❌ | `Text` 不进入布局树 |
| Absolutely positioned flex children | ❌ | `position` 尚未实现 |
| Collapsed flex items（`visibility: collapse`） | ❌ | `visibility` 尚未实现 |
| CSS Flexbox conformance test suite | ❌ | 当前只有 compiler fixture 和可视化 playground，没有几何断言矩阵 |

## Grid

| CSS 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Grid formatting context（`display: grid`） | ❌ | Taffy 有 Grid 能力，但 Cue schema/compiler/runtime 尚未接通 |
| Inline grid（`display: inline-grid`） | ❌ | Cue 尚无 inline formatting context |
| `grid-template-columns` / `grid-template-rows` | ❌ | 尚未实现 |
| `grid-template-areas` / `grid-area` | ❌ | 尚未实现 |
| Grid line placement | ❌ | `grid-column*` / `grid-row*` 尚未实现 |
| Implicit grid tracks | ❌ | `grid-auto-columns` / `grid-auto-rows` 尚未实现 |
| Auto placement | ❌ | `grid-auto-flow` 尚未实现 |
| Track sizing functions | ❌ | `fr`、`minmax()`、`repeat()`、`fit-content()` 尚未实现 |
| Grid `gap` | ❌ | `gap` 当前仅能作用于已实现的 Flex layout |
| Grid alignment | ❌ | `justify-items`、`justify-self`、`place-*` 等尚未实现 |
| Named lines | ❌ | 尚未实现 |
| Subgrid | ❌ | 尚未实现 |
| Masonry | ❌ | 尚未实现 |

## Paint 与 Cocos Backend

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Taffy WASM 初始化与布局计算 | ✅ | WASM binary 随 runtime library 构建并由 consumer 加载 |
| Layout box 转换为 paint rect | ✅ | 当前只为可见背景或边框生成 rect |
| Cocos `gfx` vertex / index buffer | ✅ | `CueDocument` 动态上传 quad 数据 |
| Cocos material / effect | ✅ | 自定义 effect 绘制背景、边框与圆角 |
| 单 `CueDocument` rectangle batch | ✅ | 当前使用一个 model / submesh，单批最多 16,384 个矩形 |
| `CueDocument` Cocos 生命周期接入 | ✅ | 使用 Cyclonium class / lifecycle decorators |
| Individual border sides | ❌ | paint record 只有统一 border width / color |
| Background image | ❌ | 尚未实现 |
| Gradient | ❌ | 尚未实现 |
| Outline | ❌ | 尚未实现 |
| Box shadow | ❌ | 尚未实现 |
| Clip / mask | ❌ | 尚未实现 |
| CSS transform / opacity | ❌ | 尚未实现 |
| Stacking context / `z-index` | ❌ | 尚未实现 |
| 整文本块 texture paint | ✅[^text-raster] | 每个纯文本元素一张纹理和一个 quad |
| Glyph atlas / SDF text | ❌ | 当前阶段明确不引入 |
| SpriteFrame image paint | ✅[^cue-image] | 每个 `cue-image` 使用 SpriteFrame texture / UV 绘制一个 quad |
| Nine-slice image paint | ❌ | 尚未实现 |
| Material / texture / clip batch splitting | ❌ | 当前只有单一 rectangle material |
| Partial paint rebuild / dirty propagation | ❌ | 当前每帧重新计算 layout 与上传 vertex buffer |

## Input、Animation 与 Accessibility

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Hit testing | ❌ | 尚未实现 |
| Pointer Events / pointer capture | ❌ | 尚未实现 |
| Wheel / scrolling | ❌ | 尚未实现 |
| Focus navigation | ❌ | 尚未实现 |
| Keyboard / IME | ❌ | 尚未实现 |
| Gesture arbitration | ❌ | 尚未实现 |
| CSS transitions | ❌ | 尚未实现 |
| CSS keyframes | ❌ | 尚未实现 |
| `element.animate()` | ❌ | 尚未实现 |
| Accessibility semantic tree | ❌ | 尚未实现 |

## Extension、Language Service 与 Examples

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Vortex / Cocos extension package v2 skeleton | ✅ | ESM source，Vite 输出宿主 CJS bridge |
| Cue runtime assets 挂载到 `asset-db` | ✅ | hooks 注册只读 `Cue-Runtime` mount |
| Extension service lifecycle / commands / UI | ❌ | `main.ts` 当前为空入口 |
| `.cue` asset importer / dependency graph | ❌ | 尚未实现 |
| OMS build / preview contribution | ❌ | 尚未实现 |
| Runtime Inspector | ❌ | 尚未实现 |
| `.cue` language plugin | ❌ | package 当前只有空导出 |
| `vue-tsc` 的 `.cue` 检查 | ❌ | 尚未实现 |
| CSS Profile completion / diagnostics | ❌ | 尚未实现 |
| Custom Element editor metadata | ❌ | 尚未实现 |
| Flex playground 可视化验收 | ✅ | 独立 examples 仓库以 Cocos UI 控件组合控制一个 live flex layout |
| Text playground 可视化验收 | ✅ | 独立页面以一个 live text box 组合验收文本样例、`white-space`、宽度、对齐和字体样式 |
| Image playground 可视化验收 | ✅[^cue-image] | 独立页面以一个 live `cue-image` 验收相对路径、`uuid:`、固有尺寸、单轴等比尺寸与显式拉伸 |
| Flex playground 自动几何断言 | ❌ | 当前以人工可视化验收为主 |
| Grid gallery | ❌ | Grid 尚未实现 |
| Production Web smoke | ❌ | 尚未形成发布 Gate |
| Native smoke | ❌ | 尚未建立 Native backend 结论 |
| Visual regression suite | ❌ | 尚未实现 |
| Performance / bundle-size baseline | ❌ | 尚未建立可重复测量 |

## 已知 CSS 差异脚注

[^display]: Cue 当前只实现 block-level `display: block` 与 `display: flex`。标准 CSS 的初始值 `inline`、`inline-flex`、`none`、list-item、table 等 display 类型尚未支持；block layout 也尚无 inline formatting、float、margin collapsing 等完整浏览器语义。非 `div` 元素若未显式声明已支持的 display，会在布局阶段报错。

[^selector-subset]: 属性名、selector 语法与优先级规则没有改名，但 selector profile 仅接受一个或多个连续 class component；Web CSS 的其他 selector 以及它们共同参与的完整 specificity 尚不存在。

[^lengths]: 对外仍使用标准 CSS 属性和值写法，但当前 Style IR 只保留 `px`、`%` 以及该属性合法的 `auto` / `none`。其他合法 Web CSS 单位、数学函数与 intrinsic keywords 会被忽略，且尚无 diagnostic。

[^colors]: Lightning CSS 可以解析更广的 Web CSS color 语法，但 Cue 当前只保留它输出为 RGB 的颜色；`currentColor`、system color、wide-gamut color 等语义尚未实现。

[^border]: Cue 当前只绘制四边一致的单一边框。`dotted`、`dashed`、`double` 等标准样式以及各边独立值会被忽略。`hidden` 当前被当作 `none`，在未来引入 table border conflict resolution 前不是完整的标准语义。

[^radius]: Web CSS 支持百分比和椭圆圆角；Cue 当前只接受 `px`，并要求每个角的水平半径等于垂直半径。超出 box 的半径会在绘制前按 CSS 的比例缩小原则归一化。

[^flex-engine]: Cue 把当前 Style IR 映射到 Taffy 2.0.3，而不是浏览器 layout engine。没有 intrinsic measurement、inline/text layout、writing mode 和 Web Platform conformance 结果，因此只声明表中列出的 box-level 子集。

[^flex-basis]: `flex-basis` 暂只保留 `px`、`%`、`auto`；`content`、intrinsic keywords 和依赖内容测量的标准行为未实现。若 `flex` shorthand 的 basis 超出该子集，当前会忽略整项 shorthand，且尚无 diagnostic。

[^order]: 标准 CSS 的 `order` 只改变视觉顺序，不应改变逻辑与无障碍顺序。Cue 当前同时按 `order` 排序 layout record 与 paint traversal；accessibility tree 尚未实现，后续必须保持标准逻辑顺序语义。

[^alignment-values]: Cue 保留标准 CSS 名称和值，但目前只接通表中列出的 Box Alignment 子集；`safe` / `unsafe`、self-position 扩展值与完整 fallback 规则尚未实现。

[^baseline]: `baseline` / `first baseline` 能被 parser 接受并映射到 Taffy，但 Cue 没有 glyph、line box 或 custom element baseline 测量，所以当前只对无文本 box 使用 Taffy fallback，不能宣称完整 Web CSS baseline alignment。

[^text-raster]: 当前是过渡性的 Web Preview 文本路径：只处理没有 Element 子节点的纯文本 Element，将整块文字用 Canvas 2D 动态栅格化为 RGBA 纹理，再由 Cocos GFX 绘制一个 quad。字体与颜色使用标准 CSS 属性名和继承语义；没有混合 inline formatting context、glyph atlas、SDF 或 Native 支持声明。文本、排版宽度或继承样式变化时会重建该文本块纹理。

[^text-align]: Cue 尚未实现 CSS `direction`，当前使用 Web CSS 的默认 LTR 方向，因此 `start` 等价于 `left`、`end` 等价于 `right`；物理值 `left`、`right` 与方向无关。

[^text-wrap]: Cue 先按 `white-space` 处理 segment break、可折叠空白和 tab，再用 `css-line-break` 的 CSS Text Level 3 tailoring / Unicode UAX #14 换行机会配合 Canvas 实测宽度选择 soft wrap。当前只覆盖纯文本 Element；尚无 `lang` / `line-break` tailoring。保留模式下的 tab 使用 CSS 初始 `tab-size: 8` 的像素停靠近似，`pre-wrap` 的行尾 hanging-space 几何也尚未单独建模，因此这两项不能视为完整浏览器一致性。

[^cue-image]: `cue-image` 是 Cue 自有元素，不声明 Web `<img>` 兼容性。静态 `src` 只接受相对 `.cue` 文件的路径或 `uuid:<SpriteFrame UUID>`；动态 `src` 当前只接受 `uuid:`。相对路径由宿主读取 Cocos `.meta`，且必须唯一对应一个 `sprite-frame` subasset。资源异步加载后以 SpriteFrame `rect` 作为固有尺寸；只指定一边时保持该比例，两边都指定时拉伸到 content box。尚无 URL、data URL、`object-fit`、裁剪或 nine-slice 语义。
