# Cue 内置控件

更新日期：2026-09-18

本轮提供六类原生 `CueElement` 控件，统一位于 `packages/runtime/src/builtin-controls/`，通过 `globalElementRegistry` 创建。它们拥有真实元素身份，CSS type selector 匹配实际 `CueElement.tagName`。

实现使用 TypeScript，不引入 `.ce.cue`、内部 SFC 自举或运行时 compiler。Gallery 用 `.cue` 消费控件。当前交付面向 Cocos / Vortex 3.8 Web Preview，不声明完整 HTML 控件、DOM 或 CSS 兼容性。

## 公开 API

| 控件 / 元素类型 | 标签与实现目录 | 值与初始值 | 专有 API |
| --- | --- | --- | --- |
| Button / `CueButtonElement` | `cue-button` / `button/` | 无 model | 作者 children 作为内容；`click` 激活 |
| Toggle / `CueToggleElement` | `cue-toggle` / `toggle/` | `value: boolean`，初始 `false` | `:checked` 反映当前值 |
| Slider / `CueSliderElement` | `cue-slider` / `slider/` | `value: number`，初始 `0` | `min = 0`、`max = 100`、`step = 1`；`orientation: CueSliderOrientation` 为 `horizontal` / `vertical` |
| Select / `CueSelectElement` | `cue-select` / `select/` | `value: string \| undefined`，初始 `undefined` | `options: readonly CueSelectOption[]`；JS 属性 `open: boolean` |
| TextInput / `CueTextInputElement` | `cue-text-input` / `text-input/` | `value: string`，初始空字符串 | `multiline = false`、`password = false`，二者不能同时开启 |
| NumberInput / `CueNumberInputElement` | `cue-number-input` / `number-input/` | `value: number \| undefined`，初始 `undefined` | `min` / `max` 可为 `undefined`；`step = 1`；`stepUp(count = 1)` / `stepDown(count = 1)` |

六类控件共有 `disabled: boolean`、`tabIndex: number`、只读 `focused`，以及 `focus()` / `blur()`。模板可用 `disabled` / `:disabled` 和 `tabindex` / `:tabindex`。禁用控件不参与正常用户激活；焦点、捕获与按下状态随树生命周期清理。

TextInput 与 NumberInput 共有 `placeholder`、`readOnly`、只读 `selectionStart` / `selectionEnd` / `selectionDirection`，以及 `select()`、`setSelectionRange(start, end, direction?)`。模板只读状态使用 `readonly` / `:readonly`。选择偏移使用 UTF-16 索引，并吸附到合法编辑边界。本期只声明 LTR 编辑，不声明 bidi / RTL 光标与选择行为。

Select 的选项是数据，不是作者 `<option>` 子节点：

```ts
interface CueSelectOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}
```

选项 value 必须唯一。`undefined` 表示未选择；键盘候选项与已提交 value 分离，移动候选不会立刻提交。有限弹层内的选项滚动不等于通用 CSS scrolling。

NumberInput 分开保存编辑文本与数值。空文本对应 `undefined`；`-` 等中间态不会变成 `NaN` 或伪装成 `0`。提交时恢复合法文本并应用 min/max；step 必须为正有限数。`stepUp()` / `stepDown()` 是显式操作，会按操作契约产生事件；直接赋 `value` 是外部状态同步。

Button 接受作者文本或子元素。其余五种控件拥有内部子树，不接受作者 children，renderer 会明确拒绝。应用可用 CSS 定制部件，但不能自行插入、删除或重新挂载控件管理的节点。Button 的混合文本/元素排版仍受当前 Cue inline formatting 支持范围限制。

## 模型与事件

```vue
<script setup lang="ts">
import { ref } from '@bsgames/cue';
const enabled = ref(false);
const volume = ref(30);
const choice = ref<string>();
const title = ref('Player');
const amount = ref<number>();
</script>

<template>
  <div>
    <cue-toggle v-model="enabled" />
    <cue-slider id="volume" v-model="volume" :min="0" :max="100" :step="5" />
    <cue-select v-model="choice" :options="[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]" />
    <cue-text-input v-model="title" placeholder="Name" />
    <cue-number-input v-model.lazy="amount" :min="0" :max="10" :step="0.5" />
    <cue-button>Apply</cue-button>
  </div>
</template>
```

原生 model 契约来自 compiler/runtime 共用的 `packages/control-schema`。默认 `v-model` 绑定 `value`，在 `input` 时把 `event.value` 赋回模型；`.lazy` 改为监听 `change`。Button 不支持 model；原生 model 参数和 `.number`、`.trim` 等其他修饰符产生编译诊断。组件级 `v-model` 仍遵循 Vue 组件契约。

`CueInputEvent<T>` 提供 `value`、`isComposing`，`CueChangeEvent<T>` 提供 `value`。原生监听器收到事件对象，不是 Vue emit 的直接值参数。默认 model 忽略 `isComposing: true` 的临时值，composition 完成后通过非 composing input 同步。显式 `@input` 仍可观察 composing 事件。

| 控件 | 用户操作与提交 |
| --- | --- |
| Button | Pointer 激活、Enter、Space 产生 `click`；取消/禁用不误激活 |
| Toggle | Click / Space 切换，一次操作依次产生 `input`、`change` |
| Slider | 拖动/键盘调整期间发 `input`，完成时发 `change`；捕获取消不伪造完成 |
| Select | 移动候选不改 model，确认后发 `input`、`change`；Escape/关闭不提交候选 |
| TextInput | 编辑发 `input`，失焦或适用的 Enter 操作提交 `change`；多行 Enter 用于换行 |
| NumberInput | 编辑保留合法值与草稿，提交/步进产生相应事件，不输出 `NaN` |

外部 `value` 赋值、父组件 model 更新和范围/选项同步不冒充用户输入，不主动发 `input` / `change`。程序化派发事件是显式动作，不能作为真实平台输入已验证的证据。

原生事件支持 Pointer Events、`click`、`keydown` / `keyup`、`focus` / `blur` / `focusin` / `focusout`、`beforeinput`、`input` / `change`、composition 三事件及 `wheel`。传播修饰符为 `.stop` / `.prevent` / `.self` / `.once` / `.capture` / `.passive`；键盘支持 `.enter`、`.tab`、`.delete`、`.esc`、`.space`、方向键和 `.ctrl` / `.shift` / `.alt` / `.meta` / `.exact`。

`.passive.prevent` 被拒绝；按键修饰符用于 `keydown` / `keyup`。按钮过滤使用 `pointerdown.left/middle/right` 或 `pointerup.left/middle/right`；`click.right/middle` 被诊断，避免 Vue 改写成未实现的 contextmenu/auxclick。Cue 不生成或使用 Vue DOM 的 `vModelText` 等指令。

## 样式、状态与部件

内置默认样式是低于作者样式的普通声明来源，作者通配选择器也能覆盖默认值；默认来源不使用 `!important`。作者 stylesheet、静态 inline style 和类型化 `element.style` 按既定 cascade 比较 importance、inline 优先级、specificity 与 source order。

支持 type、ID、class、通配、复合选择器、selector list、后代空格与子元素 `>`。Specificity 使用标准 `(ID, class/pseudo-class, type)` 三元组，不把 `cue-slider` 改写成 class。状态包括 `:hover`、`:active`、`:focus`、`:focus-within`、`:enabled`、`:disabled`、`:checked`，依据运行时真实状态；普通 div 的 disabled 属性不会赋予控件语义。

```css
cue-button { background-color: #2455a0; }
cue-button:focus { outline: 2px solid white; }
cue-toggle:checked .cue-toggle-track { background-color: #16825d; }
#volume > .cue-slider-thumb { background-color: white; }
.compact cue-select .cue-select-option:checked { color: #70d4ff; }
cue-text-input .cue-input-caret { background-color: #ffffff; }
```

内部部件是真实普通子节点，以稳定 class 暴露：

| 控件 | 部件 class |
| --- | --- |
| Button | 无强制皮肤节点，内容由作者 children 提供 |
| Toggle | `.cue-toggle-track`、`.cue-toggle-thumb` |
| Slider | `.cue-slider-track`、`.cue-slider-fill`、`.cue-slider-thumb` |
| Select | `.cue-select-label`、`.cue-select-arrow`、`.cue-select-popup`、`.cue-select-options`、`.cue-select-option` |
| TextInput / NumberInput | `.cue-input-viewport`、`.cue-input-text`、`.cue-input-placeholder`、`.cue-input-selection`、`.cue-input-caret` |

占位符同时带有 `.cue-input-text` 和 `.cue-input-placeholder`；真实输入文本不带后者。占位符默认透明度属于低优先级皮肤，可由作者 CSS 覆盖；自定义字体与行高参与实际测量。

这些 class 不是 Shadow DOM `::part`，不提供样式隔离；用宿主 class/ID 与后代选择器限定实例。Select 弹层提升绘制层级仍保留逻辑父子关系。运行时管理滑块位置、光标、选区和局部滚动等交互几何，公开部件不等于任意可编辑的 DOM。

CSS 只在构建期由 Lightning CSS 编译为 Style IR。schema version 仍为 `1`，本轮 selector IR 已升级，旧 class-string 产物必须重新编译，无兼容兜底。运行时没有 CSS parser；动态更新使用 class 或类型化 `element.style`。属性选择器、sibling combinator、其他 pseudo-class、pseudo-element、CSS variables、完整继承/层叠和 Shadow DOM 尚未提供。

## Web 编辑载体与平台边界

可见文字、选区和光标由 Cue 绘制。Web 宿主用隐藏 `input` / `textarea` 接收浏览器编辑、selection 与 composition，再同步到当前 Cue 控件；不是用可见 DOM input 代替控件。单行/密码与多行模式使用相应载体，NumberInput 使用 decimal input mode。

键盘与编辑焦点同 Cocos EditBox 协调，只向当前编辑目标送入文本。控件切换、移除、禁用和失焦时同步或清理载体；组合输入期间避免误激活其他控件。

当前边界是 Web Preview 与 LTR。composition 链路及自动测试不等于操作系统 IME 已人工验收；中文候选窗、实际提交/取消及目标设备输入法体验仍需人工检查。Native 编辑后端尚未实现，不声明 Native 输入或跨平台字体/选择一致性。

## Gallery 与验证

独立 examples 仓库的 `basic/src/button/`、`toggle/`、`slider/`、`select/`、`text-input/`、`number-input/` 各有独立 `.cue` gallery。每页比较默认/自定义外观，分别保存实例状态，记录事件顺序，以 Cocos UI 控制 disabled、外部值、模式、宽度和重挂载。导航及控制面仍用 Cocos UI。

本轮已验证 compiler/runtime 全量测试，以及 Chromium 中真实键盘、鼠标、文本输入和 Cue 编辑器与 Cocos EditBox 共存。编译挂载测试覆盖模型类型、`undefined`、composition guard、`.lazy`、额外监听器、外部同步与卸载。

Touch Preview 回归也已通过：页面加载前启用触摸能力，断言 Cue 收到 `pointerType === 'touch'`，覆盖 Toggle 激活与 Slider 越界 pointer capture，排除只验证到合成 mouse 事件的情况。

OS IME 人工验收、Native 后端、production Web 发布 smoke、长期资源释放与完整视觉回归仍保留为 Gate。Gallery 可运行不等于这些 Gate 已关闭，也不替代用户对本轮交付的明确验收。
