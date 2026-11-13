import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPermissionsAPI } from '../src';
import { definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: {
    UsersRead: 'users read',
    UsersWrite: 'users write',
    AdminPanel: 'admin',
  },
  features: {
    users: {
      read: 'UsersRead',
      update: 'UsersWrite',
    },
  },
  roles: {
    admin: ['UsersRead', 'UsersWrite', 'AdminPanel'],
    viewer: ['UsersRead'],
  },
} as const);

const api = createPermissionsAPI(config);
const { PermissionGate, core: manager } = api;

describe('<PermissionGate />', () => {
  beforeEach(() => {
    manager.clear();
  });

  it('renders children when required permission is granted (string)', () => {
    manager.grant(['UsersRead']);
    render(
      <PermissionGate require="UsersRead">
        <button data-testid="btn">OK</button>
      </PermissionGate>
    );
    expect(screen.getByTestId('btn')).toBeInTheDocument();
  });

  it('supports anyOf: renders when at least one permission present', () => {
    manager.grant(['UsersRead']);
    render(
      <PermissionGate require={{ anyOf: ['UsersWrite', 'UsersRead'] }}>
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('supports allOf: renders only when all are present', () => {
    manager.grant(['UsersRead']);
    const { rerender } = render(
      <PermissionGate require={{ allOf: ['UsersRead', 'UsersWrite'] }}>
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();

    manager.grant(['UsersWrite']);
    rerender(
      <PermissionGate require={{ allOf: ['UsersRead', 'UsersWrite'] }}>
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('supports noneOf: renders only when none are present', () => {
    render(
      <PermissionGate require={{ noneOf: ['AdminPanel'] }}>
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();

    manager.grant(['AdminPanel']);
    render(
      <PermissionGate require={{ noneOf: ['AdminPanel'] }}>
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('supports mixed anyOf + allOf', () => {
    manager.grant(['UsersRead']);
    render(
      <PermissionGate
        require={{ anyOf: ['AdminPanel', 'UsersRead'], allOf: ['UsersRead'] }}
      >
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('renders fallback when not allowed', () => {
    render(
      <PermissionGate
        require="UsersWrite"
        fallback={<span data-testid="fb">no</span>}
      >
        <div data-testid="content">content</div>
      </PermissionGate>
    );
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    expect(screen.getByTestId('fb')).toBeInTheDocument();
  });

  it('supports render prop children with allowed boolean', () => {
    const { rerender } = render(
      <PermissionGate require="UsersWrite">
        {(allowed) => <span data-testid="state">{allowed ? 'yes' : 'no'}</span>}
      </PermissionGate>
    );
    expect(screen.getByTestId('state').textContent).toBe('no');
    manager.grant(['UsersWrite']);
    rerender(
      <PermissionGate require="UsersWrite">
        {(allowed) => <span data-testid="state">{allowed ? 'yes' : 'no'}</span>}
      </PermissionGate>
    );
    expect(screen.getByTestId('state').textContent).toBe('yes');
  });
});
