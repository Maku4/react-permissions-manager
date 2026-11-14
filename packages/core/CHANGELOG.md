# @react-permissions-manager/core

## 0.2.0

### Minor Changes

- 46d2937: Add `createPermissionChecker` for checks outside React and `usePermissionFilter` for lists.

  `createPermissionChecker(config, { guards })` returns `has`, `can`, `satisfies` and `filter`. Each takes the user it is about (`{ permissions?, roles? }`) and keeps no state, so one checker is safe to share between requests on the server. It calls no React API.

  `usePermissionFilter()`, returned by `createPermissionsAPI` next to `useCan`, gives a function that keeps the items of a list the user may see, for menus, tabs and dashboards.

  The components, hooks and the checker now run the same rule functions, so they cannot drift apart.

- 57e9b27: Add `PermissionsProvider`, `createPermissionGuard` and the `@react-permissions-manager/core/server` entry point.

  - `PermissionsProvider`, returned by `createPermissionsAPI`, gives the components and hooks below it their own manager, starting with `initial`. With server rendering each request gets its own state, and permitted content is in the first HTML. A changed `initial` switches to a new manager in the same render, so no component renders the new user with the previous user's permissions.
  - `usePermissionsManager()` returns the manager of the nearest provider, or `core` outside one.
  - `createPermissionGuard(config, { getSubject, onDenied, guards })` gives `has`, `can`, `satisfies` and `filter` for the user of the current request, with every check denied when nobody is signed in, plus `require` and `requireCan`, which call `onDenied` when the check fails.
  - `@react-permissions-manager/core/server` exports `definePermissionsConfig`, `createPermissionChecker` and `createPermissionGuard` without importing React.

- 422b344: Loads now replace the state, and the status tells "not known yet" from "no access".

  **Breaking**

  - `loadFrom` replaces the permissions and roles with what the loader returns. Before, permissions were added to the granted ones and an empty list of roles kept the old roles, so a permission the user lost stayed until `clear()`. A field left out of the result now means none.
  - When the loader throws, the status becomes `'error'` instead of `'ready'`, and `getState().error` holds what was thrown. The permissions and roles still stay as they were.
  - A `loadFrom` called when the status is `'ready'` no longer switches to `'loading'`. The current permissions apply until the result arrives, so a refresh does not hide the interface.

  - In the `'idle'` status every check is denied, like in `'loading'`. Before, `require={{}}` and a `noneOf`-only requirement passed before any permissions were set. Call `set({})` for a visitor who has no permissions.
  - A guard allows only by returning `true`. Before, any truthy value allowed, including the promise returned by an `async` guard, which let a denied action through.
  - Server rendering and hydration read the state the manager was created with (`getInitialState()`), as `useSyncExternalStore` requires. Changes made to `core` on the server no longer reach the HTML. Use `PermissionsProvider` or the `initial` option.

  **Added**

  - `core.set({ permissions?, roles? })` replaces the whole state in one call.
  - `initial` option of `createPermissionsAPI`, for apps rendered in the browser that know the permissions before the first render.
  - `usePermissionsStatus()`, returned by `createPermissionsAPI`.
  - `loading` prop on `<Can>` and `<PermissionGate>`, rendered while the status is `'idle'` or `'loading'`.
  - `PermissionsStatus` type.

  **Fixed**

  - When loads overlap, only the one started last is applied. A load that finishes after `set`, `grant`, `setRoles` or `clear` is dropped, so it cannot undo the later call.
  - A state change between server rendering and the end of hydration no longer causes a hydration mismatch.

## 0.1.0

### Minor Changes

- Initial release: `createPermissionsAPI`, `definePermissionsConfig`, the `Can` and `PermissionGate` components, the `useCan` and `usePermissionsStore` hooks and `PermissionsManager`.
