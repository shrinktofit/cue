# OMS integration

`@bsgames/oms-plugin-cue` consumes the public `@oms/plugin` Vite-compatible subset.
Register `cue({ customElements: [...] })` in the project's `oms.config.js`; then import `.cc.vue`
from ordinary TypeScript and other Cue components. `customElements` is optional.

The plugin uses `buildStart`, `resolveId` and `load`. Compiler output remains an in-memory
facade plus script/template/style modules, with identities derived from the full original filename.
Imports in generated scripts resolve relative to the original `.cc.vue`, not a generated directory.
Per-build state uses Rollup's plugin cache so simultaneous OMS profiles do not share mutable compilations.
The compiler library does not import OMS or write files.

Relative `<cue-image src>` and CSS `background-image` paths read the adjacent Cocos `.meta`,
selecting the SpriteFrame and Texture2D subassets respectively. The plugin registers source,
asset and metadata dependencies before reading; missing metadata fails visibly and can recover
when recreated. `uuid:` references retain the existing compiler semantics.

OMS owns watching, full rebuilds, reload, bundling and final output. The plugin does not implement
another watcher or HMR transport. Fine-grained HMR and compiler source maps are **not implemented**;
known template diagnostics preserve the compiler's original source location, which is not a source map.
General external type/style preprocessing dependencies and production asset inclusion remain separate work.

## Local verification

The examples repository links this plugin and the public OMS package, and uses exm junctions to
the plugin-enabled OMS extension. Its `scripts/build-oms.ts` calls only the public
`@oms/build-core/main` process entry and `@oms/build-core/protocol` IPC exports.

- `node --run build`: actual OMS default development and production script builds for both projects.
- `node --run test`: OMS headless ESM output runs the existing public renderer smoke tests.
- `node scripts/verify-oms-watch.ts`: real source and metadata updates, metadata deletion/failure,
  recreation/recovery, and unchanged-source recompilation.
- Existing browser regressions validate the running galleries, HUD and hotbar.

Build and test reject any `src/generated` directory, intermediate `.cc.vue.js` imports or CLI dependency.
OMS final files in `temp/oms` and `build` are expected; these are not source inputs. Old local generated
files were moved to the examples' ignored `.validation/oms-generated-backup` for recovery.

2026-10-09 verification: both examples passed default development/production script builds,
headless renderer smoke tests and the no-intermediate-input assertions. Real browser regressions
passed for Input routing, image fill/contain pixels, the player HUD and the item hotbar.
The source/metadata watcher regression passed update, delete/failure and recreate/recovery.
Full Cocos production application export, Native/mobile and fine-grained HMR remain outside this result.
