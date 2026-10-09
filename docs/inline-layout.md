# Horizontal inline layout

Cue 的文本不再是“元素内容区中的一个固定文本块”。Block/Flex 继续由 Taffy
负责；一段行内内容由 Cue 形成 line boxes，再把高度和 intrinsic widths 交回 Taffy。
作者的 CueNode 树不变，匿名盒、逐行 fragment 和测量树只存在于内部布局表示。

## 当前链路

- 连续裸文本与嵌套 `span` 共享空白处理和换行机会；span 边界不自动断词。
- 每行保留父元素 strut，并从字体 ascent/descent、line-height 计算 baseline 和 leading。
- `br` 强制断行；`inline-block` 与 `cue-image` 是不在内部拆行的 atomic inline。
- `vertical-align` 接受 baseline、middle、top、bottom、text-top、text-bottom、sub、super、px、%。
  百分比以该元素的 line-height 为基准。sub/super 使用 Blink 同类的父字号位移策略。
- Block child 打断 inline flow 时生成匿名块；Flex 内连续裸文本形成匿名 flex item。
  匿名盒不成为 selector / event target，也不改写 Vue 维护的 children。
- 字符 run 与 inline decoration 生成逐行绘制记录。事件身份仍指向原 CueElement；
  作者祖先的相对定位和 `-cue-opacity` 不因匿名盒而丢失。
- Canvas 字体测量与绘制均启用相同 kerning；host 允许一个元素对应多个文本纹理槽。
- Button 的裸文本由匿名 flex item 接受 `align-items:center`；Select 的 label/arrow
  也通过真实 Flex 布局居中，不依赖固定文字 Y 偏移。

## 断词与缩字

- `overflow-wrap: normal | anywhere`：anywhere 先使用正常换行点，整词仍放不下时才在 grapheme 边界拆开；这些机会也计入 min-content。
- `word-break: normal | break-all`：break-all 不优先保留整个单词，允许直接在词中折行；并非无视 Unicode 标点规则的任意切割。
- 两者均继承，`white-space: nowrap / pre` 仍禁止软换行，组合字符与 emoji 序列不拆开。
- `text-fit: none | shrink`：按 CSS Text Level 5 草案，先换行再缩字，默认所有行采用同一个最小缩放因子。需要单行标签时使用 `white-space: nowrap; text-fit: shrink`。
- 缩字不改变作者/computed `font-size` 或 intrinsic widths；固定 px 行高、inline 边距/边框/内边距和图片/inline-block 尺寸保持不变。`line-height: normal` 使用缩小后的字体度量。行尾空白不触发额外缩字；字体 hinting 引起的非线性宽度会经过重测。
- `.cc.vue` 中由 Lightning CSS 在编译时解析；运行时通过 `element.style.overflowWrap / wordBreak / textFit` 和对应枚举修改，设为 `undefined` 清除覆盖，不加载 CSS parser。
- 当前不支持 grow、per-line、百分比缩放下限或可编辑输入框的自动缩字，不将草案子集描述为完整 CSS Text 5。

## 验证

`packages/runtime/test/inline-layout.test.ts` 通过生产 paint-list 入口验证匿名盒与控件行为。
`packages/runtime/test/verify-inline-layout.ts` 使用共享 Playwright 和真实 Canvas 字体，
比较同一内容在 Chromium DOM 与 Cue 中的字形位置、baseline 和容器高度；允许
浏览器亚像素量化带来的 0.6px 差异，不把截图肉眼判断当作几何断言。
另有真实 Canvas 字体的缩字不溢出、固定行高与跨行比例断言。Chromium 148 实验性
text-fit 会缩放固定行高、Range 返回未缩放矩形，不能用这一旧行为替代当前草案。
`text-fitting.test.ts` 通过生产绘制入口验证断词优先级、grapheme、固定 atomic/inline edges、
多行缩放、重设宽度和 retained layout 的样式失效，以及 nowrap/空白/空 span 边界与
min-content 测量对应行高。

```powershell
node packages/runtime/test/verify-inline-layout.ts U:/AgentTools/playwright/node_modules/playwright
```

examples 的 Text Playground 提供 mixed baselines、cross-span wrapping、inline-block + image、
block interruption、anonymous flex text 五种样例，可组合宽度、字体、line-height 和 vertical-align。
Button/Select 与 TextInput/NumberInput 的真实预览回归独立保留。

## 未完成边界

这不是完整浏览器 inline engine，也不宣称“所有 CSS 文本功能已实现”：

- RTL/bidi、vertical writing、float、ruby、分页不在本轮范围。
- 字体 fallback、跨样式 run 的连字/kerning/shaping、完整 Unicode segment-break tailoring
  尚无完整 conformance 结果；normal line-height 是当前 UA 策略。
- Inline 多行 fragment 的复杂背景/圆角/outline 连续性、所有 positioned-inline 百分比及
  跨行 containing-block 组合仍需专项实现与对照。
- Flex text baseline 尚未接入底层 Taffy 回调；inline baseline 正确不等于 Flex baseline 完成。
- 输入编辑器的 caret/selection 仍使用专门布局路径，尚未统一为可编辑富文本。
- Native、完整 WPT、长段文字性能、长期纹理释放和跨平台字体一致性仍为验证 Gate。

规范依据：[CSS 2.2 inline formatting](https://www.w3.org/TR/CSS22/visuren.html#inline-formatting)、
[line-height / vertical-align](https://www.w3.org/TR/CSS22/visudet.html#line-height)、
[anonymous flex items](https://www.w3.org/TR/css-flexbox-1/#flex-items)、
[CSS Text 3 line breaking](https://www.w3.org/TR/css-text-3/#line-breaking)、
[CSS Text 5 text-fit 草案](https://drafts.csswg.org/css-text-5/#text-fit)。
