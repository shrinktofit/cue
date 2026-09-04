# Cue

Cue is a Vue 3 retained-mode runtime UI system and Cocos Creator / Vortex extension.

## Workspace packages

- `@bsgames/cue`: project runtime and Vue custom renderer.
- `@bsgames/cue-compiler`: `.cue` SFC, template, style, and metadata compiler.
- `@bsgames/cue-language-service`: Vue/TypeScript/CSS language tooling for `.cue` files.
- `cue`: Vortex extension published through exm as `@bsgames/extension-cue`.
- `@bsgames/cue-workflow`: private shared TypeScript workflow configuration.

The implementation roadmap and architectural constraints live in [`docs/PLANS.md`](docs/PLANS.md).

## Workspace commands

```text
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```
