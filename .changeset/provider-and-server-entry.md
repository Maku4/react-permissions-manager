---
'@react-permissions-manager/core': minor
---

Add `PermissionsProvider`, `createPermissionGuard` and the `@react-permissions-manager/core/server` entry point.

- `PermissionsProvider`, returned by `createPermissionsAPI`, gives the components and hooks below it their own manager, starting with `initial`. With server rendering each request gets its own state, and permitted content is in the first HTML. A changed `initial` switches to a new manager in the same render, so no component renders the new user with the previous user's permissions.
- `usePermissionsManager()` returns the manager of the nearest provider, or `core` outside one.
- `createPermissionGuard(config, { getSubject, onDenied, guards })` gives `has`, `can`, `satisfies` and `filter` for the user of the current request, with every check denied when nobody is signed in, plus `require` and `requireCan`, which call `onDenied` when the check fails.
- `@react-permissions-manager/core/server` exports `definePermissionsConfig`, `createPermissionChecker` and `createPermissionGuard` without importing React.
