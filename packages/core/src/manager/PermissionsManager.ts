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
  private state: PermissionState<TCfg>;

  private readonly initialState: PermissionState<TCfg>;

  private subscribers = new Set<() => void>();

  // Bumped by every load and by every call that changes the grants, so a
  // slower, older load cannot overwrite what came after it
  private generation = 0;

  /**
   * With `initial`, the manager starts `ready` with those permissions and
   * roles. Without it, it starts `idle` with nothing granted.
   */
  constructor(initial?: LoadedPermissions) {
    this.state = initial
      ? readyState<TCfg>(initial)
      : { status: 'idle', granted: new Set(), roles: new Set() };
    this.initialState = this.state;
  }

  /**
   * Returns the state the manager was created with. Server rendering and
   * hydration read it, so both produce the same output even when the
   * state changes before hydration ends.
   */
  public getInitialState(): PermissionState<TCfg> {
    return this.initialState;
  }

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

  /**
   * Replaces every permission and role with the ones given. A missing
   * field means none, so `set({})` records a user who has nothing.
   */
  public set(next: LoadedPermissions) {
    this.generation++;
    this.setState(readyState<TCfg>(next));
  }

  /** Replaces the current roles. */
  public setRoles(roles: Iterable<string>) {
    this.generation++;
    this.setState({
      granted: this.state.granted,
      roles: toRoleSet<TCfg>(roles),
      status: 'ready',
    });
  }

  /** Adds permissions to the ones already granted. */
  public grant(permissions: Iterable<string>) {
    this.generation++;
    const granted = new Set(this.state.granted);
    for (const permission of permissions) granted.add(String(permission));
    this.setState({ granted, roles: this.state.roles, status: 'ready' });
  }

  /** Removes every permission and role and returns to `idle`. */
  public clear() {
    this.generation++;
    this.setState({ status: 'idle', granted: new Set(), roles: new Set() });
  }

  /** Marks the state as loading. Every check is denied until it is ready. */
  public startLoading() {
    if (this.state.status !== 'loading') {
      this.setState({
        granted: this.state.granted,
        roles: this.state.roles,
        status: 'loading',
      });
    }
  }

  /**
   * Loads roles and permissions from `loader` and replaces the current ones
   * with the result.
   *
   * A first load sets the status to `loading`. A reload from `ready` keeps
   * the status and the current grants until the result arrives. If the
   * loader throws, the grants stay as they were, the status becomes
   * `error` and the thrown value is stored in `error`.
   *
   * When loads overlap, only the one started last is applied. A load is
   * also dropped when `set`, `grant`, `setRoles` or `clear` runs before it
   * finishes, so the later call wins.
   */
  public async loadFrom(loader: () => Promise<LoadedPermissions>) {
    const generation = ++this.generation;
    if (this.state.status !== 'ready') this.startLoading();

    let loaded: LoadedPermissions;
    try {
      loaded = await loader();
    } catch (error) {
      if (generation !== this.generation) return;
      // Keep the previous grants: a failed load must not add access
      this.setState({
        granted: this.state.granted,
        roles: this.state.roles,
        status: 'error',
        error,
      });
      return;
    }
    if (generation !== this.generation) return;
    this.setState(readyState<TCfg>(loaded ?? {}));
  }
}

function readyState<TCfg extends PermissionsConfig>(
  source: LoadedPermissions
): PermissionState<TCfg> {
  const granted = new Set<string>();
  if (Array.isArray(source.permissions)) {
    for (const permission of source.permissions)
      granted.add(String(permission));
  }
  return {
    status: 'ready',
    granted,
    roles: toRoleSet<TCfg>(Array.isArray(source.roles) ? source.roles : []),
  };
}

function toRoleSet<TCfg extends PermissionsConfig>(
  roles: Iterable<string>
): Set<InferRole<TCfg>> {
  const result = new Set<InferRole<TCfg>>();
  for (const role of roles) result.add(String(role) as InferRole<TCfg>);
  return result;
}
