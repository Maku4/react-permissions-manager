import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createPermissionsAPI, definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: { DocsRead: 'Read documents', DocsUpdate: 'Update documents' },
  features: { docs: { read: 'DocsRead', update: 'DocsUpdate' } },
  roles: { reader: ['DocsRead'] },
});

describe('updates after the first render', () => {
  it('re-renders <Can> when a permission is granted later', () => {
    const { Can, core } = createPermissionsAPI(config);
    render(
      <Can I="read" a="docs" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );
    expect(screen.getByText('denied')).toBeInTheDocument();

    act(() => core.grant(['DocsRead']));
    expect(screen.getByText('allowed')).toBeInTheDocument();

    act(() => core.clear());
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('re-renders <Can> when a role is set later', () => {
    const { Can, core } = createPermissionsAPI(config);
    render(
      <Can I="read" a="docs" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );

    act(() => core.setRoles(['reader']));
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('re-renders both useCan forms without a parent re-render', () => {
    const { useCan, core } = createPermissionsAPI(config);
    const Probe = () => {
      const byPermission = useCan('DocsRead');
      const byAction = useCan('read', 'docs').allowed;
      return <span>{`${byPermission}/${byAction}`}</span>;
    };
    render(<Probe />);
    expect(screen.getByText('false/false')).toBeInTheDocument();

    act(() => core.grant(['DocsRead']));
    expect(screen.getByText('true/true')).toBeInTheDocument();
  });

  it('re-renders <PermissionGate> when a permission is granted later', () => {
    const { PermissionGate, core } = createPermissionsAPI(config);
    render(
      <PermissionGate require="DocsRead" fallback={<span>denied</span>}>
        <span>allowed</span>
      </PermissionGate>
    );

    act(() => core.grant(['DocsRead']));
    expect(screen.getByText('allowed')).toBeInTheDocument();
  });

  it('denies everything while the status is loading', () => {
    const { Can, core } = createPermissionsAPI(config);
    core.grant(['DocsRead']);
    render(
      <Can I="read" a="docs" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );
    expect(screen.getByText('allowed')).toBeInTheDocument();

    act(() => core.startLoading());
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('a reload keeps the current grants, then replaces them', async () => {
    const { Can, core } = createPermissionsAPI(config);
    core.grant(['DocsRead']);
    let finishLoading: (value: { permissions: string[] }) => void = () => {};
    render(
      <Can I="read" a="docs" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );

    let loading: Promise<void> = Promise.resolve();
    act(() => {
      loading = core.loadFrom(
        () => new Promise((resolve) => (finishLoading = resolve))
      );
    });
    expect(screen.getByText('allowed')).toBeInTheDocument();

    await act(async () => {
      finishLoading({ permissions: ['DocsUpdate'] });
      await loading;
    });
    expect(screen.getByText('denied')).toBeInTheDocument();
  });
});

describe('guards', () => {
  const createGuardedApi = () =>
    createPermissionsAPI(config, {
      guards: {
        byFeature: {
          docs: {
            update: (context: { ownerId: string; userId: string }) =>
              context.ownerId === context.userId,
          },
        },
      },
    });

  it('denies a guarded action when no context is passed', () => {
    const { Can, useCan, core } = createGuardedApi();
    core.grant(['DocsUpdate']);
    const Probe = () => <span>{String(useCan('update', 'docs').allowed)}</span>;
    render(
      <>
        <Can I="update" a="docs" fallback={<span>denied</span>}>
          <span>allowed</span>
        </Can>
        <Probe />
      </>
    );

    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('allows only when the guard returns true', () => {
    const { useCan, core } = createPermissionsAPI(config, {
      guards: {
        byFeature: {
          docs: {
            update: ((context: { result: unknown }) =>
              context.result) as unknown as (context: {
              result: unknown;
            }) => boolean,
          },
        },
      },
    });
    core.grant(['DocsUpdate']);
    const Probe = ({ result }: { result: unknown }) => (
      <span>{String(useCan('update', 'docs', { result }).allowed)}</span>
    );
    const { rerender } = render(<Probe result={true} />);
    expect(screen.getByText('true')).toBeInTheDocument();

    for (const result of [Promise.resolve(false), 'yes', 1, {}]) {
      rerender(<Probe result={result} />);
      expect(screen.getByText('false')).toBeInTheDocument();
    }
  });

  it('runs the guard with the context it is given', () => {
    const { useCan, core } = createGuardedApi();
    core.grant(['DocsUpdate']);
    const Probe = (props: { ownerId: string }) => {
      const context = { ownerId: props.ownerId, userId: 'u1' };
      return <span>{String(useCan('update', 'docs', context).allowed)}</span>;
    };
    const { rerender } = render(<Probe ownerId="u1" />);
    expect(screen.getByText('true')).toBeInTheDocument();

    rerender(<Probe ownerId="u2" />);
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('does not run the guard when the permission is missing', () => {
    let calls = 0;
    const { Can } = createPermissionsAPI(config, {
      guards: {
        byFeature: {
          docs: {
            update: (context: { id: string }) => {
              calls += 1;
              return context.id.length > 0;
            },
          },
        },
      },
    });
    render(
      <Can I="update" a="docs" of={{ id: '1' }} fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );

    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('leaves actions without a guard unaffected', () => {
    const { Can, core } = createGuardedApi();
    core.grant(['DocsRead']);
    render(
      <Can I="read" a="docs" fallback={<span>denied</span>}>
        <span>allowed</span>
      </Can>
    );

    expect(screen.getByText('allowed')).toBeInTheDocument();
  });
});
