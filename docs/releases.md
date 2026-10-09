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
`0.0.0`; the initial changeset prepares `0.1.0`. The CLI, OMS plugin, editor
extension, workflow package, and repository root remain private and are ignored
by Changesets. The extension continues to use its separate EXM distribution.

## Development

Run `pnpm changeset` after a change that needs a release. Select the affected
public packages, choose the version bump, describe the change, and commit the
changeset with the implementation. Changesets also updates internal dependency
and peer dependency ranges when versions change. pnpm replaces `workspace:*`
with published versions when packing packages.

## Versioning and publishing

1. Pushes to `main` run the Release workflow, which creates or updates a release
   PR using `pnpm version-packages`. It changes package versions, changelogs,
   and the lockfile. It does not publish to npm.
2. Review and merge that release PR.
3. When ready to publish, run the Release workflow manually on `main` and set
   `publish` to `true`. It installs, lints, builds, and tests before running
   `pnpm release`. This builds the five public packages and publishes versions
   that are not already on npm. Changesets also creates GitHub releases.

Manual runs default to `publish: false` and only maintain the release PR.
Merging this setup or a version PR never publishes packages automatically.

The repository must allow GitHub Actions to create pull requests (Settings →
Actions → General). Publishing requires an `NPM_TOKEN` Actions secret with
permission to publish the five `@bsgames` packages; use an npm token suitable
for CI publishing under the organization's authentication policy. The version
job does not need an npm token. Keep tokens out of committed files.

For a local preview, run `pnpm changeset status`, `pnpm build:release`, and
`pnpm --filter @bsgames/cue pack --pack-destination /tmp/cue-packs`. Packing
creates a tarball without uploading it. `pnpm release` uploads packages and
should only be run when publication is intended.

## PR checks and editor limitations

The PR workflow uses Node.js 24 and the pnpm version pinned in `package.json`.
It runs a frozen install, `pnpm lint`, `pnpm build:ci`, and `pnpm test:ci`.

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
