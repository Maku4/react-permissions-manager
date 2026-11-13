---
'@react-permissions-manager/core': minor
---

Add `createPermissionChecker` for checks outside React and `usePermissionFilter` for lists.

`createPermissionChecker(config, { guards })` returns `has`, `can`, `satisfies` and `filter`. Each takes the user it is about (`{ permissions?, roles? }`) and keeps no state, so one checker is safe to share between requests on the server. It calls no React API.

`usePermissionFilter()`, returned by `createPermissionsAPI` next to `useCan`, gives a function that keeps the items of a list the user may see, for menus, tabs and dashboards.

The components, hooks and the checker now run the same rule functions, so they cannot drift apart.
