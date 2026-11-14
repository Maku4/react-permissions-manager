import { describe, expect, it } from 'vitest';
import { createPermissionChecker, definePermissionsConfig } from '../src';

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
    viewer: ['PostsRead'],
  },
});

describe('createPermissionChecker', () => {
  const checker = createPermissionChecker(config);

  it('checks permissions granted directly and through roles', () => {
    expect(checker.has({ permissions: ['UsersRead'] }, 'UsersRead')).toBe(true);
    expect(checker.has({ roles: ['viewer'] }, 'PostsRead')).toBe(true);
    expect(checker.has({ roles: ['viewer'] }, 'PostsUpdate')).toBe(false);
    expect(checker.has({}, 'PostsRead')).toBe(false);
  });

  it('ignores roles that are not in the config', () => {
    expect(checker.has({ roles: ['admin'] }, 'PostsRead')).toBe(false);
  });

  it('checks actions through the feature mapping', () => {
    expect(checker.can({ roles: ['editor'] }, 'update', 'posts')).toBe(true);
    expect(checker.can({ roles: ['viewer'] }, 'update', 'posts')).toBe(false);
    expect(checker.can({ roles: ['editor'] }, 'read', 'users')).toBe(false);
  });

  it('evaluates anyOf, allOf and noneOf like PermissionGate', () => {
    const viewer = { roles: ['viewer'] };
    expect(checker.satisfies(viewer, 'PostsRead')).toBe(true);
    expect(
      checker.satisfies(viewer, { anyOf: ['PostsUpdate', 'PostsRead'] })
    ).toBe(true);
    expect(
      checker.satisfies(viewer, { allOf: ['PostsUpdate', 'PostsRead'] })
    ).toBe(false);
    expect(checker.satisfies(viewer, { noneOf: ['PostsUpdate'] })).toBe(true);
    expect(checker.satisfies(viewer, { noneOf: ['PostsRead'] })).toBe(false);
    expect(checker.satisfies(viewer, {})).toBe(true);
  });

  it('keeps no state between calls', () => {
    expect(checker.has({ permissions: ['UsersRead'] }, 'UsersRead')).toBe(true);
    expect(checker.has({ permissions: [] }, 'UsersRead')).toBe(false);
    expect(checker.has({ roles: ['editor'] }, 'PostsUpdate')).toBe(true);
    expect(checker.has({ roles: ['viewer'] }, 'PostsUpdate')).toBe(false);
  });

  it('accepts any iterable of permissions and roles', () => {
    const subject = {
      permissions: new Set(['UsersRead']),
      roles: new Set(['viewer']).values(),
    };
    expect(checker.can(subject, 'read', 'users')).toBe(true);
  });

  it('filters items by what each one requires', () => {
    const items = [
      { href: '/', requires: undefined },
      { href: '/posts', requires: 'PostsRead' },
      { href: '/posts/edit', requires: { allOf: ['PostsUpdate'] } },
      { href: '/users', requires: 'UsersRead' },
    ] as const;

    const visible = checker.filter(
      { roles: ['viewer'] },
      items,
      (item) => item.requires
    );

    expect(visible.map((item) => item.href)).toEqual(['/', '/posts']);
  });
});

describe('createPermissionChecker with guards', () => {
  const checker = createPermissionChecker(config, {
    guards: {
      byFeature: {
        posts: {
          update: (context: { authorId: string; userId: string }) =>
            context.authorId === context.userId,
        },
      },
    },
  });
  const editor = { roles: ['editor'] };

  it('runs the guard with the context', () => {
    expect(
      checker.can(editor, 'update', 'posts', { authorId: 'a', userId: 'a' })
    ).toBe(true);
    expect(
      checker.can(editor, 'update', 'posts', { authorId: 'a', userId: 'b' })
    ).toBe(false);
  });

  it('denies a guarded action without a context', () => {
    expect(checker.can(editor, 'update', 'posts')).toBe(false);
  });
});
