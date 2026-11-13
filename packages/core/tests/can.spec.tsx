import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPermissionsAPI } from '../src';
import { definePermissionsConfig } from '../src';

const baseConfig = definePermissionsConfig({
  permissions: {
    DictionariesRead: 'read dict',
    DictionariesCreate: 'create dict',
    DictionariesUpdate: 'update dict',
  },
  features: {
    dictionaries: {
      read: 'DictionariesRead',
      create: 'DictionariesCreate',
      update: 'DictionariesUpdate',
    },
  },
  roles: {
    editor: ['DictionariesRead', 'DictionariesUpdate'],
    creator: ['DictionariesCreate'],
  },
} as const);

describe('<Can />', () => {
  describe('basic action checks', () => {
    const api = createPermissionsAPI(baseConfig);
    const { Can, core: manager } = api;

    beforeEach(() => manager.clear());

    it('renders children when action allowed', () => {
      manager.grant(['DictionariesCreate']);
      render(
        <Can I="create" a="dictionaries">
          <button data-testid="add">Add</button>
        </Can>
      );
      expect(screen.getByTestId('add')).toBeInTheDocument();
    });

    it('hides children by default when not allowed (mode=hide)', () => {
      render(
        <Can I="update" a="dictionaries">
          <button data-testid="edit">Edit</button>
        </Can>
      );
      expect(screen.queryByTestId('edit')).not.toBeInTheDocument();
    });

    it('mode=disable injects disabled/aria-disabled and wraps with aria-disabled container', () => {
      render(
        <Can I="update" a="dictionaries" mode="disable" tooltip="No access">
          <button data-testid="edit">Edit</button>
        </Can>
      );
      const btn = screen.getByTestId('edit') as HTMLButtonElement;
      expect(btn).toHaveAttribute('disabled');
      // wrapper span rendered by renderDisabled should carry aria-disabled and title
      const wrapper = btn.parentElement as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.tagName.toLowerCase()).toBe('span');
      expect(wrapper).toHaveAttribute('aria-disabled', 'true');
      expect(wrapper).toHaveAttribute('title', 'No access');
    });
  });

  describe('uiPolicy integration', () => {
    const api = createPermissionsAPI(baseConfig, {
      uiPolicy: {
        dictionaries: {
          _default: { mode: 'disable', tooltip: 'Denied by policy' },
          update: { mode: 'hide' },
        },
      },
    });
    const { Can, core: manager } = api;

    beforeEach(() => manager.clear());

    it('applies feature _default policy when not overridden', () => {
      render(
        <Can I="create" a="dictionaries">
          <button data-testid="add">Add</button>
        </Can>
      );
      const btn = screen.getByTestId('add');
      const wrapper = btn.parentElement as HTMLElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper).toHaveAttribute('title', 'Denied by policy');
    });

    it('uses action-specific override from policy', () => {
      render(
        <Can I="update" a="dictionaries">
          <button data-testid="edit">Edit</button>
        </Can>
      );
      // update -> mode hide per policy
      expect(screen.queryByTestId('edit')).not.toBeInTheDocument();
    });

    it('local props override policy', () => {
      render(
        <Can I="update" a="dictionaries" mode="disable" tooltip="Local">
          <button data-testid="edit">Edit</button>
        </Can>
      );
      const btn = screen.getByTestId('edit');
      const wrapper = btn.parentElement as HTMLElement;
      expect(wrapper).toHaveAttribute('title', 'Local');
    });
  });

  describe('guards (ABAC) integration', () => {
    const api = createPermissionsAPI(baseConfig, {
      guards: {
        byFeature: {
          dictionaries: {
            update: (ctx: { currentUserId: string; ownerId: string }) =>
              ctx.currentUserId === ctx.ownerId,
          },
        },
      },
    });
    const { Can, core: manager } = api;

    beforeEach(() => {
      manager.clear();
      manager.grant(['DictionariesUpdate']);
    });

    it('blocks when guard returns false even with permission', () => {
      render(
        <Can
          I="update"
          a="dictionaries"
          of={{ currentUserId: 'u1', ownerId: 'u2' }}
        >
          <button data-testid="edit">Edit</button>
        </Can>
      );
      expect(screen.queryByTestId('edit')).not.toBeInTheDocument();
    });

    it('allows when guard returns true with permission', () => {
      render(
        <Can
          I="update"
          a="dictionaries"
          of={{ currentUserId: 'u1', ownerId: 'u1' }}
        >
          <button data-testid="edit">Edit</button>
        </Can>
      );
      expect(screen.getByTestId('edit')).toBeInTheDocument();
    });
  });
});
