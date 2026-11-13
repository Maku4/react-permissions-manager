import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPermissionsAPI } from '../src';
import { definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: {
    UsersRead: 'users read',
    DictionariesUpdate: 'update dict',
  },
  features: {
    dictionaries: {
      update: 'DictionariesUpdate',
    },
  },
  roles: {
    updater: ['DictionariesUpdate'],
    reader: ['UsersRead'],
  },
} as const);

const api = createPermissionsAPI(config, {
  uiPolicy: {
    dictionaries: {
      _default: { mode: 'disable', tooltip: 'Denied' },
    },
  },
});

const { useCan, core: manager } = api;

function RawPermProbe() {
  const ok = useCan('UsersRead') as boolean;
  return <span data-testid="raw-perm">{ok ? 'yes' : 'no'}</span>;
}

function ActionProbe() {
  const { allowed, ui } = useCan('update', 'dictionaries') as {
    allowed: boolean;
    ui?: unknown;
  };
  return (
    <>
      <span data-testid="action-allowed">{allowed ? 'yes' : 'no'}</span>
      <span data-testid="has-ui">{ui ? 'yes' : 'no'}</span>
    </>
  );
}

describe('useCan hook', () => {
  beforeEach(() => manager.clear());

  it('returns boolean for raw permission variant', () => {
    const { rerender } = render(<RawPermProbe />);
    expect(screen.getByTestId('raw-perm').textContent).toBe('no');
    manager.grant(['UsersRead']);
    rerender(<RawPermProbe />);
    expect(screen.getByTestId('raw-perm').textContent).toBe('yes');
  });

  it('returns { allowed, ui } for action/feature variant', () => {
    const { rerender } = render(<ActionProbe />);
    expect(screen.getByTestId('action-allowed').textContent).toBe('no');
    // uiPolicy is present -> ui provided even if not allowed
    expect(screen.getByTestId('has-ui').textContent).toBe('yes');
    manager.grant(['DictionariesUpdate']);
    rerender(<ActionProbe />);
    expect(screen.getByTestId('action-allowed').textContent).toBe('yes');
  });

  it('reacts to roles changes (rerenders on state updates)', () => {
    function RolesProbe() {
      const ok = useCan('update', 'dictionaries') as
        { allowed: boolean } | boolean;
      const allowed = typeof ok === 'boolean' ? ok : ok.allowed;
      return <span data-testid="by-roles">{allowed ? 'yes' : 'no'}</span>;
    }

    const { rerender } = render(<RolesProbe />);
    expect(screen.getByTestId('by-roles').textContent).toBe('no');
    manager.setRoles(['updater']);
    rerender(<RolesProbe />);
    expect(screen.getByTestId('by-roles').textContent).toBe('yes');
  });
});
