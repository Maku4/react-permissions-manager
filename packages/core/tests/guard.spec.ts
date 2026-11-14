import { describe, expect, it, vi } from 'vitest';
import { createPermissionGuard, definePermissionsConfig } from '../src/server';

const config = definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
  features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
  roles: { viewer: ['PostsRead'], editor: ['PostsRead', 'PostsUpdate'] },
});

class Denied extends Error {
  constructor(public signedIn: boolean) {
    super('denied');
  }
}

interface User {
  id: string;
  roles: string[];
}

const createGuard = (user: User | null) =>
  createPermissionGuard(config, {
    getSubject: async () => user,
    onDenied: ({ subject }) => {
      throw new Denied(subject !== null);
    },
    guards: {
      byFeature: {
        posts: {
          context: {} as { authorId: string; userId: string },
          update: (context: { authorId: string; userId: string }) =>
            context.authorId === context.userId,
        },
      },
    },
  });

describe('createPermissionGuard', () => {
  it('answers for the user of the request', async () => {
    const guard = createGuard({ id: 'u1', roles: ['viewer'] });
    expect(await guard.has('PostsRead')).toBe(true);
    expect(await guard.has('PostsUpdate')).toBe(false);
    expect(await guard.can('read', 'posts')).toBe(true);
    expect(await guard.satisfies({ noneOf: ['PostsUpdate'] })).toBe(true);
    expect(
      await guard.filter(
        [{ needs: 'PostsRead' }, { needs: 'PostsUpdate' }, {}] as const,
        (item) => ('needs' in item ? item.needs : undefined)
      )
    ).toEqual([{ needs: 'PostsRead' }, {}]);
  });

  it('denies everything without a user, also an empty requirement', async () => {
    const guard = createGuard(null);
    expect(await guard.has('PostsRead')).toBe(false);
    expect(await guard.can('read', 'posts')).toBe(false);
    expect(await guard.satisfies({})).toBe(false);
    const items = [
      { id: 'open' },
      { id: 'empty', needs: {} },
      { id: 'none', needs: { noneOf: ['PostsUpdate'] } },
      { id: 'read', needs: 'PostsRead' },
    ] as const;
    expect(
      await guard.filter(items, (item) =>
        'needs' in item ? item.needs : undefined
      )
    ).toEqual([{ id: 'open' }]);
    await expect(guard.require({})).rejects.toMatchObject({ signedIn: false });
  });

  it('require returns the user or calls onDenied', async () => {
    const user = { id: 'u1', roles: ['viewer'] };
    const guard = createGuard(user);
    expect(await guard.require('PostsRead')).toBe(user);
    await expect(guard.require('PostsUpdate')).rejects.toMatchObject({
      signedIn: true,
    });
  });

  it('requireCan runs the guard of the action', async () => {
    const guard = createGuard({ id: 'u1', roles: ['editor'] });
    await expect(
      guard.requireCan('update', 'posts', { authorId: 'u1', userId: 'u1' })
    ).resolves.toMatchObject({ id: 'u1' });
    await expect(
      guard.requireCan('update', 'posts', { authorId: 'u2', userId: 'u1' })
    ).rejects.toBeInstanceOf(Denied);
  });

  it('treats an async guard as a denial', async () => {
    const guard = createPermissionGuard(config, {
      getSubject: () => ({ roles: ['editor'] }),
      onDenied: () => {
        throw new Denied(true);
      },
      guards: {
        byFeature: {
          posts: {
            // An async guard returns a promise, which must not count as true
            update: (async () => true) as unknown as (
              context: object
            ) => boolean,
          },
        },
      },
    });
    expect(await guard.can('update', 'posts', {})).toBe(false);
    await expect(
      guard.requireCan('update', 'posts', {})
    ).rejects.toBeInstanceOf(Denied);
  });

  it('reads the user on every call and accepts a synchronous getSubject', async () => {
    const getSubject = vi
      .fn<() => User | undefined>()
      .mockReturnValueOnce({ id: 'u1', roles: ['editor'] })
      .mockReturnValueOnce(undefined);
    const guard = createPermissionGuard(config, {
      getSubject,
      onDenied: () => {
        throw new Denied(false);
      },
    });
    expect(await guard.has('PostsUpdate')).toBe(true);
    expect(await guard.has('PostsUpdate')).toBe(false);
  });

  it('throws when onDenied returns', async () => {
    const guard = createPermissionGuard(config, {
      getSubject: () => null,
      onDenied: (() => undefined) as unknown as () => never,
    });
    await expect(guard.require('PostsRead')).rejects.toThrow(
      /onDenied returned/
    );
  });
});
