import { act, render, screen } from '@testing-library/react';
import { StrictMode, Suspense, useEffect, useLayoutEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createPermissionsAPI, definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', PostsUpdate: 'Update posts' },
  features: { posts: { read: 'PostsRead', update: 'PostsUpdate' } },
  roles: { viewer: ['PostsRead'], editor: ['PostsRead', 'PostsUpdate'] },
});

describe('PermissionsProvider', () => {
  it('renders the initial permissions on the server', () => {
    const { Can, PermissionsProvider } = createPermissionsAPI(config);
    const html = renderToString(
      <PermissionsProvider initial={{ roles: ['viewer'] }}>
        <Can I="read" a="posts" fallback="denied">
          allowed
        </Can>
      </PermissionsProvider>
    );
    expect(html).toBe('allowed');
  });

  it('keeps two trees apart and leaves the shared manager untouched', () => {
    const { Can, PermissionsProvider, core } = createPermissionsAPI(config);
    const view = (
      <Can I="update" a="posts" fallback="denied">
        allowed
      </Can>
    );
    const editor = renderToString(
      <PermissionsProvider initial={{ roles: ['editor'] }}>
        {view}
      </PermissionsProvider>
    );
    const viewer = renderToString(
      <PermissionsProvider initial={{ roles: ['viewer'] }}>
        {view}
      </PermissionsProvider>
    );
    expect(editor).toBe('allowed');
    expect(viewer).toBe('denied');
    expect(renderToString(view)).toBe('denied');
    expect(core.getState().status).toBe('idle');
  });

  it('ignores the shared manager inside a provider', () => {
    const { Can, PermissionsProvider, core } = createPermissionsAPI(config);
    core.set({ roles: ['editor'] });
    render(
      <PermissionsProvider initial={{ roles: ['viewer'] }}>
        <Can I="update" a="posts" fallback="denied">
          allowed
        </Can>
      </PermissionsProvider>
    );
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('follows a changed initial value', () => {
    const { Can, PermissionsProvider } = createPermissionsAPI(config);
    const App = ({ roles }: { roles?: ('viewer' | 'editor')[] }) => (
      <PermissionsProvider initial={roles && { roles }}>
        <Can I="update" a="posts" fallback="denied">
          allowed
        </Can>
      </PermissionsProvider>
    );
    const { rerender } = render(<App roles={['viewer']} />);
    expect(screen.getByText('denied')).toBeInTheDocument();

    rerender(<App roles={['editor']} />);
    expect(screen.getByText('allowed')).toBeInTheDocument();

    rerender(<App />);
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it.each([false, true])(
    'never commits a new user with the previous grants (strict: %s)',
    (strict) => {
      const { useCan, PermissionsProvider } = createPermissionsAPI(config);
      const committed: string[] = [];
      const Probe = ({ user }: { user: string }) => {
        const allowed = useCan('PostsUpdate');
        useLayoutEffect(() => {
          committed.push(`${user}:${allowed}`);
        });
        return null;
      };
      const App = ({ user, roles }: { user: string; roles?: 'editor'[] }) => {
        const tree = (
          <PermissionsProvider initial={roles && { roles }}>
            <Probe user={user} />
          </PermissionsProvider>
        );
        return strict ? <StrictMode>{tree}</StrictMode> : tree;
      };
      const { rerender } = render(<App user="alice" roles={['editor']} />);
      rerender(<App user="bob" roles={[]} />);
      rerender(<App user="carol" roles={['editor']} />);
      rerender(<App user="dave" />);

      expect(new Set(committed)).toEqual(
        new Set(['alice:true', 'bob:false', 'carol:true', 'dave:false'])
      );
    }
  );

  it('hydrates with the initial state when the state changes before hydration ends', async () => {
    const { Can, PermissionsProvider, usePermissionsManager } =
      createPermissionsAPI(config);
    const Revoke = () => {
      const manager = usePermissionsManager();
      useEffect(() => {
        manager.set({});
      }, [manager]);
      return null;
    };
    const App = () => (
      <PermissionsProvider initial={{ roles: ['viewer'] }}>
        <Revoke />
        <Suspense>
          <Can I="read" a="posts" fallback={<span>denied</span>}>
            <span>allowed</span>
          </Can>
        </Suspense>
      </PermissionsProvider>
    );
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = renderToString(<App />);
    expect(container.textContent).toBe('allowed');

    const recoverable: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <App />, {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });
    expect(recoverable).toEqual([]);
    expect(container.textContent).toBe('denied');
    await act(async () => root?.unmount());
    container.remove();
  });

  it('keeps later changes when initial is a new array with equal content', () => {
    const { Can, PermissionsProvider, usePermissionsManager } =
      createPermissionsAPI(config);
    const Upgrade = () => {
      const manager = usePermissionsManager();
      return <button onClick={() => manager.grant(['PostsUpdate'])}>up</button>;
    };
    const App = () => (
      <PermissionsProvider initial={{ roles: ['viewer'] }}>
        <Upgrade />
        <Can I="update" a="posts" fallback="denied">
          allowed
        </Can>
      </PermissionsProvider>
    );
    const { rerender } = render(<App />);
    act(() => screen.getByRole('button').click());
    expect(screen.getByText('allowed')).toBeInTheDocument();

    rerender(<App />);
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('usePermissionsManager returns the scoped manager, or the shared one', () => {
    const { PermissionsProvider, usePermissionsManager, core } =
      createPermissionsAPI(config);
    const seen: unknown[] = [];
    const Probe = () => {
      const manager = usePermissionsManager();
      useEffect(() => {
        seen.push(manager);
      }, [manager]);
      return null;
    };
    render(
      <>
        <Probe />
        <PermissionsProvider>
          <Probe />
        </PermissionsProvider>
      </>
    );
    expect(seen[0]).toBe(core);
    expect(seen[1]).not.toBe(core);
  });

  it('without initial starts idle and shows the loading fallback', () => {
    const { Can, PermissionsProvider } = createPermissionsAPI(config);
    render(
      <PermissionsProvider>
        <Can I="read" a="posts" loading="checking" fallback="denied">
          allowed
        </Can>
      </PermissionsProvider>
    );
    expect(screen.getByText('checking')).toBeInTheDocument();
  });
});
