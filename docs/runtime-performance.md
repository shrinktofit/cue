# Runtime performance

## Update contract

`CueDocument` owns one retained `CueLayout`. Each frame checks the author-tree revision, stylesheet membership, viewport, loaded image revision and font revision. An unchanged document reuses the paint list and hit regions; it does not traverse/recompute styles, lay out text, rebuild geometry or upload buffers. A focused native text input still synchronizes its platform input geometry; caret blinking changes only its paint opacity.

Mutations enter through `Text.data`, element insertion/removal/reparenting, property/state updates, the typed style API and native-control setters. Styles hold copied immutable composite values; see [Style API](style-bindings-and-fonts.md). Stylesheets are compiled immutable input: replace their registration instead of mutating a registered IR object in place.

| Layer | Reuse and invalidation |
| --- | --- |
| Style | Cache computed styles by element/ancestor revision; recompute affected descendant inheritance and selectors on author changes. |
| Text preparation | Reuse normalized graphemes, whitespace and break opportunities, plus up to 16 constraint-specific line layouts per non-atomic inline context. Atomic inline measurement still performs its child-tree positioning side effects. |
| Canvas | Pure width measurement never calls the line-layout routine. Advance the wrapping probe incrementally; retain whole-prefix shaping for kerning. Cache font metrics (128 entries) and widths (4,096 entries / 262,144 key characters maximum, with a per-key limit); font changes invalidate both. |
| Layout | Keep Taffy trees and dirty changed geometry nodes. Paint-only color, background, opacity, border-radius, outline, shadow and transform-value changes do not relayout text. Atomic inline descendants propagate geometry revisions to their containing lines. |
| Rendering | Preserve models, materials, buffers and text textures when their inputs match. Rebuilt paint lists compare per-record inputs before generating geometry/uploading vertex or index data. Text rasterization keys include font revision and pixel scale. |
| Lifecycle | Tree rebuild, unmount and destroy release owned Taffy trees; render records/resources retain the existing destruction paths. Caches are document/rasterizer-owned, not global unbounded maps. |

Topology changes currently rebuild the document formatting graph: insertion/removal/reparenting, display/position/order changes, gaining/losing a transform containing block, absolute static-position placeholder changes, and loaded image changes. This is deliberate: anonymous boxes, atomic trees and absolute portals do not have a one-to-one mapping to author nodes. Ordinary text, size and spacing changes keep the graph. This is **not** a claim that structural updates or every paint change are O(1); dirty frames still walk the author/formatting graph and create a paint list. No frame-rate throttling or delayed visual updates are used.

## Validation

- `node --run test`: runtime black-box regressions cover static reuse, paint-only changes, unaffected text siblings, font/viewport changes, nested atomic inline content, image source A → B → unset, absolute insets → auto, tree mutations and native input setters/IME.
- `node packages/runtime/test/verify-inline-layout.ts [shared-playwright-path]`: real Chromium/CSS layout comparisons plus counted Canvas calls. Cold measurement calls must be bounded relative to text length; 120 unchanged updates and a color-only layout update must measure no text. This test does not suppress rasterization when the text color actually changes.
- The independent review additionally compared 6,000 whitespace/padding cases against the pre-optimization algorithm and 300 deterministic dynamic layout mutations against fresh layouts.

### Example measurement, 2026-09-19

Self-hosted Basic / Input Gallery, existing editor Web Preview, isolated headless Chromium at 1440 × 850:

| Sample | Result |
| --- | --- |
| 120 real static frames: Canvas `measureText` | 0 calls |
| 120 real static frames: Canvas `fillText` / `strokeText` | 0 calls |
| 120 real static frames: WebGL `bufferSubData` | 0 calls |
| Production `CueDocument.onUpdate` over those frames | 10.6 ms total, approximately 0.088 ms/frame |
| 120 consecutive direct calls of the same production update | Approximately 0.011 ms/call; 0 measurement, rasterization and buffer upload calls |
| Real mouse click → Vue counter text update | Passed, no page errors |
| Six control galleries: keyboard, pointer/touch, selection, external writes and remount | Passed with the test-process adaptations below |

The example's existing verification script still assumed pre-self-hosting coordinates/control counts: its world-coordinate click helper added the document origin twice, and its gallery button assertions included the new Cue control-plane buttons. For this run only, the isolated Node loader removed the duplicate transform and limited gallery value assertions to the two showcased controls. No example source files were changed. A real operating-system IME composition session remains a manual check.

These are local diagnostic samples, not a portable FPS guarantee or a controlled before/after benchmark. The user's earlier trace had 35/35 animation callbacks entering text layout (approximately 137 ms average callback); that original capture and this headless run differ in execution conditions. The stronger regression guarantee is the removal of text/layout/upload work from unchanged frames. Draw-call batching, glyph atlases/SDF, Native rendering and production performance remain separate work.
