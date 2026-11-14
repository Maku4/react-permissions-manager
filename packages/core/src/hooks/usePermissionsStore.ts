'use client';
import { useSyncExternalStore } from 'react';
import type { PermissionsManager } from '../manager/PermissionsManager';
import type { PermissionsConfig, PermissionState } from '../types';

/**
 * Subscribes a component to a permissions manager. Without a selector it
 * returns the whole state. On the server and during hydration it reads the
 * state the manager was created with. A selector must return a stable value for an
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
  const select = (state: PermissionState<TCfg>) =>
    selector ? selector(state) : state;
  return useSyncExternalStore(
    (onChange) => manager.subscribe(onChange),
    () => select(manager.getState()),
    // Server rendering and hydration read the state the manager started
    // with, so they agree even if the state changes before hydration ends
    () => select(manager.getInitialState())
  );
}
