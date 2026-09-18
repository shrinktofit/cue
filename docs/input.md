# Input

CueDocument 接入宿主输入并进行命中测试；事件随后沿 CueElement 的逻辑父链传播。元素不会为输入创建 Cocos Node。

## 当前接口

```vue
<div @pointerdown="beginDrag" @pointermove="drag" @pointerup="endDrag" @click.stop="activate" />
```

- `CueEvent` / `CuePointerEvent`：`target`、`currentTarget`、`eventPhase`、`composedPath()`、`preventDefault()`、`stopPropagation()`、`stopImmediatePropagation()`。
- `CueElement.addEventListener/removeEventListener/dispatchEvent`；listener options 支持 `capture`、`once`、`passive`。
- `setPointerCapture(pointerId)`、`releasePointerCapture(pointerId)`、`hasPointerCapture(pointerId)`。只能捕获当前按下且属于本 document 的指针；捕获的后续输入不再依赖元素命中范围。
- Pointer 事件：down / move / up / cancel / over / out / enter / leave、gotpointercapture / lostpointercapture，以及主按钮 `click`。
- Vue 修饰符：`.stop`、`.prevent`、`.self`、`.once`、`.capture`、`.passive`。`.passive.prevent` 会报错。原生动态事件名、原生 `v-on` 对象和未实现事件会在编译期报错；组件自定义 emit 不受原生事件列表限制。
- 内置控件由 CueDocument 管理焦点、Tab 导航、键盘、wheel 与 Web 文本编辑事件。公开 `focus()` / `blur()`、`CueDocument.activeElement`、模型及按键修饰符契约见 [`builtin-controls.md`](builtin-controls.md)。

## 坐标与命中

- `clientX/clientY` 是浏览器 viewport CSS 坐标，左上原点。
- `offsetX/offsetY` 是相对 **target** padding 左上角、去除 transform 后的 Cue 布局坐标；冒泡时不会改成 currentTarget 的坐标。
- `clientWidth/clientHeight` 是最近一次完成布局的 padding-box 尺寸，不含 border，单位为 Cue 布局 px。尚未布局时为 0。
- 命中采用与绘制一致的顺序、2D transform、圆角 border box 和祖先 overflow clip。透明背景和 `-cue-opacity: 0` 不会自动禁用命中；shadow / outline 外溢不扩大命中区。
- `pointer-events: auto | none` 按 CSS 继承。父级 none 的后代默认也不命中，后代显式 auto 可以恢复命中；父级仍可参与该后代事件的捕获和冒泡。
- `CueRootElement` 只作为传播根，不额外吞掉整个 viewport 的输入。

例如进度条可将装饰后代设为 `pointer-events: none`，在轨道监听器里使用 `event.offsetX / event.currentTarget.clientWidth` 得到进度，并在 pointerdown 捕获该指针。

## 宿主边界

当前输入 backend 面向 Cocos / Vortex 3.8 的 Web Preview 鼠标和触摸。Cocos 原生 UI 优先于普通 Cue 命中；Cue 已捕获的指针在拖动期间优先返回捕获目标。Cocos 会将鼠标先模拟为触摸，backend 按正在派发的浏览器事件来源区分，避免双重派发。

该仲裁通过引擎的 `_registerEventDispatcher` 接口集中在 host 层完成；这是需要引擎版本 smoke 验证的内部接口，不属于 Cue 元素 API。卸载、禁用 document、窗口失焦与宿主取消输入会释放按下／捕获状态。

已提供真实 `:hover` / `:active`、焦点及控件状态 selector。Web keyboard 与隐藏编辑载体已接通，可见文本、光标和选区仍由 Cue 绘制；与 Cocos EditBox 的焦点切换已有实际 Preview 回归。wheel 支持派发和 Select 局部滚动，不等于通用 CSS scrolling。

尚未实现：Native 输入/编辑 backend、触控笔字段、通用 scroll 默认行为、手势仲裁和完整 DOM 事件体系。composition 链路已实现，但真实操作系统 IME 候选窗、提交/取消仍待人工验收。多 document 的输入按相机优先级选择，不声明完整跨 document CSS stacking 语义。

验收入口：examples 的 `basic` → **Input**、下方 **CONTROLS** 六个独立 gallery，以及 `game-ui-showcase` → **Player Profile** 的头像和经验条。
