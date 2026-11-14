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
- [Hook: `usePermissionsStatus`](#hook-usepermissionsstatus)
- [Filtering lists](#filtering-lists)
- [Outside React: `createPermissionChecker`](#outside-react-createpermissionchecker)
- [TypeScript guide](#typescript-guide)
- [Client-rendered apps (Vite)](#client-rendered-apps-vite)
- [SSR and Next.js](#ssr-and-nextjs)
  - [Rendering: `PermissionsProvider`](#rendering-permissionsprovider)
  - [Protecting routes and data](#protecting-routes-and-data)
- [Accessibility](#accessibility)
- [Troubleshooting](#troubleshooting)
- [When to use CASL instead](#when-to-use-casl-instead)
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

Tell the manager what the signed-in user has. Clear it when they sign out. Each load replaces what was there, so a permission the user lost disappears on the next load.

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

If you already have the data, call `permissionsManager.set({ permissions: ['PostsRead'], roles: ['viewer'] })`. If you have it before the first render, for example in a token, pass it as [`initial`](#client-rendered-apps-vite) and skip the load.

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
| `loading`          | `ReactNode`                           | Rendered instead of `fallback` while the permissions are not known yet.              |
| `tooltip`          | `ReactNode`                           | Explanation shown in `disable` mode.                                                 |
| `TooltipComponent` | component                             | Wraps the disabled element. See [Tooltips](#tooltips).                               |
| `children`         | `ReactNode \| (allowed) => ReactNode` | Content, or a function that receives the result.                                     |

In `disable` mode the child stays visible. If it is a single element, it receives `disabled`, `aria-disabled` and, for a string tooltip, `title`. It is wrapped in a `<span aria-disabled>` that blocks pointer events and lowers the opacity.

```tsx
<Can I="update" a="posts" mode="disable" tooltip="Only editors can edit">
  <button>Edit</button>
</Can>
```

`loading` is used while the status is `'idle'` or `'loading'`, so a skeleton can stand in for content that may still appear. Without it, `fallback` and `mode` apply from the first render.

```tsx
<Can I="read" a="posts" loading={<Skeleton />} fallback={<NoAccess />}>
  <PostList />
</Can>
```

A function child receives the result and renders whatever it returns. `mode`, `fallback` and `loading` are not applied.

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

`PermissionGate` takes the same `mode`, `fallback`, `loading`, `tooltip`, `TooltipComponent` and function children as `Can`. In `disable` mode it wraps the children in the disabled `<span>` but does not add `disabled` to the child.

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

| Method                | Description                                                                          |
| :-------------------- | :----------------------------------------------------------------------------------- |
| `set(next)`           | Replaces every permission and role with `{ permissions?, roles? }`.                  |
| `loadFrom(loader)`    | Awaits `loader()`, which returns `{ permissions?, roles? }`, and replaces the state. |
| `grant(permissions)`  | Adds permissions to the ones already granted.                                        |
| `setRoles(roles)`     | Replaces the current roles and keeps the permissions.                                |
| `clear()`             | Removes every permission and role and returns to `'idle'`.                           |
| `startLoading()`      | Marks the state as loading.                                                          |
| `getState()`          | Returns `{ status, granted, roles, error? }`.                                        |
| `subscribe(listener)` | Calls `listener` on every change. Returns an unsubscribe function.                   |

### Status

| Status      | Meaning                                         | Checks                         |
| :---------- | :---------------------------------------------- | :----------------------------- |
| `'idle'`    | Nothing was set yet, or `clear()` was called.   | Denied, nothing is granted.    |
| `'loading'` | The first load is running.                      | Denied.                        |
| `'ready'`   | Permissions and roles are known.                | Run against the current state. |
| `'error'`   | The last load failed. `error` holds the reason. | Run against the current state. |

`'idle'` means "not known yet". For a visitor you know has no permissions, call `set({})`: the status becomes `'ready'` and `loading` fallbacks stop showing.

### Loading and reloading

`set` and `loadFrom` replace the whole state. A field left out of the result means none, so `{ permissions: ['PostsRead'] }` also removes every role.

The first `loadFrom` sets the status to `'loading'`. A `loadFrom` called when the status is `'ready'` is a reload: the status and the current permissions stay until the result arrives, so the interface does not blink.

If the loader throws, the permissions and roles stay as they were, the status becomes `'error'` and `getState().error` holds what was thrown. A failed load never adds access. After a failed first load nothing is granted.

When loads overlap, only the one started last is applied. A load is also dropped when `set` or `clear` runs before it finishes, so a slow response cannot bring back a signed-out user's permissions.

`grant` adds and never removes. To replace a user's permissions, use `set`.

A role name that is not in the config grants nothing.

---

## Hook: `usePermissionsStore`

Reads the manager's state in a component. For the status alone, [`usePermissionsStatus`](#hook-usepermissionsstatus) is shorter.

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

## Hook: `usePermissionsStatus`

Returns the [status](#status) of the permissions. Use it where a denial has a side effect, such as a redirect, so it does not fire before the permissions arrive:

```tsx
import { Navigate } from 'react-router';
import { useCan, usePermissionsStatus } from './permissions';

function RequirePostsRead({ children }: { children: React.ReactNode }) {
  const status = usePermissionsStatus();
  const allowed = useCan('PostsRead');

  if (status === 'idle' || status === 'loading') return <Spinner />;
  return allowed ? children : <Navigate to="/" replace />;
}
```

---

## Filtering lists

Menus, tabs and dashboards are lists where each item may need a permission. `usePermissionFilter` returns a function that keeps the items the user may see:

```tsx
const links = [
  { href: '/', label: 'Home' },
  { href: '/posts', label: 'Posts', requires: 'PostsRead' },
  { href: '/posts/new', label: 'New post', requires: 'PostsCreate' },
] as const;

function Menu() {
  const filterAllowed = usePermissionFilter();
  const visibleLinks = useMemo(
    () => filterAllowed(links, (link) => link.requires),
    [filterAllowed]
  );
  return visibleLinks.map((link) => <a href={link.href}>{link.label}</a>);
}
```

The second argument returns what an item needs: a permission id, an object with `anyOf`, `allOf` and `noneOf`, or `undefined` for an item everyone may see. The returned function changes when permissions or roles change, so it works as a `useMemo` dependency. While permissions are loading, only unrestricted items are kept.

Get `usePermissionFilter` from `createPermissionsAPI`, next to `Can` and `useCan`.

---

## Outside React: `createPermissionChecker`

On the server, in a route handler or in a test there is no component to subscribe. `createPermissionChecker` gives the same checks as plain functions that take the user they are about:

```ts
// permissions/checker.ts
import { createPermissionChecker } from '@react-permissions-manager/core/server';
import { permissionsConfig } from './config';

export const permissions = createPermissionChecker(permissionsConfig);
```

```ts
const user = { permissions: session.permissions, roles: session.roles };

permissions.has(user, 'PostsRead'); // like useCan('PostsRead')
permissions.can(user, 'update', 'posts'); // like <Can I="update" a="posts">
permissions.can(user, 'update', 'posts', { post, user }); // with a guard context
permissions.satisfies(user, { anyOf: ['PostsCreate', 'PostsUpdate'] }); // like <PermissionGate>
permissions.filter(user, links, (link) => link.requires); // like usePermissionFilter
```

| Method                                 | Returns                                                     |
| :------------------------------------- | :---------------------------------------------------------- |
| `has(user, permission)`                | Whether the user has the permission, directly or by a role. |
| `can(user, action, feature, context?)` | Whether the action is allowed, including its guard.         |
| `satisfies(user, require)`             | Whether `anyOf`, `allOf` and `noneOf` all hold.             |
| `filter(user, items, getRequirement)`  | The items the user may see.                                 |

`user` is `{ permissions?, roles? }`, each any iterable of strings. The checker keeps nothing between calls, so one instance is safe to share between requests. It has no loading state: it answers for exactly the user you pass.

Pass the same `guards` to `createPermissionChecker` and `createPermissionsAPI` so both sides apply the same rules.

The `@react-permissions-manager/core/server` entry point imports no React, so it also works in scripts and services where React is not installed. It exports `definePermissionsConfig`, `createPermissionChecker`, `createPermissionGuard` and the config types. The main entry point exports them too.

### `createPermissionGuard`: checks for the current request

In a request handler the user is always "whoever sent this request". `createPermissionGuard` reads that user for you and adds `require` and `requireCan`, which stop the request when the check fails:

```ts
// permissions/guard.ts
import { createPermissionGuard } from '@react-permissions-manager/core/server';
import { permissionsConfig } from './config';
import { getCurrentUser } from '../auth/session';

export const guard = createPermissionGuard(permissionsConfig, {
  getSubject: getCurrentUser,
  onDenied: ({ subject }) => {
    throw new HttpError(subject ? 403 : 401);
  },
});
```

```ts
const user = await guard.requireCan('update', 'posts', { post }); // throws through onDenied
await guard.require({ anyOf: ['PostsCreate', 'PostsUpdate'] });

if (await guard.can('delete', 'posts')) {
  // ...
}
const visible = await guard.filter(links, (link) => link.requires);
```

| Option       | Description                                                                                                      |
| :----------- | :--------------------------------------------------------------------------------------------------------------- |
| `getSubject` | Returns the user of the current request, or `null`. May be async. It runs on every call, so memoize it.          |
| `onDenied`   | Runs when `require` or `requireCan` fails. It must throw or redirect. `subject` is `null` for a signed-out user. |
| `guards`     | The same guards as in `createPermissionsAPI`.                                                                    |

| Method                                  | Returns                                                         |
| :-------------------------------------- | :-------------------------------------------------------------- |
| `has(permission)`                       | `Promise<boolean>`                                              |
| `can(action, feature, context?)`        | `Promise<boolean>`                                              |
| `satisfies(require)`                    | `Promise<boolean>`                                              |
| `filter(items, getRequirement)`         | `Promise<TItem[]>`                                              |
| `require(require)`                      | The user, as returned by `getSubject`. Calls `onDenied` if not. |
| `requireCan(action, feature, context?)` | The user. Calls `onDenied` if not.                              |

Without a user every check is denied, including `require({})`. `filter` then keeps only the items without a requirement.

The guard keeps no state. The user comes from `getSubject` on each call, so one guard is safe to share between requests. See [SSR and Next.js](#ssr-and-nextjs) for a full Next.js setup.

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

## Client-rendered apps (Vite)

In an app rendered only in the browser, one tab serves one user, so the manager in module scope is all you need.

If the permissions are available before the first render, pass them as `initial`. The manager starts `'ready'` and the first render is already correct:

```ts
// permissions/index.ts
import { createPermissionsAPI } from '@react-permissions-manager/core';
import { permissionsConfig } from './config';
import { readSessionFromToken } from '../auth/token';

const session = readSessionFromToken();

export const { Can, PermissionGate, useCan, usePermissionsStatus, core } =
  createPermissionsAPI(permissionsConfig, {
    initial: session
      ? { permissions: session.permissions, roles: session.roles }
      : undefined,
  });
```

Call `core.loadFrom(...)` afterwards to refresh them from the API. It is a reload, so nothing is hidden while it runs.

If they come only from a request, call `loadFrom` as in the [quick start](#3-load-the-users-permissions). Use the `loading` prop for content and [`usePermissionsStatus`](#hook-usepermissionsstatus) for redirects.

Do not use the `initial` option of `createPermissionsAPI` in an app rendered on the server: the manager is shared between requests there. Use [`PermissionsProvider`](#rendering-permissionsprovider) instead.

---

## SSR and Next.js

On the server one module instance serves every request, so the shared manager (`core`) must not hold a user there: one user's permissions would be visible to the next request. Two tools replace it. `PermissionsProvider` gives each rendered tree its own manager, and [`createPermissionGuard`](#createpermissionguard-checks-for-the-current-request) protects routes and data.

### Rendering: `PermissionsProvider`

Create the API in a Client Component module, because the components and hooks run on the client:

```tsx
// permissions/index.ts
'use client';
import { createPermissionsAPI } from '@react-permissions-manager/core';
import { permissionsConfig } from './config';

export const { Can, PermissionGate, useCan, PermissionsProvider } =
  createPermissionsAPI(permissionsConfig);
```

Read the session on the server and pass it down:

```tsx
// app/(app)/layout.tsx
import { PermissionsProvider } from '@/permissions';
import { getCurrentUser } from '@/auth/session';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await getCurrentUser();
  return (
    <PermissionsProvider
      initial={user ? { permissions: user.permissions, roles: user.roles } : {}}
    >
      {children}
    </PermissionsProvider>
  );
}
```

The server render and the first client render both use `initial`, so permitted content is in the HTML and nothing flashes. `Can`, `PermissionGate` and the hooks below the provider read its manager and ignore `core`.

| `initial`                | The provider's manager starts as                        |
| :----------------------- | :------------------------------------------------------ |
| `{ permissions, roles }` | `'ready'` with these.                                   |
| `{}`                     | `'ready'` with nothing: a known user without access.    |
| left out                 | `'idle'`: not known yet. `loading` fallbacks are shown. |

When `initial` changes, for example after `router.refresh()`, the provider replaces its manager's state with the new value. A new object with the same content changes nothing.

To change the permissions from a component, for example after the user switches a workspace, get the provider's manager with `usePermissionsManager()`:

```tsx
const manager = usePermissionsManager();
await manager.loadFrom(fetchPermissions);
```

Outside a provider `usePermissionsManager()` returns `core`.

### Protecting routes and data

Hiding a button does not stop a request. Check on the server, next to the data:

```ts
// permissions/guard.ts
import 'server-only';
import { cache } from 'react';
import { forbidden, redirect } from 'next/navigation';
import { createPermissionGuard } from '@react-permissions-manager/core/server';
import { permissionsConfig } from './config';
import { getSession } from '@/auth/session';

const getUser = cache(async () => (await getSession())?.user ?? null);

export const guard = createPermissionGuard(permissionsConfig, {
  getSubject: getUser,
  onDenied: ({ subject }) => (subject ? forbidden() : redirect('/login')),
});
```

```tsx
// app/(app)/posts/page.tsx
export default async function PostsPage() {
  await guard.requireCan('read', 'posts');
  return <PostList posts={await getPosts()} />;
}
```

```ts
// app/(app)/posts/actions.ts
'use server';

export async function updatePost(id: string, data: PostInput) {
  const post = await getPost(id);
  const user = await guard.requireCan('update', 'posts', { post });
  // ...
}
```

- `cache` from React makes `getSubject` read the session once per request.
- `forbidden()` needs `experimental.authInterrupts` in `next.config`. Without it, use `notFound()` or a redirect.
- `forbidden()`, `redirect()` and `notFound()` work by throwing, so `await` every `require` call and do not wrap it in a `try` that swallows the error.
- Call the guard in pages, server functions and route handlers, or in the functions that load the data. A check in a layout alone is not enough: layouts do not re-render on client navigation.

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
   - When `status` is `'error'`, the load failed. Read `getState().error`.
   - Role names must match the keys of `roles` in the config.
2. **A user is redirected before the permissions load.**
   - Before the first load every check is denied. Wait for [`usePermissionsStatus`](#hook-usepermissionsstatus) to leave `'idle'` and `'loading'`.
3. **A `loading` fallback never goes away.**
   - The status is still `'idle'`. For a visitor without an account call `set({})`.
4. **A guarded action is always denied.**
   - Pass the context: `of` on `<Can>`, or the third argument of `useCan`.
   - The guard runs only after the permission check passes.
5. **Permissions from one user show up for another on the server.**
   - The shared manager is used on the server. Wrap the tree in [`PermissionsProvider`](#rendering-permissionsprovider) and do not call `core` there.
6. **`usePermissionsStore` re-renders in a loop.**
   - The selector returns a new object or array on each call. Return a primitive or a field of the state.

---

## When to use CASL instead

[CASL](https://casl.js.org) is the established authorization library for JavaScript, and it does more than this one. Choose it when you need:

- rules written as data, stored in a database or sent from the backend as JSON
- conditions on records that also turn into database queries, through its Prisma and Mongoose packages
- permissions on individual fields
- inverted rules (`cannot`) with a reason

This library is for applications where the backend already decides what a user may do and sends a list of permissions or roles, and the interface has to follow it: hide and disable elements, filter menus and guard routes, with types inferred from one config.

---

## Bundling and versioning

- The package ships CommonJS and ES module builds with TypeScript declarations.
- `react` is a peer dependency and is not bundled.
- The package exports its version: `import { version } from '@react-permissions-manager/core'`.

## Contributing and security

See [CONTRIBUTING.md](https://github.com/Maku4/react-permissions-manager/blob/main/CONTRIBUTING.md) for setup and checks, and [SECURITY.md](https://github.com/Maku4/react-permissions-manager/blob/main/SECURITY.md) to report a vulnerability.

## License

[MIT](LICENSE)
