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

  it('loadFrom sets status to ready on loader error (fail-closed)', async () => {
    await manager.loadFrom(async () => {
      throw new Error('network');
    });
    const state = manager.getState();
    expect(state.status).toBe('ready');
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
