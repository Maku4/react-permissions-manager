import { expectError, expectType } from 'tsd';
import {
  createPermissionChecker,
  createPermissionGuard,
  createPermissionsAPI,
  definePermissionsConfig,
  usePermissionsStore,
  type PermissionId,
  type PermissionsManager,
  type PermissionState,
  type UIPolicyEntry,
} from '../src';

const config = definePermissionsConfig({
  permissions: {
    PostsRead: 'Read posts',
    PostsUpdate: 'Update posts',
    UsersRead: 'Read users',
  },
  features: {
    posts: { read: 'PostsRead', update: 'PostsUpdate' },
    users: { read: 'UsersRead' },
  },
  roles: {
    editor: ['PostsRead', 'PostsUpdate'],
  },
});

// 1. Config literals are kept
expectType<'PostsRead' | 'PostsUpdate' | 'UsersRead'>(
  {} as PermissionId<typeof config>
);

// 1.1. Features and roles can only reference declared permissions
expectError(
  definePermissionsConfig({
    permissions: { PostsRead: 'Read posts' },
    features: { posts: { read: 'PostsWrite' } },
    roles: {},
  })
);
expectError(
  definePermissionsConfig({
    permissions: { PostsRead: 'Read posts' },
    features: {},
    roles: { editor: ['PostsWrite'] },
  })
);

// 2. API without guards
const api = createPermissionsAPI(config);
expectType<PermissionsManager<typeof config>>(api.core);

// 2.1. useCan with a permission id returns a boolean
expectType<boolean>(api.useCan('PostsRead'));
expectError(api.useCan('PostsDelete'));

// 2.2. useCan with an action and a feature returns the detailed result
expectType<{ allowed: boolean; ui?: UIPolicyEntry }>(
  api.useCan('update', 'posts')
);
expectError(api.useCan('update', 'users'));
expectError(api.useCan('read', 'comments'));

// 2.3. <Can> accepts only actions of the given feature
api.Can({ I: 'update', a: 'posts', children: null });
expectError(api.Can({ I: 'update', a: 'users', children: null }));
expectError(api.Can({ I: 'read', a: 'comments', children: null }));

// 2.4. <PermissionGate> accepts only declared permission ids
api.PermissionGate({ require: 'UsersRead', children: null });
api.PermissionGate({
  require: { allOf: ['PostsRead'], noneOf: ['UsersRead'] },
  children: null,
});
expectError(api.PermissionGate({ require: 'UsersWrite', children: null }));
expectError(
  api.PermissionGate({ require: { anyOf: ['UsersWrite'] }, children: null })
);

// 2.5. Children can be a render function that receives the result
api.Can({
  I: 'read',
  a: 'posts',
  children: (allowed) => {
    expectType<boolean>(allowed);
    return null;
  },
});

// 3. Guards give each feature its own context type
interface PostContext {
  authorId: string;
  userId: string;
}
const guarded = createPermissionsAPI(config, {
  guards: {
    byFeature: {
      posts: {
        context: {} as PostContext,
        update: (context: PostContext) => context.authorId === context.userId,
      },
    },
  },
});
guarded.Can({
  I: 'update',
  a: 'posts',
  of: { authorId: 'a', userId: 'a' },
  children: null,
});
expectError(
  guarded.Can({
    I: 'update',
    a: 'posts',
    of: { authorId: 'a' },
    children: null,
  })
);
guarded.useCan('update', 'posts', { authorId: 'a', userId: 'a' });
expectError(guarded.useCan('update', 'posts', { authorId: 1, userId: 'a' }));

// 4. UI policy keys follow the config
createPermissionsAPI(config, {
  uiPolicy: {
    posts: { _default: { mode: 'disable' }, update: { mode: 'hide' } },
  },
});
expectError(
  createPermissionsAPI(config, {
    uiPolicy: { posts: { delete: { mode: 'hide' } } },
  })
);
expectError(
  createPermissionsAPI(config, {
    uiPolicy: { posts: { update: { mode: 'blur' } } },
  })
);

// 5. Store hook
expectType<PermissionState<typeof config>>(usePermissionsStore(api.core));
expectType<number>(
  usePermissionsStore(api.core, (state) => state.granted.size)
);

// 6. Checker for code outside React
const checker = createPermissionChecker(config);
expectType<boolean>(checker.has({ permissions: ['PostsRead'] }, 'PostsRead'));
expectError(checker.has({}, 'PostsDelete'));
expectType<boolean>(checker.can({ roles: ['editor'] }, 'update', 'posts'));
expectError(checker.can({}, 'update', 'users'));
expectType<boolean>(checker.satisfies({}, { anyOf: ['PostsRead'] }));
expectError(checker.satisfies({}, { anyOf: ['PostsDelete'] }));

const guardedChecker = createPermissionChecker(config, {
  guards: {
    byFeature: {
      posts: {
        context: {} as PostContext,
        update: (context: PostContext) => context.authorId === context.userId,
      },
    },
  },
});
guardedChecker.can({}, 'update', 'posts', { authorId: 'a', userId: 'a' });
expectError(guardedChecker.can({}, 'update', 'posts', { authorId: 'a' }));

// 6.1. Filtering keeps the item type and checks requirement ids
interface NavItem {
  href: string;
  requires?: PermissionId<typeof config>;
}
const navItems: NavItem[] = [];
expectType<NavItem[]>(checker.filter({}, navItems, (item) => item.requires));
expectError(checker.filter({}, navItems, () => 'PostsDelete'));

// 7. Filter hook
const filterAllowed = api.usePermissionFilter();
expectType<NavItem[]>(filterAllowed(navItems, (item) => item.requires));
expectError(filterAllowed(navItems, () => 'PostsDelete'));

// 8. Status hook, loading fallback, initial state and replacing the state
expectType<'idle' | 'loading' | 'ready' | 'error'>(api.usePermissionsStatus());
api.Can({ I: 'update', a: 'posts', loading: null, children: null });
api.PermissionGate({ require: 'PostsRead', loading: null, children: null });
createPermissionsAPI(config, {
  initial: { permissions: ['PostsRead'], roles: ['editor'] },
});
expectError(
  createPermissionsAPI(config, { initial: { permissions: ['PostsDelete'] } })
);
expectError(createPermissionsAPI(config, { initial: { roles: ['nobody'] } }));
api.core.set({ permissions: ['PostsRead'], roles: ['editor'] });
api.core.set({});

// 9. Provider and scoped manager
api.PermissionsProvider({
  initial: { permissions: ['PostsRead'], roles: ['editor'] },
  children: null,
});
api.PermissionsProvider({ children: null });
expectError(
  api.PermissionsProvider({
    initial: { permissions: ['PostsDelete'] },
    children: null,
  })
);
expectType<typeof api.core>(api.usePermissionsManager());

// 10. Guard for the user of the current request
interface SessionUser {
  id: string;
  roles: string[];
}
const guard = createPermissionGuard(config, {
  getSubject: async (): Promise<SessionUser | null> => null,
  onDenied: () => {
    throw new Error('denied');
  },
});
expectType<Promise<boolean>>(guard.has('PostsRead'));
expectError(guard.has('PostsDelete'));
expectType<Promise<boolean>>(guard.can('update', 'posts'));
expectError(guard.can('update', 'users'));
expectType<Promise<SessionUser>>(guard.require({ anyOf: ['PostsRead'] }));
expectType<Promise<SessionUser>>(guard.requireCan('update', 'posts'));
expectError(guard.require('PostsDelete'));
expectType<Promise<NavItem[]>>(guard.filter(navItems, (item) => item.requires));
expectError(
  createPermissionGuard(config, {
    getSubject: () => null,
    onDenied: () => undefined,
  })
);
