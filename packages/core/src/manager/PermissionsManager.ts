import type { InferRole, PermissionsConfig, PermissionState } from '../types';

export type Unsubscribe = () => void;

export interface LoadedPermissions {
  roles?: readonly string[];
  permissions?: readonly string[];
}

/**
 * Holds the granted permissions and roles of the current user and notifies
 * subscribers when they change. It has no React dependency.
 */
export class PermissionsManager<TCfg extends PermissionsConfig> {
  private state: PermissionState<TCfg> = {
    status: 'idle',
    granted: new Set(),
    roles: new Set(),
  };

  private subscribers = new Set<() => void>();

  public subscribe(listener: () => void): Unsubscribe {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public getState(): PermissionState<TCfg> {
    return this.state;
  }

  private setState(next: PermissionState<TCfg>) {
    this.state = next;
    this.subscribers.forEach((listener) => listener());
  }

  /** Replaces the current roles. */
  public setRoles(roles: Iterable<string>) {
    this.setState({
      ...this.state,
      roles: toRoleSet<TCfg>(roles),
      status: 'ready',
    });
  }

  /** Adds permissions to the ones already granted. */
  public grant(permissions: Iterable<string>) {
    const granted = new Set(this.state.granted);
    for (const permission of permissions) granted.add(String(permission));
    this.setState({ ...this.state, granted, status: 'ready' });
  }

  /** Removes every permission and role and returns to `idle`. */
  public clear() {
    this.setState({ status: 'idle', granted: new Set(), roles: new Set() });
  }

  /** Marks the state as loading. Every check is denied until it is ready. */
  public startLoading() {
    if (this.state.status !== 'loading') {
      this.setState({ ...this.state, status: 'loading' });
    }
  }

  /**
   * Loads roles and permissions from `loader`. Loaded roles replace the
   * current ones and loaded permissions are added to the granted ones. If
   * the loader throws, the previous state is kept and marked ready, so
   * nothing new is granted.
   */
  public async loadFrom(loader: () => Promise<LoadedPermissions>) {
    this.startLoading();
    let loaded: LoadedPermissions = {};
    try {
      loaded = await loader();
    } catch {
      // Keep the previous grants: a failed load must not add access
    }
    const hasRoles = Array.isArray(loaded.roles) && loaded.roles.length > 0;
    const hasPermissions =
      Array.isArray(loaded.permissions) && loaded.permissions.length > 0;

    this.setState({
      roles: hasRoles ? toRoleSet<TCfg>(loaded.roles!) : this.state.roles,
      granted: hasPermissions
        ? new Set([...this.state.granted, ...loaded.permissions!.map(String)])
        : this.state.granted,
      status: 'ready',
    });
  }
}

function toRoleSet<TCfg extends PermissionsConfig>(
  roles: Iterable<string>
): Set<InferRole<TCfg>> {
  const result = new Set<InferRole<TCfg>>();
  for (const role of roles) result.add(String(role) as InferRole<TCfg>);
  return result;
}
