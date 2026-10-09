# Changelog

## [2.1.7] - 2026-10-15

### Changed

- Set `typescript` to `^6.0.3` in projects that the `upgrade` script upgrades

## [2.1.6] - 2026-10-05

### Fixed

- Move `node-fetch` to `dependencies`, because the `upgrade` script uses it

## [2.1.0] - 2026-07-23

### Changed

- Bump `webpack-dev-server` from 5 to 6
- Remove all comments, except the version banner, from production builds (no `.LICENSE.txt` files)
- Use the environment var `SDK_PLATFORM` as the default `projectType` of the `build` script
- Set `noUncheckedSideEffectImports` to `false` in the base TypeScript config

### Added

- Add a banner comment with version data to the build output (set environment vars `SDK_PLATFORM`,
  `PLATFORM_VERSION`, `SDK_VERSION` and `SDK_LIBRARY_VERSION`)

## [2.0.5] - 2026-05-19

### Fixed

- Rename `uuid.js` to `uuid.cjs` when the `upgrade` script upgrades a Workflow project

## [2.0.2] - 2025-12-11

### Changed

- Use HTTPS for the Web dev server when the host is not `localhost`

### Added

- Add the `--port` and `--type` (`http` or `https`) arguments to the `start` script
- Add support for the `--key`, `--cert` and `--ca` arguments to the `start` script for Web projects
- Add support for the `devServer` options of the project webpack config to the `start` script
- Add proxy support to the `upgrade` script with `HTTPS_PROXY` or `HTTP_PROXY`

## [2.0.0] - 2025-11-04

### Changed

- **Breaking:** set `module` to `preserve` in the base TypeScript config (needs TypeScript 5.4 or
  later)
- Set `typescript` to `^5.4.0` in projects that the `upgrade` script upgrades

### Added

- Add all shared code from Web and Workflow SDKs (prior to this release the repo was config only)
- Add the `build`, `create`, `start` and `upgrade` scripts for Web and Workflow projects
- Add the `generate` script for Workflow projects
- Add the HTML template for Web projects
- Add the activity loader, `GenerateActivityMetadataPlugin` and compiler utilities for Workflow
- Add the loaders that the base webpack config uses to `dependencies`

## [1.0.0] - 2025-04-15

_Initial release._

[2.1.7]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.1.7
[2.1.6]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.1.6
[2.1.0]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.1.0
[2.0.5]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.0.5
[2.0.2]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.0.2
[2.0.0]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v2.0.0
[1.0.0]: https://github.com/vertigis/vertigis-sdk-library/releases/tag/v1.0.0
