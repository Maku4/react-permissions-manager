# Contributing

This repository is a pnpm workspace with one published package: `packages/core` is `@react-permissions-manager/core`.

## Setup

Use the Node.js version in `.nvmrc` and the pnpm version in the `packageManager` field of `package.json`. With Corepack enabled, pnpm picks up the pinned version on its own.

```bash
pnpm install --frozen-lockfile
pnpm build
```

Build before running the type-level tests or the package checks. Both read the build output.

## Checks

Run these from the repository root before opening a pull request:

| Command                | What it runs                                              |
| :--------------------- | :-------------------------------------------------------- |
| `pnpm build`           | Builds the package                                        |
| `pnpm test`            | Vitest runtime tests                                      |
| `pnpm type-check`      | `tsc --noEmit`                                            |
| `pnpm test:types`      | Type-level tests with `tsd`                               |
| `pnpm lint`            | ESLint                                                    |
| `pnpm format:check`    | Prettier                                                  |
| `pnpm verify:packages` | Packs the package and installs it in React 18 and 19 apps |

`pnpm validate` runs all of them, the tests with coverage, the release script tests and `pnpm audit`. CI runs it on pull requests.

To run one test file, pass its path to Vitest:

```bash
pnpm exec vitest run packages/core/tests/can.spec.tsx
```

`pnpm test:coverage` prints a coverage report.

Runtime tests live in `packages/core/tests`. Type-level tests live in `packages/core/types-tests`.

## Changes

- Add a regression test that fails without your fix.
- Keep public API changes typed and covered by a type-level test.
- Update the README when behavior that users depend on changes.
- A change that makes a check pass where it used to fail needs a clear reason in the pull request. This library decides what users see.

## Changesets

Every change that affects the published package needs a changeset:

```bash
pnpm changeset
```

Pick the bump type, then describe the change from a user's point of view. Commit the generated file in `.changeset/` with your change. Maintainers version and publish from `main`. See [.github/RELEASING.md](.github/RELEASING.md).

## Reporting security issues

Do not describe a vulnerability in a public issue. Follow [SECURITY.md](SECURITY.md).
