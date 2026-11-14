---
'@react-permissions-manager/core': minor
---

Loads now replace the state, and the status tells "not known yet" from "no access".

**Breaking**

- `loadFrom` replaces the permissions and roles with what the loader returns. Before, permissions were added to the granted ones and an empty list of roles kept the old roles, so a permission the user lost stayed until `clear()`. A field left out of the result now means none.
- When the loader throws, the status becomes `'error'` instead of `'ready'`, and `getState().error` holds what was thrown. The permissions and roles still stay as they were.
- A `loadFrom` called when the status is `'ready'` no longer switches to `'loading'`. The current permissions apply until the result arrives, so a refresh does not hide the interface.

**Added**

- `core.set({ permissions?, roles? })` replaces the whole state in one call.
- `initial` option of `createPermissionsAPI`, for apps rendered in the browser that know the permissions before the first render.
- `usePermissionsStatus()`, returned by `createPermissionsAPI`.
- `loading` prop on `<Can>` and `<PermissionGate>`, rendered while the status is `'idle'` or `'loading'`.
- `PermissionsStatus` type.

**Fixed**

- When loads overlap, only the one started last is applied. A load that finishes after `set` or `clear` is dropped.
