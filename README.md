# React Permissions Manager

Typed permission checks for React 18 and 19.

- Declarative. `<Can I="update" a="posts">` states what an element needs, and the component hides or disables it.
- Typed. Permission ids, features, actions and guard contexts are inferred from one config object, so a typo is a compile error.
- Three levels. Raw permissions, feature actions mapped to permissions, and guards for rules that depend on data.
- No runtime dependencies besides React.

These checks decide what the interface shows. They are not a security boundary: the server must check every request on its own.

---

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Concepts](#concepts)
- [Components](#components)
  - [`<Can>`](#can)
  - [`<PermissionGate>`](#permissiongate)
- [Hook: `useCan`](#hook-usecan)
- [Guards](#guards)
- [UI policy](#ui-policy)
- [The manager](#the-manager)
- [Hook: `usePermissionsStore`](#hook-usepermissionsstore)
- [TypeScript guide](#typescript-guide)
- [SSR and Next.js](#ssr-and-nextjs)
- [Accessibility](#accessibility)
- [Troubleshooting](#troubleshooting)
- [Bundling and versioning](#bundling-and-versioning)
- [Contributing and security](#contributing-and-security)
- [License](#license)

---

## Installation

```bash
pnpm add @react-permissions-manager/core   # or npm / yarn
```

---

## Quick start

### 1. Define the config

```ts
// permissions/config.ts
import { definePermissionsConfig } from '@react-permissions-manager/core';

export const permissionsConfig = definePermissionsConfig({
  // Every permission the backend can grant, with a description
  permissions: {
    PostsRead: 'Read posts',
    PostsCreate: 'Create posts',
    PostsUpdate: 'Update posts',
  },
  // Features of the app and the permission each action needs
  features: {
    posts: {
      read: 'PostsRead',
      create: 'PostsCreate',
      update: 'PostsUpdate',
    },
  },
  // Roles and the permissions they include
  roles: {
    editor: ['PostsRead', 'PostsCreate', 'PostsUpdate'],
    viewer: ['PostsRead'],
  },
});
```

`features` and `roles` can only name permissions declared in `permissions`.

### 2. Create the API

```ts
// permissions/index.ts
import { createPermissionsAPI } from '@react-permissions-manager/core';
import { permissionsConfig } from './config';

export const {
  Can,
  PermissionGate,
  useCan,
  core: permissionsManager,
} = createPermissionsAPI(permissionsConfig);
```

Import `Can`, `PermissionGate`, `useCan` and `permissionsManager` from this file everywhere else in the app.

### 3. Load the user's permissions

Tell the manager what the signed-in user has. Clear it when they sign out.

```tsx
// permissions/PermissionsSync.tsx
'use client';
import { useEffect } from 'react';
import { permissionsManager } from './index';

export function PermissionsSync({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) {
      permissionsManager.clear();
      return;
    }
    void permissionsManager.loadFrom(async () => {
      const response = await fetch('/api/me/permissions');
      const data: { permissions: string[]; roles: string[] } =
        await response.json();
      return data;
    });
  }, [userId]);

  return null;
}
```

If you already have the data, call `permissionsManager.grant(['PostsRead'])` or `permissionsManager.setRoles(['viewer'])` directly.

### 4. Check

```tsx
import { Can } from './permissions';

<Can I="create" a="posts">
  <button>New post</button>
</Can>;
```

The button renders only for users who can create posts. It appears as soon as the permissions load, with no extra wiring.

---

## Concepts

| Term       | Meaning                                                                                       |
| :--------- | :-------------------------------------------------------------------------------------------- |
| Permission | An id the backend grants, for example `PostsUpdate`.                                          |
| Feature    | A part of the app, for example `posts`.                                                       |
| Action     | Something a user does to a feature, for example `update`. Each action maps to one permission. |
| Role       | A named list of permissions.                                                                  |
| Guard      | A function that decides an action from data, for example "only the author can update".        |

Components ask about actions, not permission ids. If the backend renames a permission, you change one line in the config.

A user has a permission when it was granted directly or when one of their roles includes it.

---

## Components

### `<Can>`

Renders its children when the user can perform action `I` on feature `a`.

```tsx
<Can I="update" a="posts">
  <button>Edit</button>
</Can>
```

| Prop               | Type                                  | Description                                                                          |
| :----------------- | :------------------------------------ | :----------------------------------------------------------------------------------- |
| `I`                | action of the feature                 | The action to check.                                                                 |
| `a`                | feature name                          | The feature the action belongs to.                                                   |
| `of`               | guard context of the feature          | Data passed to the [guard](#guards) of this action.                                  |
| `mode`             | `'hide' \| 'disable'`                 | What to do when the check fails. Defaults to the [UI policy](#ui-policy), then hide. |
| `fallback`         | `ReactNode`                           | Rendered instead of the children in `hide` mode.                                     |
| `tooltip`          | `ReactNode`                           | Explanation shown in `disable` mode.                                                 |
| `TooltipComponent` | component                             | Wraps the disabled element. See [Tooltips](#tooltips).                               |
| `children`         | `ReactNode \| (allowed) => ReactNode` | Content, or a function that receives the result.                                     |

In `disable` mode the child stays visible. If it is a single element, it receives `disabled`, `aria-disabled` and, for a string tooltip, `title`. It is wrapped in a `<span aria-disabled>` that blocks pointer events and lowers the opacity.

```tsx
<Can I="update" a="posts" mode="disable" tooltip="Only editors can edit">
  <button>Edit</button>
</Can>
```

A function child receives the result and renders whatever it returns. `mode` and `fallback` are not applied.

```tsx
<Can I="update" a="posts">
  {(allowed) => <PostMenu readOnly={!allowed} />}
</Can>
```

### `<PermissionGate>`

Checks raw permission ids, without features and actions.

```tsx
<PermissionGate require="PostsRead">
  <PostList />
</PermissionGate>

<PermissionGate require={{ anyOf: ['PostsCreate', 'PostsUpdate'] }}>
  <EditorToolbar />
</PermissionGate>

<PermissionGate require={{ allOf: ['PostsRead'], noneOf: ['PostsUpdate'] }}>
  <ReadOnlyBanner />
</PermissionGate>
```

`require` is one permission id or an object with `anyOf`, `allOf` and `noneOf`. Every list you pass must hold. A list you leave out is not checked, so `require={{}}` always passes.

`PermissionGate` takes the same `mode`, `fallback`, `tooltip`, `TooltipComponent` and function children as `Can`. In `disable` mode it wraps the children in the disabled `<span>` but does not add `disabled` to the child.

### Tooltips

The library does not render a tooltip of its own beyond the `title` attribute. Pass your design system's tooltip as `TooltipComponent`, or once for the whole app as `defaultTooltipComponent`:

```tsx
createPermissionsAPI(permissionsConfig, {
  defaultTooltipComponent: ({ title, content, children }) => (
    <Tooltip label={content ?? title}>{children}</Tooltip>
  ),
});
```

The component receives `content` (the tooltip as given), `title` (the tooltip when it is a string) and the disabled element as `children`.

---

## Hook: `useCan`

Use it for logic that is not plain show or hide.

With a permission id it returns a boolean:

```tsx
const canReadPosts = useCan('PostsRead');
```

With an action and a feature it returns the result and the UI policy entry for that action:

```tsx
const { allowed, ui } = useCan('update', 'posts');
```

A third argument is the context for the [guard](#guards):

```tsx
const { allowed } = useCan('update', 'posts', { post, user });
```

The component re-renders when permissions or roles change.

---

## Guards

A guard adds a rule that depends on data. It runs after the permission check, and both must pass.

```ts
interface PostContext {
  post: { authorId: string };
  user: { id: string };
}

export const { Can, useCan } = createPermissionsAPI(permissionsConfig, {
  guards: {
    byFeature: {
      posts: {
        // Never called. It gives `of` its type for this feature.
        context: {} as PostContext,
        update: ({ post, user }: PostContext) => post.authorId === user.id,
      },
    },
  },
});
```

Pass the data through `of`:

```tsx
<Can I="update" a="posts" of={{ post, user }}>
  <button>Edit</button>
</Can>
```

- A guard runs only when the user has the permission for the action.
- A guarded action checked without a context is denied. The guard cannot run, so the answer is no.
- Actions of the same feature without a guard ignore the context.

---

## UI policy

Set `mode` and `tooltip` once per feature instead of on every `<Can>`.

```ts
createPermissionsAPI(permissionsConfig, {
  uiPolicy: {
    posts: {
      // Every action of posts, unless it has its own entry
      _default: { mode: 'disable', tooltip: 'You do not have access' },
      update: { mode: 'hide' },
    },
  },
});
```

The order is: props on the component, the entry for the action, the feature's `_default`, then `hide`.

---

## The manager

`core` is a `PermissionsManager`. It holds the current user's permissions and roles and has no React dependency.

| Method                | Description                                                                                         |
| :-------------------- | :-------------------------------------------------------------------------------------------------- |
| `grant(permissions)`  | Adds permissions to the ones already granted.                                                       |
| `setRoles(roles)`     | Replaces the current roles.                                                                         |
| `clear()`             | Removes every permission and role.                                                                  |
| `loadFrom(loader)`    | Awaits `loader()`, which returns `{ permissions?, roles? }`. Loaded roles replace, permissions add. |
| `startLoading()`      | Marks the state as loading.                                                                         |
| `getState()`          | Returns `{ status, granted, roles }`.                                                               |
| `subscribe(listener)` | Calls `listener` on every change. Returns an unsubscribe function.                                  |

`status` is `'idle'` before anything is set, `'loading'` during `loadFrom` and `'ready'` afterwards.

While the status is `'loading'`, every check is denied, including permissions granted earlier. If the loader throws, the previous permissions and roles stay and the status becomes `'ready'`, so a failed load never adds access.

`grant` adds and never removes. To replace a user's permissions, call `clear()` first.

A role name that is not in the config grants nothing.

---

## Hook: `usePermissionsStore`

Reads the manager's state in a component, for example to show a loading indicator:

```tsx
import { usePermissionsStore } from '@react-permissions-manager/core';
import { permissionsManager } from './permissions';

function PermissionsStatus() {
  const status = usePermissionsStore(
    permissionsManager,
    (state) => state.status
  );
  return status === 'loading' ? <Spinner /> : null;
}
```

Without a selector it returns the whole state. A selector must return the same value for the same state, so return a primitive or a field of the state, not a new object.

---

## TypeScript guide

Types come from the config. Derive the ones you need:

```ts
import type {
  ActionNameFor,
  FeatureName,
  PermissionId,
  Role,
} from '@react-permissions-manager/core';

type AppPermission = PermissionId<typeof permissionsConfig>; // 'PostsRead' | ...
type AppFeature = FeatureName<typeof permissionsConfig>; // 'posts'
type PostAction = ActionNameFor<typeof permissionsConfig, 'posts'>; // 'read' | ...
type AppRole = Role<typeof permissionsConfig>; // 'editor' | 'viewer'
```

These are compile errors:

```tsx
<Can I="delete" a="posts" />; // posts has no delete action
<Can I="update" a="comments" />; // comments is not a feature
useCan('PostsDelete'); // not a declared permission
<PermissionGate require="PostsDelete" />;
```

`definePermissionsConfig` keeps literal types on its own, so `as const` is not needed.

The manager's methods accept plain strings, because permissions and roles usually come from a backend response.

---

## SSR and Next.js

`Can`, `PermissionGate`, `useCan` and `usePermissionsStore` use hooks, so use them in Client Components. The config is plain data and can be imported anywhere.

The manager created by `createPermissionsAPI` lives in module scope. On the server one module instance serves every request, so do not grant permissions there: one user's permissions would be visible to the next request. Load them in an effect on the client, as in the [quick start](#3-load-the-users-permissions).

During server rendering and the first client render nothing is granted, so every check is denied and both renders match. Content appears after the effect runs. If that flash matters, render a placeholder until `status` is `'ready'`.

Protect routes and data on the server with your own check. Hiding a link in the interface does not stop a request.

---

## Accessibility

- In `disable` mode the wrapper has `aria-disabled="true"`, and a single child element also receives `disabled` and `aria-disabled`.
- A string tooltip becomes a `title` attribute. For keyboard and screen reader users, pass a real tooltip through `TooltipComponent`.
- `pointer-events: none` on the wrapper stops mouse clicks. Native controls with `disabled` are also skipped by the keyboard. A custom element that ignores `disabled` can still be reached with Tab, so handle `aria-disabled` in it.
- Hidden content is not rendered at all.

---

## Troubleshooting

1. **Everything is denied.**
   - Check that the manager received permissions: `permissionsManager.getState()`.
   - While `status` is `'loading'`, every check is denied.
   - Role names must match the keys of `roles` in the config.
2. **A guarded action is always denied.**
   - Pass the context: `of` on `<Can>`, or the third argument of `useCan`.
   - The guard runs only after the permission check passes.
3. **Permissions from one user show up for another on the server.**
   - The manager is shared between requests on the server. Grant permissions on the client only.
4. **`usePermissionsStore` re-renders in a loop.**
   - The selector returns a new object or array on each call. Return a primitive or a field of the state.

---

## Bundling and versioning

- The package ships CommonJS and ES module builds with TypeScript declarations.
- `react` is a peer dependency and is not bundled.
- The package exports its version: `import { version } from '@react-permissions-manager/core'`.

## Contributing and security

See [CONTRIBUTING.md](https://github.com/Maku4/react-permissions-manager/blob/main/CONTRIBUTING.md) for setup and checks, and [SECURITY.md](https://github.com/Maku4/react-permissions-manager/blob/main/SECURITY.md) to report a vulnerability.

## License

[MIT](LICENSE)
