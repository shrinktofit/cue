# Cue Implementation Status

更新日期：2026-09-18

本页追踪 Cue 相对产品目标的当前实现状态，依据仓库源码、测试和可运行示例维护，不代替 [`PLANS.md`](PLANS.md) 中的路线与架构决策。

- `✅`：当前链路已经实现；若与标准 Web CSS 仍有差异，状态后附脚注。
- `❌`：尚未实现，或底层依赖虽具备能力但 Cue 尚未接通。
- 部分实现的能力应拆成可独立验收的行，不使用含糊的“部分支持”状态。
- 对用户公开的标准样式语法和语义必须是 Web CSS 的严格子集；Cue 自有扩展须使用 `-cue-` 前缀，并在这里明确记录。

## SFC 与 Compiler

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| 使用 Vue SFC 语法解析 `.cue` | ✅ | 基于 `@vue/compiler-sfc` |
| `<script>` 与 `<script setup>` | ✅ | JavaScript / TypeScript 输出为 JavaScript |
| `<template>` 编译为 Vue render function | ✅ | runtime helper 指向 `@bsgames/cue` |
| 项目配置声明 Custom Element | ✅ | 通过 `CompileCueOptions.customElements` 传入 |
| 六类内置原生控件标签 | ✅[^builtin-controls] | 共享 control schema；compiler 不读取 runtime registry |
| 原生控件 `v-model` / `.lazy` | ✅[^builtin-controls] | value + input / change；跳过 composing input，不生成 DOM model 指令 |
| 多个 `<style>` block | ✅ | 按源码顺序合并进入一份 Style IR |
| 使用 Lightning CSS 解析样式 | ✅ | 不手写 CSS parser |
| 版本化 Style IR | ✅ | 当前 schema version 为 `1` |
| 多文件 JavaScript 产物 | ✅ | entry、script、template、style 按实际内容生成 |
| `cue compile <file> --out-dir=<dir>` | ✅ | CLI 仅调用 compiler library |
| `<cue-image src>` 静态资源规范化 | ✅[^cue-image] | `uuid:` 原样保留；相对 `.cue` 的路径由 compiler host 规范化为 SpriteFrame UUID |
| Compiler → runtime 可执行 fixture | ✅ | 覆盖 Vue 响应式更新、Custom Element 与组件样式挂载 |
| Source map | ❌ | script、template、style 均未回映到 `.cue` |
| 稳定 diagnostic code 与精确 source range | ❌ | 当前主要透传 parser/compiler error |
| 未支持 selector 的 diagnostics | ✅[^selector-subset] | 未支持的 combinator、attribute / pseudo selector 显式诊断 |
| 全量 CSS property / value / at-rule diagnostics | ❌ | 尚未统一覆盖；部分未支持的声明仍会被忽略 |
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
| `globalElementRegistry.define/get` | ✅ | 容器、图片、六类内置控件与项目 Custom Element 使用同一路径 |
| `div` | ✅[^display] | 内建通用容器元素 |
| `cue-image` | ✅[^cue-image] | 内建 replaced element；公开接口当前只有 `src` |
| `span` | ❌ | 尚未实现 inline formatting context |
| `br` | ❌ | 尚未实现 inline formatting context |
| `img` | ❌ | 当前不作为 `cue-image` 的 Web 兼容别名 |
| 纯文本元素的 intrinsic measure | ✅[^text-raster] | 文本宽高参与 Taffy Block/Flex 布局 |
| 整文本块 TTF 栅格化与绘制 | ✅[^text-raster] | Web Preview 使用 Canvas 2D 生成独立 RGBA 纹理 |
| Inline formatting context | ❌ | 混合文本与子元素、`span`、`br` 和跨 run 排版尚未实现；纯文本 Element 已有独立换行路径 |
| DOM 风格事件派发 | ✅[^input] | Cue pointer / keyboard / focus / value / composition / wheel 事件；捕获、冒泡、取消、once / passive |
| 基础 attach / detach / move 生命周期 | ✅[^builtin-controls] | 控件焦点、捕获和内部状态清理 |
| 完整 document 归属与 invalidation 契约 | ❌ | 当前生命周期不代表完整 DOM/document 模型 |

## 内置控件

六类控件统一位于 `packages/runtime/src/builtin-controls/`。API、提交点、部件与平台边界见 [Builtin controls](builtin-controls.md)。

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| `cue-button` | ✅[^builtin-controls] | Pointer、Enter、Space 激活；接受作者 children；无 model |
| `cue-toggle` | ✅[^builtin-controls] | boolean value；click / Space；checked 状态 |
| `cue-slider` | ✅[^builtin-controls] | number；min/max/step、水平/垂直、pointer capture 与键盘调整 |
| `cue-select` | ✅[^builtin-controls] | string / undefined；数据 options、禁用选项、候选与提交分离、有限弹层滚动 |
| `cue-text-input` | ✅[^builtin-controls] | string；单行/多行/密码/只读、placeholder、选择范围；LTR |
| `cue-number-input` | ✅[^builtin-controls] | number / undefined；草稿与有效数值分离、范围、精确步进；不输出 NaN |
| 外部 value 同步 | ✅[^builtin-controls] | 不主动发 input / change；显式交互操作另有提交语义 |
| 内部节点所有权 | ✅[^builtin-controls] | Button 以外拒绝作者 children；真实节点与稳定 class 定制 |
| `.ce.cue` / 内置控件自举 | ❌ | 本轮不实现；生产控件用 TypeScript，gallery 用 `.cue` 消费 |
| 完整 HTML form / label / validation | ❌ | 不声明浏览器 HTML 控件兼容性 |

## CSS Selector 与 Cascade

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| 单 class selector（`.item`） | ✅ | 编译、匹配与运行时更新已接通 |
| 复合 selector（`cue-slider#volume.item:hover`） | ✅[^selector-subset] | 同一元素匹配 type / ID / class / state |
| Selector list（`.a, cue-button`） | ✅[^selector-subset] | 仅匹配成功的项参与该规则的最大 specificity |
| Class 的 string / array / object Vue binding | ✅ | runtime 会归一化为 class name set |
| `!important` | ✅[^selector-subset] | 作者规则与静态 inline declaration 比较 importance |
| Specificity 与 source order | ✅[^selector-subset] | 标准 ID / class-pseudo / type 三元组；同优先级按 source order |
| 内置默认样式低来源 | ✅[^builtin-controls] | 仅普通声明，低于所有作者声明，包括通配选择器 |
| 组件样式随 mount / unmount 生效 | ✅ | 相同 stylesheet 按组件实例引用计数 |
| Type selector（`div` / `cue-button`） | ✅[^selector-subset] | 匹配真实 tagName，不改写为 class |
| ID selector（`#app`） | ✅[^selector-subset] | 匹配元素 id |
| Universal selector（`*`） | ✅[^selector-subset] | specificity 为零 |
| Attribute selector | ❌ | compiler 显式诊断 |
| Descendant / child combinator | ✅[^selector-subset] | 空格 / `>`；按真实逻辑树匹配 |
| Sibling combinator | ❌ | compiler 显式诊断 |
| 七种控件/交互 pseudo-class | ✅[^selector-subset] | hover、active、focus、focus-within、enabled、disabled、checked |
| 其他 pseudo-class / pseudo-element | ❌ | 未支持；不提供 Shadow DOM / `::part` |
| 静态 `style` attribute | ✅[^inline-style] | 编译期 Lightning CSS → IR，保留 normal / important |
| `CueElement.style` 类型化 API | ✅[^style-api] | px / %、结构化颜色、font-family 名称、longhand enum；修改与移除 |
| 动态 CSS 字符串 / Vue `:style` | ❌ | 明确不支持；使用类型化 API 或动态 class，不引入 runtime parser |
| 已支持文本属性的继承 | ✅ | color、font、line-height、text-align、white-space 与 Cue text stroke |
| 通用属性继承 / CSS-wide keywords | ❌ | 尚未实现完整 CSS 继承模型 |
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
| `border` shorthand 与四边 shorthand | ✅[^border] | 四边可分别设置 color / style / width |
| `border-color` 与四边 color longhand | ✅[^border] | 各边独立颜色；支持 `currentColor` |
| `border-style` 与四边 style longhand | ✅[^border] | 各边独立的 `none`、`solid` |
| `border-width` 与四边 width longhand | ✅[^border] | 各边独立；支持 `thin` / `medium` / `thick` / `px` |
| `border-radius` 与四角 radius longhand | ✅[^radius] | 各角水平/垂直半径独立，支持 `px`、`%` |
| `outline` / `outline-color` / `outline-style` / `outline-width` | ✅[^outline] | `solid`、`none`，不参与布局 |
| `outline-offset` | ✅[^outline] | `px` 与无单位 `0`；可为负数 |
| Logical size / margin / padding / border properties | ❌ | 尚未实现 |
| `em` / `rem` / viewport 等长度单位 | ❌ | 尚未实现 |
| `calc()` / `min()` / `max()` / `clamp()` | ❌ | 尚未实现 |
| Intrinsic size keywords | ❌ | `min-content`、`max-content`、`fit-content` 尚未实现为用户样式 |
| `position: static / relative / absolute` | ✅[^position] | 相对偏移、脱离文档流、最近 positioned / transformed containing block |
| `top` / `right` / `bottom` / `left` / `inset` | ✅[^position] | px、%、auto，包含负偏移 |
| `position: fixed / sticky`、logical inset | ❌ | 尚未实现 |
| `overflow` | ✅[^clip] | 等轴 `visible`、`hidden`、`clip` |
| Scrolling | ❌ | `overflow: hidden` 尚不提供程序化滚动，`auto` / `scroll` 尚未实现 |
| `aspect-ratio` | ❌ | 尚未实现 |

## Typography

| CSS 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| `color` | ✅[^text-raster] | RGB 颜色及 alpha；按标准继承 |
| `font-family` | ✅[^text-raster] | 标准 fallback list；可由 `loadCueFont(TTFFont / UUID)` 加载项目 TTF |
| `font-size` | ✅[^text-raster] | `px`；按标准继承 |
| `line-height` | ✅[^text-raster] | `normal` 与 `px`；按标准继承 |
| `text-align` | ✅[^text-align] | `start`、`end`、`left`、`right`、`center`；按标准继承 |
| `white-space` | ✅[^text-wrap] | `normal`、`nowrap`、`pre`、`pre-wrap`、`pre-line`；标准属性名、值与继承语义 |
| 自动换行 | ✅[^text-wrap] | 纯文本 Element 按可用 inline size 和 Unicode / CSS Text 换行机会分行 |
| 显式 segment break | ✅[^text-wrap] | 在 `pre`、`pre-wrap`、`pre-line` 中保留；在 `normal`、`nowrap` 中折叠 |
| `white-space: break-spaces` | ❌ | 尚未实现 preserved-space 的逐空格换行与行尾占位语义 |
| `overflow-wrap` / `word-break` / `line-break` / `hyphens` | ❌ | 当前使用这些属性的标准初始行为，不接受非初始值 |
| `font-weight: normal / bold / 1..1000` | ✅[^text-raster] | 测量与绘制使用相同 weight；按标准继承 |
| `font-weight: bolder / lighter`、`font-style` | ❌ | 尚未实现 |
| `-cue-text-stroke` / `-cue-text-stroke-width` / `-cue-text-stroke-color` | ✅[^text-stroke] | Cue 专有描边，不伪装成标准 text-shadow |
| `@font-face` / URL 字体加载 | ❌ | 当前通过 Cocos TTFFont asset + `loadCueFont` 加载 |
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
| Absolutely positioned flex children | ✅[^position] | 不参与 flex 占位；auto inset 使用原 formatting context 的 static position |
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
| Layout box 转换为有序 paint command | ✅ | background、border、shadow、outline、image、text、clip 按绘制顺序输出 |
| Cocos `gfx` vertex / index buffer | ✅ | `CueDocument` 动态上传圆角细分 geometry 与 texture quad |
| Cocos material / effect | ✅ | 独立 effect 绘制彩色 geometry、背景纹理、图片/文字与阴影 |
| 连续 box 命令的几何批处理 | ✅ | 按绘制顺序拆成连续批次，box、图片、文字不再强制分层 |
| `CueDocument` Cocos 生命周期接入 | ✅ | 使用 Cyclonium class / lifecycle decorators |
| Individual border sides | ✅[^border] | Taffy 使用四边独立宽度；GPU 绘制细分几何 |
| Background image | ✅[^background-image] | 单层相对或 `uuid:` `url()`；复用 Cocos 纹理资源加载链路 |
| Gradient | ✅[^gradient] | 两个不透明 RGB color stop 的横向/纵向 `linear-gradient()` |
| Outline | ✅[^outline] | 在 border box 外绘制实线轮廓，不影响布局 |
| Box shadow | ✅[^box-shadow] | 多层 outer / inset shadow；使用独立 geometry batch |
| Overflow clip | ✅[^clip] | rounded padding box stencil；支持嵌套 clip depth |
| External mask / clip-path | ❌ | 尚未实现 |
| CSS 2D transform | ✅[^transform] | 作用于元素及其后代，不改变 layout |
| `-cue-opacity` | ✅[^cue-opacity] | 0～1，祖先与子元素的值累乘后分别作用于绘制图元 |
| Web CSS `opacity` / group compositing | ❌ | 标准属性会报错；尚无离屏子树合成 |
| Positioned sibling / Flex item `z-index` paint order | ✅[^z-index] | 同父级按负层级、normal flow、positioned auto/0、正层级绘制 |
| 完整 CSS stacking context | ❌ | 尚未实现跨 subtree 的 positioned descendants / auto ancestor 排序 |
| 整文本块 texture paint | ✅[^text-raster] | 每个纯文本元素一张纹理和一个 quad |
| Glyph atlas / SDF text | ❌ | 当前阶段明确不引入 |
| SpriteFrame image paint | ✅[^cue-image] | 每个 `cue-image` 使用 SpriteFrame texture / UV 绘制一个 quad |
| Nine-slice image paint | ❌ | 尚未实现 |
| Material / texture / clip batch splitting | ✅ | 按有序 paint command 连续拆分 box、shadow、background texture、image、text 与 stencil clip |
| Partial paint rebuild / dirty propagation | ❌ | 当前每帧重新计算 layout 与上传 vertex buffer |

## Input、Animation 与 Accessibility

| 能力 | 状态 | 当前边界 |
| --- | :---: | --- |
| Hit testing | ✅[^input] | 按绘制顺序逆向选择；2D transform、圆角和祖先 overflow clip |
| `pointer-events: auto / none` | ✅[^input] | 继承，后代可显式 auto 恢复命中；不影响捕获／冒泡路径 |
| Web 鼠标／触摸 Pointer Events / pointer capture | ✅[^input] | CueDocument 接入；click、边界事件、捕获与取消清理 |
| Native / pen input backend | ❌ | 尚未验证／实现 |
| Vue 原生事件与修饰符 | ✅[^input] | 传播、键盘 alias、系统键/exact、pointer 按钮过滤；非法组合明确诊断 |
| Wheel event / Select 局部列表滚动 | ✅[^builtin-controls] | Web wheel 接入；不等于通用 CSS scroll container |
| 通用 scrolling | ❌ | overflow auto/scroll 与完整滚动 API 未实现 |
| 内置控件 focus navigation | ✅[^builtin-controls] | focus/blur、Tab/Shift+Tab、tabIndex、禁用与移除清理 |
| Web keyboard 与 Cocos EditBox 共存 | ✅[^builtin-controls] | 真实 Chromium 键盘/文本操作已验证 |
| Web 编辑与 composition 桥接 | ✅[^builtin-controls] | 隐藏 input/textarea；Cue 绘制文本/选择/光标，model 忽略 composing 草稿 |
| OS IME 人工验收 | ❌ | 未完成真实候选窗、提交/取消及目标设备验收 |
| Native 编辑后端 | ❌ | 尚未实现 |
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
| Decoration playground 可视化验收 | ✅[^decoration-gallery] | 独立页面组合验收 border、radius、outline、shadow、background、overflow、transform 与 `-cue-opacity` |
| Position playground | ✅ | 独立页面验证 relative、absolute、四边偏移与定位祖先 |
| Style API playground | ✅ | 独立页面验证类型化进度/颜色更新、优先级与清除覆盖 |
| Input playground | ✅[^input] | 独立页面验收点击、hover、传播、捕获、穿透、旋转与裁剪；原生 Cocos UI 控制面 |
| 六类独立控件 gallery | ✅[^builtin-controls] | 默认/自定义外观、独立值、事件日志和重挂载；导航/控制面仍用 Cocos UI |
| 控件 Chromium keyboard / mouse / text 回归 | ✅[^builtin-controls] | 真实操作与 Cocos EditBox 共存；不替代 OS IME 人工验收 |
| Toggle / Slider touch Preview 回归 | ✅[^builtin-controls] | 页面启用触摸并断言 pointerType=touch；Toggle 激活与 Slider 越界捕获 |
| Game UI Showcase | ✅ | 独立 Cocos 项目，case registry + tabs；首个 `player-profile` case |
| Flex playground 自动几何断言 | ❌ | 当前以人工可视化验收为主 |
| Grid gallery | ❌ | Grid 尚未实现 |
| Production Web smoke | ❌ | 尚未形成发布 Gate |
| Native smoke | ❌ | 尚未建立 Native backend 结论 |
| Visual regression suite | ❌ | 尚未实现 |
| Performance / bundle-size baseline | ❌ | 尚未建立可重复测量 |

## 已知 CSS 差异脚注

[^input]: 当前面向 Cocos / Vortex 3.8 Web Preview；真实 Chromium 鼠标和触摸已经验证，不宣称完整 DOM／Pointer Events conformance。CueDocument 集中接入 host backend，原生 UI 优先于普通 Cue 命中，捕获指针优先返回 Cue。控件 focus、keyboard、wheel 与 Web 编辑见 [Builtin controls](builtin-controls.md)，不把 composition 自动测试当作 OS IME 人工验收。命中仍受当前 paint/stacking-context 范围限制。坐标、清理和引擎接口边界见 [Input](input.md)。

[^builtin-controls]: 六控件为真实 CueElement，统一以 TypeScript 实现，不引入 `.ce.cue` 自举、运行时 compiler 或 CSS parser。默认普通声明低于作者样式；部件是普通节点与稳定 class，不是 `::part`。compiler/runtime 全量测试及真实 Chromium keyboard/mouse/text/Cocos EditBox 共存已通过；touch 回归确认 Toggle 和 Slider 的实际 touch 事件。文本仅声明 Web Preview / LTR。OS IME 人工验收、Native、production smoke、长期资源释放和用户明确验收仍保留。详见 [Builtin controls](builtin-controls.md)。

[^inline-style]: 静态 attribute 仅在编译期使用 Lightning CSS；inline normal 高于 stylesheet normal、低于 stylesheet important，inline important 高于 stylesheet important。支持范围同静态 stylesheet，没有 runtime CSS parser。

[^style-api]: `CueElement.style` 是类型化 longhand API，不是 CSS 文本接口。长度用 px 数值 / `Length.px` / `Length.percent`，保留属性合法的 keyword；只支持 px 的字段不接受百分比。`lineHeight` 不接收无单位 number，防止把 CSS 倍数当作 px。API 值覆盖静态 normal，不覆盖静态 important；赋 undefined 移除覆盖。动态资源仅接受已规范化 UUID，CSS variables 与完整 CSS-wide keywords 未实现。详见 [Style API and fonts](style-bindings-and-fonts.md)。

[^position]: 仅支持当前 LTR Block/Flex 子集，绝对定位的百分比以 containing block 的 padding box 为基准；relative 只改变自身及子树的绘制位置，不改变后续兄弟的流内占位。绝对定位寻找最近非 static 或带 transform 的祖先；无此祖先时使用 CueDocument 的 UITransform 尺寸（纯 runtime 调用可传 viewport）。完整 CSS stacking context、fixed / sticky、writing modes 尚未实现。

[^text-stroke]: 这是 Cue 自有扩展，三个属性均继承。`-cue-text-stroke` 接受非负 px 宽度及支持的 CSS 颜色；省略宽度重置为 0，省略颜色重置为 currentColor。采用 Canvas 的居中圆角 stroke 后 fill；纹理会为笔画/描边外溢扩边，layout advance 与 line-height 不随描边变大。它不是 CSS text-shadow，也不提供外侧-only 描边。

[^display]: Cue 当前只实现 block-level `display: block` 与 `display: flex`。标准 CSS 的初始值 `inline`、`inline-flex`、`none`、list-item、table 等 display 类型尚未支持；block layout 也尚无 inline formatting、float、margin collapsing 等完整浏览器语义。非 `div` 元素若未显式声明已支持的 display，会在布局阶段报错。

[^selector-subset]: 当前支持 type、ID、class、universal、compound/list、descendant/child 及表中七种状态，按标准三元组比较 specificity。未支持 attribute、sibling、其他 pseudo selector、namespace 或 Shadow DOM；这不是完整 CSS。Style IR 保持 version 1，但旧 class-string selector 产物须重新编译，不提供兼容兜底。

[^lengths]: 对外仍使用标准 CSS 属性和值写法，但当前 Style IR 只保留 `px`、`%` 以及该属性合法的 `auto` / `none`。其他合法 Web CSS 单位、数学函数与 intrinsic keywords 会被忽略，且尚无 diagnostic。

[^colors]: Lightning CSS 可以解析更广的 Web CSS color 语法，但 Cue 当前只保留它输出为 RGB 的颜色；border、outline 与 shadow 支持 `currentColor`，system color、wide-gamut color 等语义尚未实现。

[^border]: Cue 当前按四边独立宽度、颜色与 `none` / `solid` 样式生成几何；`dotted`、`dashed`、`double`、`hidden` 等其他合法 Web CSS 边框样式尚未接入，会被忽略。

[^radius]: Cue 支持 `px` 和相对 border box 宽高的百分比椭圆圆角，超出 box 的半径按 CSS 比例缩小原则归一化；其他 Web CSS 长度单位与数学函数尚未实现。当前圆弧使用有限细分几何，抗锯齿质量仍待视觉验收。

[^outline]: Cue 以独立 geometry 在 border box 外绘制 `solid` outline，支持 px 宽度及 px `outline-offset`；outline 不参与布局。`auto`、`dashed`、`dotted` 等其他合法值尚未接入。

[^flex-engine]: Cue 把当前 Style IR 映射到 Taffy 2.0.3，而不是浏览器 layout engine。没有 intrinsic measurement、inline/text layout、writing mode 和 Web Platform conformance 结果，因此只声明表中列出的 box-level 子集。

[^flex-basis]: `flex-basis` 暂只保留 `px`、`%`、`auto`；`content`、intrinsic keywords 和依赖内容测量的标准行为未实现。若 `flex` shorthand 的 basis 超出该子集，当前会忽略整项 shorthand，且尚无 diagnostic。

[^order]: 标准 CSS 的 `order` 只改变视觉顺序，不应改变逻辑与无障碍顺序。Cue 当前同时按 `order` 排序 layout record 与 paint traversal；accessibility tree 尚未实现，后续必须保持标准逻辑顺序语义。

[^alignment-values]: Cue 保留标准 CSS 名称和值，但目前只接通表中列出的 Box Alignment 子集；`safe` / `unsafe`、self-position 扩展值与完整 fallback 规则尚未实现。

[^baseline]: `baseline` / `first baseline` 能被 parser 接受并映射到 Taffy，但 Cue 没有 glyph、line box 或 custom element baseline 测量，所以当前只对无文本 box 使用 Taffy fallback，不能宣称完整 Web CSS baseline alignment。

[^text-raster]: 当前是过渡性的 Web Preview 文本路径：只处理没有 Element 子节点的纯文本 Element，将整块文字用 Canvas 2D 动态栅格化为 RGBA 纹理，再由 Cocos GFX 绘制一个 quad。字体与颜色使用标准 CSS 属性名和继承语义；没有混合 inline formatting context、glyph atlas、SDF 或 Native 支持声明。文本、排版宽度或继承样式变化时会重建该文本块纹理。

[^text-align]: Cue 尚未实现 CSS `direction`，当前使用 Web CSS 的默认 LTR 方向，因此 `start` 等价于 `left`、`end` 等价于 `right`；物理值 `left`、`right` 与方向无关。

[^text-wrap]: Cue 先按 `white-space` 处理 segment break、可折叠空白和 tab，再用 `css-line-break` 的 CSS Text Level 3 tailoring / Unicode UAX #14 换行机会配合 Canvas 实测宽度选择 soft wrap。当前只覆盖纯文本 Element；尚无 `lang` / `line-break` tailoring。保留模式下的 tab 使用 CSS 初始 `tab-size: 8` 的像素停靠近似，`pre-wrap` 的行尾 hanging-space 几何也尚未单独建模，因此这两项不能视为完整浏览器一致性。

[^cue-image]: `cue-image` 是 Cue 自有元素，不声明 Web `<img>` 兼容性。静态 `src` 只接受相对 `.cue` 文件的路径或 `uuid:<SpriteFrame UUID>`；动态 `src` 当前只接受 `uuid:`。相对路径由宿主读取 Cocos `.meta`，且必须唯一对应一个 `sprite-frame` subasset。资源异步加载后以 SpriteFrame `rect` 作为固有尺寸；只指定一边时保持该比例，两边都指定时拉伸到 content box。尚无 URL、data URL、`object-fit`、裁剪或 nine-slice 语义。

[^background-image]: 对外语法仍是 Web CSS `background-image: url(...)`。当前只接受一层相对路径或 `uuid:` URL；相对路径由 compiler host 规范化为 Cocos `Texture2D` UUID。绘制使用 Web CSS 初始的 `background-repeat: repeat`、`background-position: 0% 0%`、`background-origin: padding-box`、`background-clip: border-box` 和 auto 固有尺寸。显式 repeat / position / size / origin / clip、多层图片、远程 URL 与 nine-slice 尚未实现。

[^gradient]: 当前 gradient 子集为两个无显式位置、不透明 RGB color stop，以及 `to top` / `right` / `bottom` / `left` 四种方向。斜向、角度、透明 stop、多 stop、显式 stop position、repeating 与 radial / conic gradient 会被拒绝，不会被重解释。

[^box-shadow]: Cue 保留标准 `box-shadow` 名称、层叠顺序、offset、blur、spread、color 与 `inset` 含义；当前长度只接收 px。渲染器使用与元素圆角一致的细分 geometry 和 shader feather 近似浏览器 blur 核，因此边缘采样不会逐像素等同于某一浏览器实现。

[^clip]: `overflow: hidden` 与 `overflow: clip` 当前都裁剪到 rounded padding box；内容及后代通过嵌套 stencil depth 裁剪，元素自身 background、border、outline 与 outer shadow 不受该内容 clip 影响。Cue 尚无 scroll offset / scroll container API，因此不把 `hidden` 声明为完整滚动语义。

[^transform]: 当前接受 `translate*`、`rotate` / `rotateZ`、`scale*`、`skew*` 与 2D `matrix()`，translation 和 `transform-origin` 只接受 px / percentage。3D transform、perspective、`transform-box` 和独立 transform properties 尚未实现。

[^cue-opacity]: 这是经明确选择的 Cue 专有属性，不是 Web CSS `opacity` 的别名。它不继承，但渲染时将祖先与当前元素的 `-cue-opacity` 数值累乘，并分别调整背景、边框、outline、阴影、图片与文字图元的 alpha；子元素重叠处会透出下层，行为接近 Unity UI Toolkit USS opacity。标准 CSS `opacity` 对子树整体合成，Cue 尚未实现，所有值都会产生 compiler error。

[^z-index]: 当前实现同父级 positioned elements 与直接 flex items 的绘制顺序：负整数层级在 normal flow 前；positioned `auto` / `0` 和显式 `z-index: 0` 的 flex item 在 normal flow 后；正整数层级最后绘制，同层保持原有顺序。非 flex 的 static 元素不应用 `z-index`。完整 stacking-context tree、positioned descendants 和 auto ancestor 的跨 subtree 排序尚未实现。

[^decoration-gallery]: Decoration playground 位于独立 examples 仓库，以 Cocos UI 作为控制面，编译产物写入 ignored 目录；它用于人工视觉验收，不等同于像素级 conformance suite。
