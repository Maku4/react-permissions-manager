import assert from 'node:assert/strict';
import process from 'node:process';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as esm from '@react-permissions-manager/core';

const require = createRequire(import.meta.url);
const cjs = require('@react-permissions-manager/core');
const expectedVersion = process.env.EXPECTED_CORE_VERSION;
const exports = [
  'createPermissionChecker',
  'createPermissionsAPI',
  'definePermissionsConfig',
  'PermissionsManager',
  'usePermissionsStore',
  'version',
];

for (const core of [esm, cjs]) {
  assert.equal(core.version, expectedVersion);
  for (const name of exports) assert.ok(name in core, `Missing export ${name}`);
  const config = core.definePermissionsConfig({
    permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
    features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
    roles: { reader: ['PostsRead'] },
  });
  const api = core.createPermissionsAPI(config);
  api.core.setRoles(['reader']);
  const render = (action) =>
    renderToString(
      React.createElement(
        api.Can,
        { I: action, a: 'posts', fallback: 'denied' },
        'allowed'
      )
    );
  assert.equal(render('read'), 'allowed');
  assert.equal(render('update'), 'denied');
  const checker = core.createPermissionChecker(config);
  assert.equal(checker.can({ roles: ['reader'] }, 'read', 'posts'), true);
  assert.equal(checker.can({ roles: ['reader'] }, 'update', 'posts'), false);
}
assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
