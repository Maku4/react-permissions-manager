import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsManager } from '../src';
import { definePermissionsConfig } from '../src';

const permissionsConfig = definePermissionsConfig({
  permissions: {
    UsersRead: 'Users read',
    UsersWrite: 'Users write',
    P1: 'P1',
    p1: 'p1',
    p2: 'p2',
    y: 'y',
  },
  features: {
    users: {
      read: 'UsersRead',
      update: 'UsersWrite',
    },
  },
  roles: {
    admin: ['UsersRead', 'UsersWrite'],
    viewer: ['UsersRead'],
    r1: ['UsersRead'],
    x: ['UsersRead'],
  },
} as const);

describe('PermissionsManager', () => {
  let manager: PermissionsManager<typeof permissionsConfig>;

  beforeEach(() => {
    manager = new PermissionsManager<typeof permissionsConfig>();
    manager.clear();
  });

  it('initializes with idle status and empty sets', () => {
    const state = manager.getState();
    expect(state.status).toBe('idle');
    expect(state.granted.size).toBe(0);
    expect(state.roles.size).toBe(0);
  });

  it('setRoles updates roles and sets status to ready', () => {
    const availableRoleIds = Object.keys(permissionsConfig.roles);
    manager.setRoles(availableRoleIds);
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(Array.from(state.roles)).toEqual(availableRoleIds);
  });

  it('grant adds permissions and sets status to ready', () => {
    manager.grant(['UsersRead', 'UsersWrite']);
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(state.granted.has('UsersRead')).toBe(true);
    expect(state.granted.has('UsersWrite')).toBe(true);
  });

  it('clear resets to initial state', () => {
    manager.setRoles(['admin']);
    manager.grant(['P1']);
    manager.clear();
    const state = manager.getState();
    expect(state.status).toBe('idle');
    expect(state.roles.size).toBe(0);
    expect(state.granted.size).toBe(0);
  });

  it('loadFrom loads roles and permissions successfully', async () => {
    await manager.loadFrom(async () => ({
      roles: ['r1'],
      permissions: ['p1', 'p2'],
    }));
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(Array.from(state.roles)).toEqual(['r1']);
    expect(state.granted.has('p1')).toBe(true);
    expect(state.granted.has('p2')).toBe(true);
  });

  it('loadFrom loads only roles when provided', async () => {
    await manager.loadFrom(async () => ({ roles: ['r1'] }));
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(Array.from(state.roles)).toEqual(['r1']);
    expect(state.granted.size).toBe(0);
  });

  it('loadFrom loads only permissions when provided', async () => {
    await manager.loadFrom(async () => ({ permissions: ['p1'] }));
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(state.roles.size).toBe(0);
    expect(state.granted.has('p1')).toBe(true);
  });

  it('loadFrom keeps the grants and reports the error when the loader throws', async () => {
    manager.set({ permissions: ['p1'], roles: ['viewer'] });
    const failure = new Error('network');
    await manager.loadFrom(async () => {
      throw failure;
    });
    const state = manager.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe(failure);
    expect(Array.from(state.granted)).toEqual(['p1']);
    expect(Array.from(state.roles)).toEqual(['viewer']);
  });

  it('a failed first load grants nothing', async () => {
    await manager.loadFrom(async () => {
      throw new Error('network');
    });
    const state = manager.getState();
    expect(state.status).toBe('error');
    expect(state.granted.size).toBe(0);
    expect(state.roles.size).toBe(0);
  });

  it('the next successful change drops the stored error', async () => {
    await manager.loadFrom(async () => {
      throw new Error('network');
    });
    manager.grant(['p1']);
    expect(manager.getState().status).toBe('ready');
    expect(manager.getState().error).toBeUndefined();
  });

  it('starts ready with the initial permissions and roles', () => {
    const seeded = new PermissionsManager<typeof permissionsConfig>({
      permissions: ['p1'],
      roles: ['viewer'],
    });
    const state = seeded.getState();
    expect(state.status).toBe('ready');
    expect(Array.from(state.granted)).toEqual(['p1']);
    expect(Array.from(state.roles)).toEqual(['viewer']);
  });

  it('set replaces permissions and roles', () => {
    manager.set({ permissions: ['p1', 'p2'], roles: ['admin'] });
    manager.set({ permissions: ['p2'] });
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(Array.from(state.granted)).toEqual(['p2']);
    expect(state.roles.size).toBe(0);
  });

  it('set with nothing records a known user without access', () => {
    manager.set({});
    const state = manager.getState();
    expect(state.status).toBe('ready');
    expect(state.granted.size).toBe(0);
  });

  it('loadFrom removes permissions and roles the user no longer has', async () => {
    manager.set({ permissions: ['p1', 'p2'], roles: ['admin'] });
    await manager.loadFrom(async () => ({ permissions: ['p1'], roles: [] }));
    const state = manager.getState();
    expect(Array.from(state.granted)).toEqual(['p1']);
    expect(state.roles.size).toBe(0);
  });

  it('the first load is loading, a reload keeps the status and the grants', async () => {
    let finishFirst: (loaded: { permissions: string[] }) => void = () => {};
    const first = manager.loadFrom(
      () => new Promise((resolve) => (finishFirst = resolve))
    );
    expect(manager.getState().status).toBe('loading');
    finishFirst({ permissions: ['p1'] });
    await first;

    let finishReload: (loaded: { permissions: string[] }) => void = () => {};
    const reload = manager.loadFrom(
      () => new Promise((resolve) => (finishReload = resolve))
    );
    expect(manager.getState().status).toBe('ready');
    expect(manager.getState().granted.has('p1')).toBe(true);
    finishReload({ permissions: ['p2'] });
    await reload;
    expect(Array.from(manager.getState().granted)).toEqual(['p2']);
  });

  it('applies only the load started last', async () => {
    let finishOlder: (loaded: { permissions: string[] }) => void = () => {};
    const older = manager.loadFrom(
      () => new Promise((resolve) => (finishOlder = resolve))
    );
    const newer = manager.loadFrom(async () => ({ permissions: ['p2'] }));
    await newer;
    finishOlder({ permissions: ['p1'] });
    await older;
    expect(Array.from(manager.getState().granted)).toEqual(['p2']);
  });

  it.each([
    ['set', () => manager.set({ permissions: ['p2'] })],
    ['grant', () => manager.grant(['p2'])],
    ['setRoles', () => manager.setRoles(['viewer'])],
  ])('a pending load does not undo a later %s', async (_name, change) => {
    let finish: (loaded: { roles: string[] }) => void = () => {};
    let fail: (reason: Error) => void = () => {};
    const succeeding = manager.loadFrom(
      () => new Promise((resolve) => (finish = resolve))
    );
    change();
    const afterChange = manager.getState();
    finish({ roles: ['admin'] });
    await succeeding;
    expect(manager.getState()).toBe(afterChange);

    const failing = manager.loadFrom(
      () => new Promise((_resolve, reject) => (fail = reject))
    );
    change();
    const afterSecondChange = manager.getState();
    fail(new Error('network'));
    await failing;
    expect(manager.getState()).toBe(afterSecondChange);
    expect(manager.getState().status).toBe('ready');
  });

  it('getInitialState keeps the state the manager was created with', () => {
    const seeded = new PermissionsManager<typeof permissionsConfig>({
      roles: ['viewer'],
    });
    const initial = seeded.getState();
    seeded.set({});
    seeded.clear();
    expect(seeded.getInitialState()).toBe(initial);
    expect(manager.getInitialState().status).toBe('idle');
  });

  it('drops a load that finishes after clear', async () => {
    let finish: (loaded: { permissions: string[] }) => void = () => {};
    const pending = manager.loadFrom(
      () => new Promise((resolve) => (finish = resolve))
    );
    manager.clear();
    finish({ permissions: ['p1'] });
    await pending;
    const state = manager.getState();
    expect(state.status).toBe('idle');
    expect(state.granted.size).toBe(0);
  });

  it('notifies subscribers on state change', () => {
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);
    manager.setRoles(['x']);
    manager.grant(['y']);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    manager.clear();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
