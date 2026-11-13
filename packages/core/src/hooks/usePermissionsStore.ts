'use client';
import { useSyncExternalStore } from 'react';
import type { PermissionsManager } from '../manager/PermissionsManager';
import type { PermissionsConfig, PermissionState } from '../types';

/**
 * Subscribes a component to a permissions manager. Without a selector it
 * returns the whole state. A selector must return a stable value for an
 * unchanged state, as `useSyncExternalStore` requires.
 */
export function usePermissionsStore<TCfg extends PermissionsConfig>(
  manager: PermissionsManager<TCfg>
): PermissionState<TCfg>;
export function usePermissionsStore<TCfg extends PermissionsConfig, TSelected>(
  manager: PermissionsManager<TCfg>,
  selector: (state: PermissionState<TCfg>) => TSelected
): TSelected;
export function usePermissionsStore<TCfg extends PermissionsConfig, TSelected>(
  manager: PermissionsManager<TCfg>,
  selector?: (state: PermissionState<TCfg>) => TSelected
): TSelected | PermissionState<TCfg> {
  const getSnapshot = () => {
    const state = manager.getState();
    return selector ? selector(state) : state;
  };
  return useSyncExternalStore(
    (onChange) => manager.subscribe(onChange),
    getSnapshot,
    getSnapshot
  );
}
