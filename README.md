# Cue

Cue is a Vue 3 retained-mode runtime UI system and Cocos Creator / Vortex extension.

## Workspace packages

Cue components use `*.cc.vue`: standard Vue tooling recognizes the `.vue` suffix without custom
file associations or extension registration. The CLI and OMS Cue plugin match the full `.cc.vue`
suffix, not ordinary `.vue` files. Runtime imports remain `@bsgames/cue`.

- `@bsgames/cue`: project runtime and Vue custom renderer.
- `@bsgames/cue-compiler`: `.cc.vue` SFC, template, style, and metadata compiler.
- `@bsgames/cue-style-schema`: shared runtime style IR.
- `@bsgames/cue-cli`: early command-line frontend for the compiler library.
- `@bsgames/oms-plugin-cue`: direct `.cc.vue` imports for OMS development and production builds.
- `@bsgames/cue-language-service`: Vue/TypeScript/CSS language tooling for `.cc.vue` files.
- `cue`: Vortex extension published through exm as `@bsgames/extension-cue`.
- `@bsgames/cue-workflow`: private shared TypeScript workflow configuration.

Current feature coverage lives in [`docs/implementation-status.md`](docs/implementation-status.md). The implementation roadmap and architectural constraints live in [`docs/PLANS.md`](docs/PLANS.md).

See [typed style APIs, positioning and imported fonts](docs/style-bindings-and-fonts.md) for the game-UI APIs. CSS is parsed only by the compiler; runtime changes use `CueElement.style`. The sibling examples repository contains focused galleries in `basic` and complete UI cases in `game-ui-showcase`.

## Workspace commands

```text
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Examples use the OMS plugin in their `oms.config.js`, without pre-generated Cue JavaScript:

```js
import { cue } from '@bsgames/oms-plugin-cue';

export default { plugins: [cue()] };
```

See [OMS integration](docs/oms-integration.md) for current boundaries and verification commands.
The CLI remains available as a standalone compiler frontend:

```text
cue compile example.cc.vue
cue compile example.cc.vue --out-dir=generated
```
