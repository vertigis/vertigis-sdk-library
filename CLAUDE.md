# CLAUDE.md

## Key Rules

- Do not run a command unless the user asks for it. Example: do not build or test after a change.
- Do not add a dependency unless the user asks for it.
- Obey the rules in this file also when the existing code does not. The rules are always correct.
- Write all messages in ASD-STE100 Simplified Technical English. You can use technical names and verbs from the code.
  Examples: `React`, `ESLint`, `npm`, file names, and function names.

## The Repository

- `@vertigis/sdk-library` is an npm package. It contains shared scripts and config for the VertiGIS Web SDK
  (`@vertigis/web-sdk`) and Workflow SDK (`@vertigis/workflow-sdk`).
- The SDK repos import these files. Thus, all exported files are a public API. Do not break them.
- `config/`: base config for webpack, ESLint, and TypeScript, and project paths (`paths.js`).
- `scripts/`: SDK CLI commands (`build`, `create`, `generate`, `start`, `upgrade`).
- `lib/web/`: the HTML template for Web projects.
- `lib/workflow/`: the activity loader, the metadata plugin, and compiler utilities for Workflow.
- `test/e2e/`: end-to-end tests. The SDK repos also run `test/e2e/tests.js`, so the package includes it.
- `semantic-release` releases from `main`. The PR title sets the version. It must obey Conventional Commits.
- A `CHANGELOG.md` file is maintained. Only releases with **external user facing** changes are included.

## Commands

- `npm run test`: run the unit tests and the end-to-end tests.
- `npm run test:unit`: run the unit tests with Jest.
- `npm run test:e2e`: run the end-to-end tests.
- `npm run prettier`: format all `.json`, `.js`, and `.md` files.
- `npm pack`: package for production: run `tsc`, pack, then clean up.

## Code Rules

- Write plain JavaScript as ES modules. Do not write TypeScript files.
- Start each file with `// @ts-check` and `"use strict";`.
- Use JSDoc for all types.
- Obey `.prettierrc` and `eslint.config.js`.
- Use the `projectType` value `"web"` or `"workflow"` when the behavior is different for each SDK.

## Tests

- Put unit tests in `test/unit/` with the name `<name>.test.js`. Jest uses `@swc/jest`.
- Jest keeps snapshots in `test/unit/__snapshots__/`.
- The end-to-end tests use `npm pack` to get the published Web SDK and Workflow SDK. Then they change the SDK imports to
  point to this local copy and run `test/e2e/tests.js`.
- The end-to-end tests need network access and Playwright Chromium.
- `test/e2e/upgradeProjects/` contains old SDK projects for the `upgrade` tests.
