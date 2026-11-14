---
'@react-permissions-manager/core': minor
---

Loads now replace the state, and the status tells "not known yet" from "no access".

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
