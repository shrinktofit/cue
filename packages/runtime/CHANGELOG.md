# @bsgames/cue

## 0.0.1-alpha.0

### Patch Changes

- 6a3647c: Prepare shared rendering effects and layout resources with top-level await when importing the host. Remove the explicit `CueDocument.prepare()` step and initialize each component synchronously. Disable edit-mode component execution and skip module resource preparation in the editor outside preview. Keep successfully loaded effects available when another effect fails, retaining each effect across scene unloading. Required layout initialization failures reject the import and release retained effects. Host consumers must support top-level await.
- ba641c7: Prepare the first npm release of the Cue runtime, compiler, shared schemas, and language service.
- Updated dependencies [ba641c7]
  - @bsgames/cue-control-schema@0.0.1-alpha.0
  - @bsgames/cue-style-schema@0.0.1-alpha.0
