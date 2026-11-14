import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPermissionsAPI, definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
  features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
  roles: { viewer: ['PostsRead'] },
});

describe('loading fallback', () => {
  it('<Can> shows loading until permissions are known, then fallback', () => {
    const { Can, core } = createPermissionsAPI(config);
    render(
      <Can I="read" a="posts" loading="Checking" fallback="No access">
        Posts
      </Can>
    );
    expect(screen.getByText('Checking')).toBeInTheDocument();

    act(() => core.startLoading());
    expect(screen.getByText('Checking')).toBeInTheDocument();

    act(() => core.set({}));
    expect(screen.getByText('No access')).toBeInTheDocument();

    act(() => core.set({ roles: ['viewer'] }));
    expect(screen.getByText('Posts')).toBeInTheDocument();
  });

  it('<PermissionGate> shows loading until permissions are known', () => {
    const { PermissionGate, core } = createPermissionsAPI(config);
    render(
      <PermissionGate
        require="PostsRead"
        loading="Checking"
        fallback="No access"
      >
        Posts
      </PermissionGate>
    );
    expect(screen.getByText('Checking')).toBeInTheDocument();

    act(() => core.set({}));
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('without loading, the fallback is used before permissions are known', () => {
    const { Can } = createPermissionsAPI(config);
    render(
      <Can I="read" a="posts" fallback="No access">
        Posts
      </Can>
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
  });

  it('a failed load is not pending, so the fallback is shown', async () => {
    const { Can, core } = createPermissionsAPI(config);
    render(
      <Can I="read" a="posts" loading="Checking" fallback="No access">
        Posts
      </Can>
    );
    await act(() =>
      core.loadFrom(async () => {
        throw new Error('network');
      })
    );
    expect(screen.getByText('No access')).toBeInTheDocument();
  });
});

describe('usePermissionsStatus', () => {
  it('follows the manager', async () => {
    const { usePermissionsStatus, core } = createPermissionsAPI(config);
    const Status = () => <output>{usePermissionsStatus()}</output>;
    render(<Status />);
    expect(screen.getByRole('status')).toHaveTextContent('idle');

    let finish: (loaded: { roles: string[] }) => void = () => {};
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = core.loadFrom(
        () => new Promise((resolve) => (finish = resolve))
      );
    });
    expect(screen.getByRole('status')).toHaveTextContent('loading');

    await act(async () => {
      finish({ roles: ['viewer'] });
      await pending;
    });
    expect(screen.getByRole('status')).toHaveTextContent('ready');
  });
});

describe('initial', () => {
  it('grants on the first render', () => {
    const { Can, usePermissionsStatus } = createPermissionsAPI(config, {
      initial: { roles: ['viewer'], permissions: ['PostsUpdate'] },
    });
    const Status = () => <output>{usePermissionsStatus()}</output>;
    render(
      <>
        <Status />
        <Can I="read" a="posts">
          <span>Posts</span>
        </Can>
        <Can I="update" a="posts">
          <span>Edit</span>
        </Can>
      </>
    );
    expect(screen.getByRole('status')).toHaveTextContent('ready');
    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('a reload keeps the interface visible until the result arrives', async () => {
    const { Can, core } = createPermissionsAPI(config, {
      initial: { roles: ['viewer'] },
    });
    render(
      <Can I="read" a="posts" fallback="No access">
        Posts
      </Can>
    );
    let finish: (loaded: { roles: string[] }) => void = () => {};
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = core.loadFrom(
        () => new Promise((resolve) => (finish = resolve))
      );
    });
    expect(screen.getByText('Posts')).toBeInTheDocument();

    await act(async () => {
      finish({ roles: [] });
      await pending;
    });
    expect(screen.getByText('No access')).toBeInTheDocument();
  });
});
