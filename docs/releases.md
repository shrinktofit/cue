# npm releases

Only these packages are published to npm:

- `@bsgames/cue`
- `@bsgames/cue-compiler`
- `@bsgames/cue-control-schema`
- `@bsgames/cue-style-schema`
- `@bsgames/cue-language-service`

`@bsgames/cue-language-service` currently has an empty entry point. Including
it in the release group prepares its distribution; language tooling still
needs implementation.

These packages share a version through a Changesets fixed group. They start at
`0.0.0`; the initial changeset prepares `1.0.0`. The CLI, OMS plugin, editor
extension, workflow package, and repository root remain private and are ignored
by Changesets. The extension continues to use its separate EXM distribution.

## Development

Run `pnpm changeset` after a change that needs a release. Select the affected
public packages, choose the version bump, describe the change, and commit the
changeset with the implementation. Changesets also updates internal dependency
and peer dependency ranges when versions change. pnpm replaces `workspace:*`
with published versions when packing packages.

## Versioning and publishing

1. Pushes to `main` run the Release workflow. After installation,
   Changesets creates or updates a Version Packages PR using
   `pnpm version-packages` while pending changesets exist. That PR changes
   package versions, changelogs, and the lockfile.
2. Review the Version Packages PR. Merging it consumes the changesets and
   pushes the versioned packages to `main`.
3. The same Release workflow then runs `pnpm release`, which builds the five
   public packages and publishes versions that are not already on npm.
   Changesets also creates GitHub releases.

The workflow follows the official [With Publishing example](https://github.com/changesets/action/blob/maintenance/v1/README.md#with-publishing),
using the documented `version` script input to also update the pnpm lockfile.
`changesets/action@v1` is paired with the compatible Changesets CLI v2.
There is no manual publish input. The initial changeset remains pending in this setup PR, so merging it
prepares a Version Packages PR. Publishing starts after that version PR is
merged. No npm publication is performed while preparing this setup PR.

The repository must allow GitHub Actions to create pull requests (Settings →
Actions → General). Publishing requires an `NPM_TOKEN` Actions secret with
permission to publish the five `@bsgames` packages; use an npm token suitable
for CI publishing under the organization's authentication policy. Creating the version
PR does not require an npm token. Keep tokens out of committed files.

For a local preview, run `pnpm changeset status`, `pnpm build:release`, and
`pnpm --filter @bsgames/cue pack --pack-destination /tmp/cue-packs`. Packing
creates a tarball without uploading it. `pnpm release` uploads packages and
should only be run when publication is intended.

## PR checks and editor limitations

The PR workflow uses Node.js 24 and the pnpm version pinned in `package.json`.
It runs a frozen install, `pnpm lint`, `pnpm build:ci`, and `pnpm test:ci`.
The `prelint` hook builds the five public packages first, providing the
generated declarations required by type-aware ESLint on a clean checkout.
Subsequent build steps reuse Turbo outputs.

`build:ci` builds all packages except `@bsgames/oms-plugin-cue`, whose manifest
currently points to an external Windows-local `@oms/plugin` checkout. The
editor extension can build using the installed Creator type declarations
without launching Creator. `test:ci` runs the other workspace test tasks and
then runs the OMS plugin's independent Rollup integration tests directly;
those tests do not require the missing OMS checkout.

Full OMS plugin build/typechecking, live OMS integration, and Creator/Vortex
editor or preview tests are excluded until those environments are available.
The local-link install warning is expected. These exclusions do not apply to
any of the five npm packages' builds.
