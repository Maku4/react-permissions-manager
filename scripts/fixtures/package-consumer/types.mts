import { createElement } from 'react';
import {
  createPermissionsAPI,
  definePermissionsConfig,
  type PermissionId,
  type UIPolicyEntry,
} from '@react-permissions-manager/core';

const config = definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
  features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
  roles: { reader: ['PostsRead'] },
});
const api = createPermissionsAPI(config, {
  guards: {
    byFeature: {
      posts: {
        context: {} as { authorId: string },
        update: (context: { authorId: string }) => context.authorId === 'me',
      },
    },
  },
});

const permission: PermissionId<typeof config> = 'PostsRead';
void permission;
// @ts-expect-error PostsDelete is not declared in the config.
const unknownPermission: PermissionId<typeof config> = 'PostsDelete';
void unknownPermission;

createElement(api.Can<'posts', 'update'>, {
  I: 'update',
  a: 'posts',
  of: { authorId: 'me' },
  children: null,
});
createElement(api.PermissionGate, { require: 'PostsRead', children: null });

function useChecks() {
  const hasPermission: boolean = api.useCan('PostsRead');
  const result: { allowed: boolean; ui?: UIPolicyEntry } = api.useCan(
    'update',
    'posts',
    { authorId: 'me' }
  );
  // @ts-expect-error The posts feature has no delete action.
  api.useCan('delete', 'posts');
  // @ts-expect-error The guard context needs an authorId string.
  api.useCan('update', 'posts', { authorId: 1 });
  return hasPermission && result.allowed;
}
void useChecks;
