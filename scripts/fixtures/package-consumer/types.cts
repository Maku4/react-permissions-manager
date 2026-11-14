import React = require('react');
import core = require('@react-permissions-manager/core');
import server = require('@react-permissions-manager/core/server');

const config = core.definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
  features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
  roles: { reader: ['PostsRead'] },
});
const api = core.createPermissionsAPI(config);

const permission: core.PermissionId<typeof config> = 'PostsRead';
void permission;
// @ts-expect-error PostsDelete is not declared in the config.
const unknownPermission: core.PermissionId<typeof config> = 'PostsDelete';
void unknownPermission;

React.createElement(api.PermissionGate, {
  require: { allOf: ['PostsRead'] },
  children: null,
});

function useChecks() {
  const hasPermission: boolean = api.useCan('PostsRead');
  // @ts-expect-error The posts feature has no delete action.
  api.useCan('delete', 'posts');
  return hasPermission && api.useCan('update', 'posts').allowed;
}
void useChecks;

const guard = server.createPermissionGuard(config, {
  getSubject: () => ({ roles: ['reader'] }),
  onDenied: () => {
    throw new Error('denied');
  },
});
const allowed: Promise<boolean> = guard.can('read', 'posts');
void allowed;
// @ts-expect-error PostsDelete is not declared in the config.
void guard.has('PostsDelete');
