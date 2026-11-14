import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
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
