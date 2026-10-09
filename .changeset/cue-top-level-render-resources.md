---
"@bsgames/cue": patch
---

Prepare shared rendering effects and layout resources with top-level await when importing the host. Remove the explicit `CueDocument.prepare()` step and initialize each component synchronously. Skip preparation in the editor outside preview, retain shared effects across scene unloading, and propagate initialization failures to the importer. Host consumers must support top-level await.
