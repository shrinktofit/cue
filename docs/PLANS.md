# Cue 开发计划

状态：待推进 Phase 0 契约与技术验证
目标运行环境：Cocos Creator / Vortex 3.8
文档日期：2026-09-04

## 1. 项目定位

Cue 是一套面向 Cocos Creator / Vortex 的 Vue 3 运行时 UI 系统及其配套扩展。它不把 Vue 模板映射为传统 Cocos UI Node/Component 树，而是维护独立的 retained-mode `UIElement` 树，仅通过少量 `UIPanelHost` Cocos Component 接入场景生命周期、输入和渲染提交。

目标链路为：

```text
.cue SFC
  -> Cue compiler
  -> JavaScript render function + versioned style/asset metadata
  -> oh-my-script build/runtime
  -> Vue 3 custom renderer
  -> UIElement tree
  -> cascade / computed style
  -> Taffy + inline layout
  -> paint list / batching / clipping
  -> Cocos render backend
```

本计划补充原始设计报告没有展开的 compiler、language-service、扩展工程化、发布与验证方案。运行时设计仍以原始报告为准。

## 2. 资料优先级与已验证事实

### 2.1 资料优先级

遇到冲突时按以下顺序判断：

1. `C:\Users\lesli\Downloads\粘贴的 markdown (1)。md` 中的设计结论。
2. 本仓库后续确认的 ADR 和本计划。
3. `U:\Repos\Bluesquall\cc-plus` 的工程结构、SFC compiler 和 Volar 接入经验。
4. `U:\Repos\Bluesquall\RoboTimes` 的 Cyclonium、Vortex 扩展、OMS 和测试模式。
5. `U:\Repos\shrinktofit\cyclonium` 的源码仅用于理解 API；Cue 必须依赖已发布版本。
6. `U:\Repos\Bluesquall\oh-my-script-examples` 的真实项目和隔离测试组织方式。

### 2.2 当前未完成事项

- `cc-extension-cue-examples` 当前也为空目录。
- 首轮功能实现仍需先确定 runtime helper、OMS compiler extension 和跨项目 ABI。

### 2.3 从早期 Cue 实现保留与舍弃的内容

可以保留的经验：

- runtime / compiler / language-service 分包。
- 使用 `@vue/compiler-sfc` 解析 `.cue`。
- 通过 `runtimeModuleName` 把模板 helper 指向 Cue runtime。
- 使用 `@vue/language-core` 让 `.cue` 参与 Vue/TypeScript 语言服务。
- 用独立 example fixture 同时验证 `vue-tsc` 和编译结果。

不能迁移的设计：

- `<Node>`、`<UITransform>`、`<Sprite>` 等模板元素直接生成 Cocos Node/Component。
- 从 `cc` 类型自动生成全部 Component 标签和 props。
- `CueComponentAsset` 挂载传统 Cocos 节点树的运行时模型。

新的模板原语必须是设计报告定义的 `div`、`span`、文本、`br`、`img` 及后续标准 Web 风格控件；Cocos 只存在于 panel host 和 backend 边界。

### 2.4 当前依赖事实

2026-09-04 从 registry 查询到的版本快照如下。新增或升级依赖时仍需重新查询并进行兼容性验证，不能把“最新版”直接等同于“已兼容”。

| 包 | 查询版本 | 规划用途 |
| --- | ---: | --- |
| `@shrinktofit/eslint-config` | `0.0.12` | 必须采用当时最新版，并启用 conventions |
| `@cyclonium/cc-extension-utils` | `0.0.102` | Vortex contribution 和 editor module 构建辅助 |
| `@cyclonium/cc-test` | `0.0.102` | Cocos runtime/browser 测试 |
| `@cyclonium/bundle-wasm` | `0.0.102` | 评估 Taffy WASM 的 Rollup/Vite 集成 |
| `@cyclonium/core` | `1.0.0` | 仅按实际 API 需求评估，不默认引入整个框架 |
| `@cyclonium/event` | `0.0.103` | 评估输入/生命周期事件基础设施 |
| `@cyclonium/math` | `0.0.104` | 评估 2D transform、bounds、向量运算复用 |
| `@vue/runtime-core` | `3.5.42` | Vue custom renderer |
| `@vue/compiler-sfc` | `3.5.42` | `.cue` SFC 编译 |
| `@vue/language-core` / `vue-tsc` | `3.3.11` | `.cue` 语言服务和 CLI 类型检查 |
| `lightningcss` | `1.33.0` | 构建期 CSS 解析、语法降级和 CSS Modules 基础能力 |
| `taffy-wasm` | `0.9.10` | 只作为验证基线，不直接承诺进入生产 runtime |

## 3. 已确定的产品与架构约束

- 使用 Vue 3 `runtime-core`，不使用 `runtime-dom`。
- 每个 UI element 都不是 Cocos Node 或 Component。
- 场景中只保留一个或少量 `UIPanelHost`。
- 使用标准 Web CSS 名称与尽可能一致的语义，不创建平行的私有样式词汇。
- Taffy 负责 Block/Flex/Grid；inline layout 由 Cue 自己负责。
- CSS parser/compiler 仅在开发和构建阶段存在；runtime 自己执行 cascade、inheritance、variables、computed values 和 invalidation。
- 普通圆角、边框、outline、gradient 走参数化 GPU 绘制。
- 对外只提供 Pointer Events 作为鼠标/触控/笔的统一模型；键盘、IME、focus、wheel 独立保留。
- UI 动画以 transition、keyframes 和 `element.animate()` 为入口，不让 Cocos Tween 直接写 computed style。
- 第一阶段优先 HMR、runtime inspector 和真实性能数据，不优先 WYSIWYG。
- 第一阶段不交付完整字体 shaping/rasterization，但接口和布局边界必须为其保留位置。
- runtime minified JS + WASM + 内建 shader 的最终绝对上限是 1,000,000 bytes。
- 项目脚本系统使用 oh-my-script，不接入 Cocos 内置脚本构建链。

## 4. 工程原则

### 4.1 模块和 API 原则

- compiler、runtime、language-service 共享的是明确、版本化的语义契约，不共享任意内部对象。
- 不因为“以后可能需要”提前创建 helper、adapter、provider 或 fallback。
- 只有出现第二个真实消费者时，才把实现抽成共享包。
- 错误必须带稳定 diagnostic code、source location 和可操作信息；未知错误不得静默吞掉。
- 异步对象创建不能暴露“构造后再 initialize”的半初始化状态；使用异步静态创建入口，或把 start/stop 明确建模为公开生命周期。
- TypeScript 内部有限状态优先使用字符串 enum；可选值优先使用 `undefined`。

### 4.2 文件、模块与包规范

- 所有源码相邻文件使用 lowercase kebab-case，包括 `.ts`、`.vue`、测试和样式文件。
- 所有 owned package 显式设置 `"type": "module"`。
- 普通 npm package 只用 `exports` 声明入口，不使用 legacy `main`/`types`。
- Vortex extension manifest 的 `main` 是宿主协议要求，可作为明确例外保留，并指向构建后的 CJS bridge。
- TypeScript ESM 相对导入显式写 `.js` 后缀。
- 运行 package script 使用 `node --run <name>`；不使用 `npm run`，pnpm 命令不设置 `CI=true`。

## 5. 产品包职责

- `runtime`：Vue renderer、UI tree、style/layout/paint/input/animation 和 Cocos runtime bridge。
- `compiler`：SFC、template、CSS、asset reference、IR、source map 和 HMR metadata 编译。
- `language-service`：`.cue` 的 Volar/Vue/TypeScript/CSS profile 集成。
- `extension`：Vortex 生命周期、OMS 对接、asset-db/build/preview contributions、开发工具 UI。

暂不建立 `shared`、`protocol`、`utils`、`testing` 等 catch-all package。若 compiler/runtime/language-service 确实需要同一稳定 ABI，再以具体职责命名并通过 ADR 拆分。

## 6. 发布与安装模型

推荐默认方案是双通道发布：

- npm registry：runtime、compiler、language-service 等可独立消费和测试的包。
- exm registry：Vortex extension，负责编辑器集成并声明对 oh-my-script extension 的兼容范围。

项目侧预期安装步骤：

1. 通过 exm 安装 Cue extension 和 oh-my-script extension。
2. 通过 pnpm 安装 Cue runtime 与 language-service 所需 npm 包。
3. 在 `oms.config.*` 中声明 Cue 所需的 project peer，仅当实际需要单例或项目统一版本时使用。
4. 在 `tsconfig.json` / Vue compiler options 中启用 `.cue` 和 Cue language plugin。

已确定 npm scope 为 `@bsgames`，runtime 包为 `@bsgames/cue`，exm 发布名为 `@bsgames/extension-cue`。ADR-001 仍需确认 runtime helper 最终使用 npm specifier 还是 OMS public export；compiler、language-service、OMS 和生成文件必须只引用这一份规范值，不能各自硬编码。

## 7. Compiler 规划

### 7.1 输入语法

第一版 `.cue` 建议支持：

```vue
<script setup lang="ts">
// Vue 3 composition API
</script>

<template>
  <div class="dialog">
    <img src="asset://main/ui/icon" />
    <span>{{ message }}</span>
  </div>
</template>

<style>
.dialog { display: flex; }
</style>
```

第一阶段限定：

- `script` / `script setup` 只支持 JavaScript 和 TypeScript。
- 恰好零个或一个 template；缺少 template 时允许纯逻辑组件。
- 支持一个或多个 style block，但是否支持 `scoped`、CSS Modules 和预处理器必须分别经过 ADR。
- 不支持 DOM-specific custom block、HTML parser 行为和 SSR 输出。
- 原生标签只来自 Cue element registry；PascalCase 名称由 Vue component resolution 处理。

### 7.2 编译流水线

```text
source
  -> SFC parse
  -> descriptor validation
  -> script compile
  -> template semantic validation + Vue render generation
  -> style parse / profile validation / selector compile
  -> asset dependency extraction
  -> component assembly
  -> JS + style IR + asset metadata + source maps + HMR metadata
```

各阶段职责：

1. SFC parse
   - 使用 `@vue/compiler-sfc`。
   - 保留 block offset、原始 source map 和 parse diagnostics。
2. Descriptor validation
   - 校验重复 block、语言、unsupported attributes、template/style 缺失规则。
   - 所有 Cue 自有错误使用 `CUE-SFC-*` code。
3. Script compile
   - 支持普通 script 与 script setup 合并。
   - 不注入 Cocos Node/Component 类型桥。
   - 产出 bindings metadata 给 template compiler。
4. Template compile
   - 使用 Vue compiler-core/dom 的 AST 和 codegen 能力，但关闭 DOM-only assumptions。
   - runtime helpers 指向唯一 Cue runtime specifier。
   - 校验元素、属性、事件、directives 和不支持的 DOM 行为。
   - 保留 static hoist、patch flags 和 component slots 等 Vue 优化，前提是 custom renderer 语义一致。
5. Style compile
   - Lightning CSS 负责语法解析、`@import`、nesting、CSS Modules 等构建期能力。
   - Cue 层负责 CSS Profile 验证、shorthand 展开、typed value、selector program、specificity、dependency、keyframes 和 source mapping。
   - 不把 Lightning CSS parser 带入 runtime。
6. Asset extraction
   - 收集 template 与 CSS 中的 `asset://`。
   - 保留可追踪的逻辑 URL；最终 `AssetKey` 由项目构建清单生成，不在源码暴露 UUID。
7. Assembly
   - 输出组件模块、样式注册元数据、asset dependencies、scope id、HMR id 和 source maps。
   - 不通过字符串拼接维持复杂代码映射；使用带 segment mapping 的 emitter。

### 7.3 Style IR 与 ABI

`.uicss` 是 compiler/runtime 边界，至少包含：

```text
magic
schema version
CSS profile version
feature flags
string/value tables
compiled selectors + specificity + dependency keys
typed declarations
custom property tokens
media conditions
keyframes
asset references
source locations (development only)
```

约束：

- IR 必须有显式 schema version，runtime 遇到不兼容版本立即报错。
- production 可移除 source locations 和调试字符串。
- 开发 patch 使用稳定 stylesheet/rule/declaration IDs。
- 二进制格式是否直接输出文件，或先输出可 tree-shake 的 JS/typed-array module，由 Phase 0 体积和加载实验决定。
- compiler 和 runtime 的 compatibility table 必须进入发布流程。

### 7.4 HMR 编译契约

每个编译结果必须报告：

- component id 和 scope id。
- script/template/style/asset dependency hash。
- 受影响的 rule IDs、keyframes 和 asset keys。
- patch 类型：template、style、script、asset、full reload required。
- source map 和 diagnostic delta。

预期行为：

- template 更新尽量保留组件实例和响应式状态。
- style 更新不 remount 组件。
- script 更新只重建不能安全热替换的最小子树。
- CSS patch 在到达 runtime 后一个 frame 内生效。
- 不通过重载整个 Cocos scene 实现正常 HMR。

### 7.5 Compiler 测试

- SFC parse 和 diagnostics table tests。
- template golden tests：原生 element、component、slot、directive、事件、文本、条件和列表。
- CSS profile table tests：每个支持/拒绝的 property、value、selector 和 at-rule。
- selector bytecode 与 runtime matcher contract tests。
- source map tests：script/template/style 错误均映射回 `.cue` 原位置。
- asset dependency tests：bundle/path/subasset、CSS URL、动态 `AssetRef`。
- deterministic output tests：同一输入必须逐 byte 一致。
- production stripping 和体积 tests。
- malicious/invalid input fuzz tests，优先覆盖 parser 边界与超深 selector。

## 8. oh-my-script 集成规划

### 8.1 已发现的阻断项

当前本地 OMS build-core：

- 只识别 `.js`、`.mjs`、`.cjs`、`.ts`、`.mts`、`.cts`。
- `oms.config.*` 当前没有公开 compiler/transform plugin 配置。

因此 `.cue` 不能只靠 Cue extension 自己的配置进入 OMS 开发和生产构建。

### 8.2 推荐方案

在 oh-my-script 建立最小、稳定的 source compiler 扩展点，Cue 作为消费者注册：

```text
canLoad(id)
load/transform(source, id, mode)
watch dependencies
generated module ids
source maps
HMR invalidation metadata
production emit metadata
```

这个接口必须同时服务：

- development Vite runtime。
- production Rollup/SystemJS 构建。
- default/headless/editor profiles。
- project domain 与 extension domain。
- asset-db 和 scene runtime reload。

接口设计应以 Cue vertical slice 为首个真实消费者，不先抽象成任意 bundler framework。

### 8.3 不接受的方案

- 绕回 Cocos 内置脚本系统处理 `.cue`。
- 修改 `node_modules` 或已安装 OMS extension。
- Cue 自带第二套项目脚本 watcher、module graph 和 production bundler。
- 依赖整场景 reload 掩盖 HMR 缺口。
- 长期维护无 source map、无依赖图的 `temp/*.ts` 旁路生成物。

Cue 管理的预编译临时文件只允许用于验证 OMS 扩展点设计，不作为发布架构。

### 8.4 Phase 0 集成验收

- 项目 `src` 可以直接 import 一个 `.cue` component。
- `.cue` 可以 import 普通 TS、npm dependency 和允许的 `#oms-peer`。
- development 修改 template/style/script 能触发正确的增量更新。
- production Web 输出包含相同语义，不依赖 dev server。
- headless profile 对不支持的 UI import 给出明确错误或按 ADR 定义排除，不能静默生成空实现。
- diagnostics 和 stack/source map 能回到 `.cue` 源位置。
- OMS 与 Cue extension 版本不兼容时在启动阶段给出一次明确错误。

## 9. Language Service 规划

### 9.1 目标

第一阶段必须同时支持 IDE 和 CLI：

- `.cue` 文件识别、语法高亮与 document symbols。
- script/script-setup TypeScript completion、diagnostics、rename、references。
- template 中 Vue component、Cue native element、props、events、slots 和 directives 类型检查。
- CSS 标准语法能力及 Cue CSS Profile completion、hover、diagnostics。
- `asset://` completion、definition 和不存在资源 diagnostics，前提是项目 asset index 可用。
- compiler diagnostics 与 language-service diagnostics 使用同一 code、message 和 source range。
- `vue-tsc --noEmit` 可在 CI 检查 `.cue`。

### 9.2 分层

```text
editor client / vue-tsc
  -> Cue Vue language plugin
  -> Cue virtual code generator
  -> shared template semantics
  -> TypeScript service
  -> Cue CSS profile service
  -> optional project asset index provider
```

- Vue language plugin 负责 `.cue` file kind、virtual code 和 compiler options。
- TypeScript 服务处理 script 与 template generated code。
- CSS profile 服务不伪装成完整浏览器 CSS；明确标记支持、部分支持和不支持。
- asset index 是可选的编辑器数据源；缺失时只能降低 asset completion，不得关闭其他类型检查。

### 9.3 Compiler/LS 一致性

必须共享或自动生成以下事实：

- native element registry。
- props/event names 与类型。
- supported directives。
- CSS properties、values、units、selectors、pseudo states 和 at-rules。
- diagnostic catalog。
- compiler/runtime ABI version。

禁止 compiler 与 language-service 各维护一份手写列表。推荐从一个声明式 profile 生成 runtime tables、compiler validators、TypeScript declarations 和 LS metadata；生成器本身必须可测试并产生 deterministic output。

### 9.4 分阶段交付

LS-A：基础 Vue/TS

- 基于 `@vue/language-core` 接受 `.cue`。
- runtime lib 指向最终 Cue runtime package。
- 支持 `vue-tsc`、unknown element/prop/event diagnostics。
- 用 cc-plus fixture 经验建立最小测试，但改成 UIElement 语义。

LS-B：CSS Profile

- style block syntax、completion、hover 和 profile diagnostics。
- custom properties 的定义/引用与 rename。
- selector 对 template class/id 的基础导航。

LS-C：项目感知

- `asset://` index。
- custom element registration。
- HMR/compiler diagnostics 流入 IDE。
- Runtime Inspector 与源码双向定位。

### 9.5 兼容性策略

- 明确支持的 TypeScript、Vue、`@vue/language-core`、VS Code Vue extension 版本矩阵。
- peer dependency 使用经过测试的范围，不无条件写 `*`。
- 每次升级 Vue/Volar 都运行 compiled fixture、`vue-tsc`、editor smoke 三层测试。
- Volar plugin API 改变时由 language-service package 吸收，不让 runtime 或 `.cue` 文件格式跟随变动。

## 10. Runtime 落地规划

原始设计报告已经定义完整目标，本节只描述实现边界和推进顺序。

### 10.1 初始模块边界

```text
panel/       UIPanel, viewport, frame lifecycle
element/     UIElement tree and five primitives
vue/         custom renderer host operations
style/       selector, cascade, computed values, invalidation
layout/      LayoutBackend, Taffy bridge, inline/scroll boundaries
paint/       display list and partial rebuild
render/      batching, clipping, Cocos backend
input/       hit-test, pointer, focus, keyboard, IME, gestures
animation/   timeline, transition, keyframes, WAAPI-like API
asset/       logical URLs, keys, acquire/release
devtools/    runtime protocol, tree/style/render diagnostics
```

这些是 runtime 内部目录，不自动等于独立 npm packages。

### 10.2 核心不变量

- UIElement identity 与 Vue VNode/Cocos Node identity 解耦。
- element attach/detach 只能通过 document/tree mutation 入口发生。
- style、layout、paint、composite 和 hit-test dirty reasons 可观测且可追踪。
- computed style 是只读结果；动画通过独立 presentation layer 合成。
- Taffy 跨 JS/WASM 使用 mutation/readback batch，不逐属性调用 wasm-bindgen 对象。
- render backend 不泄漏到 style/layout/element。
- 相同 AssetKey 去重，detach 后引用计数可验证地释放。
- pointer capture、focus 和 scroll state 在 element 删除时有确定清理语义。

### 10.3 Cyclonium 使用边界

优先评估已发布的窄包和明确子路径：

- `@cyclonium/cc-extension-utils`：extension build/contribution。
- `@cyclonium/cc-test`：Cocos/browser 测试。
- `@cyclonium/bundle-wasm`：Taffy WASM 构建实验。
- `@cyclonium/math`：纯数学值与运算，确认坐标/可变性语义一致后再采用。
- `@cyclonium/event` / `abort-controller`：确认事件传播、取消和生命周期语义一致后再采用。

不因为 RoboTimes 使用 `@cyclonium/core` 就让 UIElement 继承 `CycloComponent`。Cue 的 UI tree 必须保持独立；只有存在精确 API 复用价值时才增加依赖。

### 10.4 Cocos backend

通过版本化接口隔离：

```text
beginFrame(viewport)
upload(batch)
submit(commandList)
endFrame()
```

Phase 0 必须分别验证：

- Cocos 3.8 Web Preview 的自定义 draw submission。
- buffer 更新、材质/texture/clip 导致的 batch split。
- 1000 个圆角 quad 的 CPU、GPU、draw call 和内存基线。
- WASM 在 Web、小游戏和目标 Native 平台的加载限制。
- Native Taffy static library/C ABI 是否是必须方案。

在证据完成前，不把私有 Cocos renderer 类扩散到 backend 之外。

## 11. Vortex Extension 规划

extension package 采用 package format v2，并参考 Cyclonium/RoboTimes 的已验证结构：

- ESM source。
- Vite 生成宿主要求的 CJS main/hooks/contribution entries。
- 使用已发布的 `@cyclonium/cc-extension-utils` contribution 和 editor-module plugins。
- `main.cjs` / `hooks.cjs` 仅作为稳定 bridge。
- extension source、runtime export 和 editor-only export 明确分区。

职责分配：

- main：版本检查、服务启动/停止、菜单和消息入口。
- hooks/build contribution：把 compiler/IR/asset manifest 接入项目 build。
- asset-db contribution：识别 `.cue` 资源、刷新 diagnostics 和 dependency graph。
- preview/scene contribution：保持薄层，通过 OMS 的精确公开入口转调；不在 attach 阶段顶层加载 runtime peers。
- panel：Runtime Inspector、cascade/layout/render diagnostics。
- worker：compiler、asset indexing 和耗时静态工作；不承载 runtime UI 状态。

extension 安装测试必须同时 link Cue 和 oh-my-script 到 launcher 创建的 isolated project。不得把开发扩展 link 到真实项目。

## 12. Examples 与测试项目规划

独立仓库：`U:\Repos\Bluesquall\cc-extensions\cc-extension-cue-examples`

参考 `oh-my-script-examples`，采用 pnpm workspace，提交真实 Vortex 项目和可复现 smoke scripts；本地 extension link 放入 ignored `exm.local.yaml` / `exm-lock.local.yaml`。

建议项目序列：

1. `basic`
   - 单个 `UIPanelHost`、Vue state、div/span/text/img、基础 CSS。
   - 验证 editor startup、OMS build、Preview 和 production build。
2. `compiler-language-service`
   - script setup、components、slots、events、diagnostics、source maps、`vue-tsc`。
3. `layout-gallery`
   - Block/Flex/Grid、absolute、intrinsic measure、resize、safe area、DPR。
4. `cascade-gallery`
   - layer、specificity、inheritance、variables、pseudo states、media conditions。
5. `paint-gallery`
   - radius、border、outline、gradient、images、nine-slice、nested clips。
6. `input-focus`
   - pointer capture、多触点、wheel、keyboard、focus、IME、scroll 和 gestures。
7. `animation`
   - transition、keyframes、imperative animation、unscaled/game clocks。
8. `hmr`
   - template/style/script/asset 修改及状态、焦点、滚动保留。
9. `stress`
   - 1k/10k elements、batch split、overdraw、layout animation 和内存回收。
10. `native-smoke`
   - 只在 Web vertical slice 稳定且 Native backend 决策完成后建立。

### 12.1 测试层级

- Pure unit：parser、cascade、selector、typed values、dirty propagation、layout adapters。
- Contract：compiler IR 与 runtime decoder、compiler 与 LS fixtures、HMR protocol。
- Browser/Cocos：通过 `@cyclonium/cc-test` 验证实际 runtime 行为和画面。
- Extension integration：isolated Vortex + exm links + OMS startup/build/reload。
- Production smoke：真实 Cocos Web build，确认没有 dev/compiler/LS 代码进入 runtime。
- Visual regression：圆角、gradient、clip、transform、layout gallery 的基准图。
- Performance/size：固定场景、固定设备/环境、记录 median/P95 和产物 byte size。

测试只断言公开行为或稳定协议，不围绕 private method 和内部目录结构编写。

### 12.2 隔离运行规则

- 所有本地 Vortex GUI/headless 启动通过 `U:\skills\stf-local\vortex\scripts\launch-managed-project.ps1`。
- 使用稳定的 per-task `TempProjectName`。
- 只 link 到 launcher 输出的 `S:\vortex-isolation\projects\...` 项目。
- extension 修改后执行 build、关闭当前 isolated editor、用同名项目重开。
- headless 测试等待 extension、OMS、asset-db 和 Preview ready marker 后再运行。
- 测试结束关闭本任务启动的 editor；不泛杀 Electron/Node 进程。

## 13. 分阶段实施与 Gate

### Phase 0：契约和技术验证

交付：

- ADR-001：包名、发布通道、安装与 runtime helper specifier。
- ADR-002：Cue↔OMS source compiler API。
- ADR-003：`.cue` SFC block 与 scoped/module style 语义。
- ADR-004：Style IR/HMR protocol versioning。
- ADR-005：Taffy Web/Native backend 策略。
- 最小 compiler：script setup + template + style。
- 最小 language plugin：`.cue` + `vue-tsc`。
- 最小 runtime：Vue renderer -> UIElement tree -> 一个圆角色块。
- 一个 isolated Vortex example，贯通开发、HMR 和 production build。

退出 Gate：

- `.cue` 通过 OMS 运行，不经过 Cocos 内置脚本系统。
- Web Preview 显示并响应一个 Vue 驱动的 UIElement tree。
- source map 和基础 diagnostics 正确。
- 1000 quad、初始 bundle size 和 Taffy batch bridge 有测量结果。
- Native 风险有可执行结论，不以“以后再看”关闭。

### Phase 1：可用核心

交付：

- `div/span/text/br/img`。
- CSS selector/cascade/inheritance/variables。
- Block/Flex/Grid。
- background/border/radius/outline、2D transform、三类 gradient。
- AssetResolver 和 Pointer Events 基线。
- template/style HMR、element picker。
- LS-A 和 LS-B。

退出 Gate：

- `basic`、`layout-gallery`、`cascade-gallery`、`paint-gallery` 通过。
- 生产包不包含 compiler、language-service、Lightning CSS、HMR 或 inspector。
- runtime size 位于阶段预算内，并有按模块的 size report。

### Phase 2：控件与交互

交付：

- button/label/input/textarea/checkbox/radio/range/select/option。
- overflow/scroll、GestureArena、focus navigation、IME。
- transition、keyframes、`element.animate()`。
- custom elements。

退出 Gate：

- `input-focus` 和 `animation` 通过 mouse/touch/keyboard 场景。
- pointer capture、focus、IME、scroll 的 detach/reload 清理通过。
- layout animation diagnostics 可见。

### Phase 3：工程化与调试

交付：

- Cascade Inspector、Flex/Grid overlay、render profiler。
- asset hot reload、CSS source write-back。
- accessibility semantic tree、gamepad navigation、dialog/top-layer。
- LS-C。

退出 Gate：

- `hmr`、`stress` 和 production smoke 通过。
- Inspector 能解释一次 style/layout/paint/batch 变化的来源。
- 体积达到目标 `<= 850 KiB raw`，硬上限 `<= 950 KiB raw`。

### Phase 4：文本与高级能力

在前述 Gate 稳定后再规划字体 atlas、shaping、line breaking、selection、bidi/RTL、text stroke、高级 vector path 和可选 WYSIWYG。

## 14. CI 与发布 Gate

每个 PR 至少按受影响范围执行：

- lint，零 warning。
- TypeScript build/typecheck。
- unit/contract tests。
- compiler fixture + `vue-tsc`。
- extension package build。
- examples smoke（影响 OMS/compiler/runtime/extension 时）。
- size report（影响 runtime dependencies 或 build flags 时）。

发布前额外执行：

- npm pack/exm package 内容审计。
- 从打包产物而不是 workspace link 安装的 consumer test。
- Cue runtime/compiler/language-service compatibility matrix。
- Cue extension/OMS compatibility test。
- development 与 production graph 对比。
- Web Preview 与 production Web build smoke。
- Native 支持声明对应的平台 smoke；未验证平台不得宣称支持。

## 15. 风险与缓解

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| OMS 当前无 `.cue` compiler extension point | 阻断整个脚本链 | Phase 0 先建立最小公共契约并同时覆盖 dev/prod |
| Cocos 私有 renderer API 变动 | backend 易碎 | 单一 backend 边界、版本 smoke、禁止泄漏内部类型 |
| Taffy WASM Native 支持受限 | Native 无法运行 | Web WASM 与 Native C ABI 共用 LayoutBackend，Phase 0 决策 |
| Compiler/LS CSS 支持列表漂移 | IDE 正确、构建失败或反之 | 单一声明式 CSS Profile 生成多端 metadata |
| Vue/Volar plugin API 变化 | IDE/CLI 中断 | language-service 隔离版本差异并维护矩阵 |
| Vue runtime 重复实例 | reactivity/component identity 异常 | 明确 project peer/externals 和单例检查 |
| 深裁剪与半透明 overdraw | draw call/GPU 成本失控 | 分级 clip、profiler、stress fixtures 和预算 |
| 运行时体积超限 | 无法满足核心指标 | 每 phase size budget、依赖准入、生产 tree-shake 审计 |
| 字体栈延期导致文本行为不确定 | 布局 API 返工 | 先固定 TextMeasurer/fragment 接口和占位测试，不伪装完整文本支持 |
| 资产 URL 与 Cocos bundle 规则不一致 | build/runtime 加载失败 | versioned asset manifest、真实 bundle/subasset examples |

## 16. 待决策 ADR

Phase 0 前置决策：

1. Cue runtime helper 使用普通 npm specifier、OMS project peer，还是 extension public OMS export。
2. OMS source compiler extension API 的所有者与发布顺序。
3. `.cue` 第一版是否支持 `<style scoped>` 与 CSS Modules。

阻断 Phase 0 退出：

4. Style IR 的初始 schema、development/production 表示和兼容规则。
5. Taffy 定制构建、WASM 装载和 Native C ABI 路线。
6. Cocos 3.8 render submission 的稳定接入点。
7. HMR transport 所有者：OMS 复用、Cue 独立 channel，或共享底层 transport。

可延后到 Phase 1/2：

8. asset manifest 由 Cue 独立生成还是复用 Cyclonium asset pipeline。
9. custom element 注册的静态/动态发现方式。
10. headless profile 遇到 UI component import 的行为。
11. accessibility/gamepad semantics 的最小公开模型。

## 17. 下一轮工作建议

在写功能代码前按此顺序继续：

1. 讨论并确认 ADR-001 剩余的 runtime helper 与安装模型。
2. 在 oh-my-script 侧起草 ADR-002 所需的最小 source compiler API，不先实现泛化插件系统。
3. 为 `.cue` grammar、Style IR 和 HMR metadata 写三个纯数据示例，验证 compiler/runtime/LS 是否能共享语义。
4. 确认 Taffy Web/Native 技术验证矩阵和目标平台。
5. 实现 Phase 0 最小 compiler/runtime/language-service vertical slice。

在上述四项关键决策完成前，不进入完整 runtime 实现。
