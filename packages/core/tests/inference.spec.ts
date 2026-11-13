import type { ComponentProps } from 'react';
import { describe, expectTypeOf, it } from 'vitest';
import { createPermissionsAPI, definePermissionsConfig } from '../src';

interface User {
  id: string;
}
interface Post {
  id: string;
  authorId: string;
}

const permissionsConfig = definePermissionsConfig({
  permissions: {
    DictionariesRead: 'Read dictionaries',
    DictionariesCreate: 'Create dictionaries',
    DictionariesUpdate: 'Update dictionaries',
    UsersRead: 'Read users',
    UsersWrite: 'Write users',
  },
  features: {
    dictionaries: {
      read: 'DictionariesRead',
      create: 'DictionariesCreate',
      update: 'DictionariesUpdate',
    },
    users: {
      read: 'UsersRead',
      create: 'UsersWrite',
    },
    post: {
      read: 'UsersRead',
      update: 'UsersWrite',
    },
  },
  roles: {
    repository_administrator: [
      'DictionariesRead',
      'DictionariesCreate',
      'DictionariesUpdate',
      'UsersRead',
      'UsersWrite',
    ],
    repository_viewer: ['DictionariesRead', 'UsersRead'],
  },
} as const);

const { Can, PermissionGate, useCan } = createPermissionsAPI(
  permissionsConfig,
  {
    guards: {
      byFeature: {
        post: {
          context: {} as { user: User; post: Post },
          update: (ctx: { user: User; post: Post }) =>
            ctx.user.id === ctx.post.authorId,
        },
      },
    },
    uiPolicy: {
      dictionaries: {
        _default: { mode: 'disable', tooltip: 'Not allowed' },
      },
    },
  }
);

describe('Type Inference', () => {
  it('PermissionGate.require should be typed to known PermissionIds and variants', () => {
    type Require = ComponentProps<typeof PermissionGate>['require'];
    expectTypeOf<Require>().toEqualTypeOf<
      | 'DictionariesRead'
      | 'DictionariesCreate'
      | 'DictionariesUpdate'
      | 'UsersRead'
      | 'UsersWrite'
      | {
          anyOf?: readonly (
            | 'DictionariesRead'
            | 'DictionariesCreate'
            | 'DictionariesUpdate'
            | 'UsersRead'
            | 'UsersWrite'
          )[];
          allOf?: readonly (
            | 'DictionariesRead'
            | 'DictionariesCreate'
            | 'DictionariesUpdate'
            | 'UsersRead'
            | 'UsersWrite'
          )[];
          noneOf?: readonly (
            | 'DictionariesRead'
            | 'DictionariesCreate'
            | 'DictionariesUpdate'
            | 'UsersRead'
            | 'UsersWrite'
          )[];
        }
    >();
    expectTypeOf(PermissionGate).toBeCallableWith({
      require: 'UsersRead',
      children: null,
    });
  });
});

describe('Component: <Can>', () => {
  it('feature and action props are constrained; basic assignability sanity', () => {
    type Props = ComponentProps<typeof Can>;
    expectTypeOf<Props['a']>().toEqualTypeOf<
      'dictionaries' | 'users' | 'post'
    >();
    expectTypeOf(Can).toBeCallableWith({
      I: 'read',
      a: 'dictionaries',
      children: null,
    });
    expectTypeOf(Can).toBeCallableWith({
      I: 'read',
      a: 'users',
      children: null,
    });
  });

  it('accepts the actions of the given feature', () => {
    const neverCalled = () => {
      expectTypeOf(useCan('create', 'dictionaries').allowed).toBeBoolean();
      expectTypeOf(useCan('read', 'users').allowed).toBeBoolean();
      // @ts-expect-error users has no update action
      useCan('update', 'users');
    };
    expectTypeOf(neverCalled).toBeFunction();
  });
});

describe('Hook: useCan', () => {
  it('permission-id overload returns boolean', () => {
    const neverCalled = () => {
      expectTypeOf(useCan('UsersRead')).toBeBoolean();
    };
    expectTypeOf(neverCalled).toBeFunction();
  });

  it('action/feature overload returns { allowed, ui? }', () => {
    const neverCalled = () => {
      const result = useCan('update', 'post', {
        user: { id: 'u' },
        post: { id: 'p', authorId: 'u' },
      });
      expectTypeOf(result.allowed).toBeBoolean();
      // @ts-expect-error the post guard context needs a user and a post
      useCan('update', 'post', { user: { id: 'u' } });
    };
    expectTypeOf(neverCalled).toBeFunction();
  });
});
