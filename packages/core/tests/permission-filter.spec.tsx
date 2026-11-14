import { act, render, screen } from '@testing-library/react';
import { useMemo } from 'react';
import { describe, expect, it } from 'vitest';
import { createPermissionsAPI, definePermissionsConfig } from '../src';

const config = definePermissionsConfig({
  permissions: { PostsRead: 'Read posts', UsersRead: 'Read users' },
  features: { posts: { read: 'PostsRead' }, users: { read: 'UsersRead' } },
  roles: { viewer: ['PostsRead'] },
});

const links = [
  { href: '/', requires: undefined },
  { href: '/posts', requires: 'PostsRead' },
  { href: '/users', requires: 'UsersRead' },
] as const;

describe('usePermissionFilter', () => {
  it('keeps unrestricted items and adds the rest as permissions arrive', () => {
    const { usePermissionFilter, core } = createPermissionsAPI(config);
    const Menu = () => {
      const filterAllowed = usePermissionFilter();
      const visible = useMemo(
        () => filterAllowed(links, (link) => link.requires),
        [filterAllowed]
      );
      return <nav>{visible.map((link) => link.href).join(' ')}</nav>;
    };
    render(<Menu />);
    expect(screen.getByRole('navigation')).toHaveTextContent(/^\/$/);

    act(() => core.setRoles(['viewer']));
    expect(screen.getByRole('navigation')).toHaveTextContent('/ /posts');

    act(() => core.grant(['UsersRead']));
    expect(screen.getByRole('navigation')).toHaveTextContent('/ /posts /users');

    act(() => core.clear());
    expect(screen.getByRole('navigation')).toHaveTextContent(/^\/$/);
  });

  it('hides restricted items while permissions are loading', () => {
    const { usePermissionFilter, core } = createPermissionsAPI(config);
    core.grant(['PostsRead']);
    const Menu = () => {
      const filterAllowed = usePermissionFilter();
      return (
        <nav>
          {filterAllowed(links, (link) => link.requires)
            .map((link) => link.href)
            .join(' ')}
        </nav>
      );
    };
    render(<Menu />);
    expect(screen.getByRole('navigation')).toHaveTextContent('/ /posts');

    act(() => core.startLoading());
    expect(screen.getByRole('navigation')).toHaveTextContent(/^\/$/);
  });

  it('returns the same function until the state changes', () => {
    const { usePermissionFilter, core } = createPermissionsAPI(config);
    const seen = new Set<unknown>();
    const Probe = ({ tick }: { tick: number }) => {
      seen.add(usePermissionFilter());
      return <span>{tick}</span>;
    };
    const { rerender } = render(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    expect(seen.size).toBe(1);

    act(() => core.grant(['PostsRead']));
    expect(seen.size).toBe(2);
  });
});
