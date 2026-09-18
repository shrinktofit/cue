# Cue

Cue is a Vue 3 retained-mode runtime UI system and Cocos Creator / Vortex extension.

## Workspace packages

- `@bsgames/cue`: project runtime and Vue custom renderer.
- `@bsgames/cue-compiler`: `.cue` SFC, template, style, and metadata compiler.
- `@bsgames/cue-style-schema`: shared runtime style IR.
- `@bsgames/cue-cli`: early command-line frontend for the compiler library.
- `@bsgames/cue-language-service`: Vue/TypeScript/CSS language tooling for `.cue` files.
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

During early development, the CLI can compile one Cue SFC into generated JavaScript modules:

```text
cue compile example.cue
cue compile example.cue --out-dir=generated
```
