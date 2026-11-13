import type {
  Guards,
  PermissionGateRequire,
  PermissionsConfig,
} from '../types';

/** The permissions and roles a check runs against. */
export interface Grants {
  granted: ReadonlySet<string>;
  roles: ReadonlySet<string>;
}

/**
 * Builds the checks for one config. They are pure functions of the grants
 * passed in, with no React dependency, so the components, the hooks and the
 * checker for code outside React share them.
 */
export function createRules<TCfg extends PermissionsConfig>(
  config: TCfg,
  guards: Guards<TCfg> | undefined
) {
  let cachedRoles: ReadonlySet<string> | undefined;
  let cachedRolePermissions = new Set<string>();

  function rolePermissions(roles: ReadonlySet<string>): Set<string> {
    if (roles === cachedRoles) return cachedRolePermissions;
    const result = new Set<string>();
    for (const role of roles) {
      for (const permission of config.roles[role] ?? []) result.add(permission);
    }
    cachedRoles = roles;
    cachedRolePermissions = result;
    return result;
  }

  function has(permission: string, grants: Grants): boolean {
    return (
      grants.granted.has(permission) ||
      rolePermissions(grants.roles).has(permission)
    );
  }

  function satisfies(
    require: PermissionGateRequire<string>,
    grants: Grants
  ): boolean {
    const required =
      typeof require === 'string' ? { anyOf: [require] } : (require ?? {});
    const hasPermission = (permission: string) => has(permission, grants);
    return (
      (required.anyOf?.some(hasPermission) ?? true) &&
      (required.allOf?.every(hasPermission) ?? true) &&
      (required.noneOf?.every((permission) => !hasPermission(permission)) ??
        true)
    );
  }

  function can(
    action: string,
    feature: string,
    context: unknown,
    grants: Grants
  ): boolean {
    const permission = config.features[feature]?.[action];
    if (permission === undefined || !has(permission, grants)) return false;

    const byFeature = guards?.byFeature as
      Record<string, Record<string, unknown> | undefined> | undefined;
    const guard = byFeature?.[feature]?.[action];
    if (typeof guard !== 'function') return true;
    // A guarded action without a context is denied: the guard cannot run
    return context !== undefined && Boolean(guard(context));
  }

  return { has, satisfies, can };
}
