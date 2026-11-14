import { createRules, type Grants } from './rules/createRules';
import type {
  FeatureContexts,
  Guards,
  InferActionNameFor,
  InferFeatureName,
  InferPermissionId,
  PermissionGateRequire,
  PermissionsConfig,
} from './types';

/** The user a check is about: what they were granted and their roles. */
export interface PermissionSubject {
  permissions?: Iterable<string>;
  roles?: Iterable<string>;
}

export interface CreateCheckerOptions<
  TCfg extends PermissionsConfig,
  TGuards extends Guards<TCfg> | undefined = Guards<TCfg> | undefined,
> {
  guards?: TGuards;
}

function toGrants(subject: PermissionSubject): Grants {
  const granted = new Set<string>();
  for (const permission of subject.permissions ?? []) {
    granted.add(String(permission));
  }
  const roles = new Set<string>();
  for (const role of subject.roles ?? []) roles.add(String(role));
  return { granted, roles };
}

/**
 * Creates checks that run outside React: on the server, in route handlers,
 * in tests. Every call takes the user it is about and keeps no state, so
 * one checker is safe to share between requests.
 */
export function createPermissionChecker<
  const TCfg extends PermissionsConfig,
  const TGuards extends Guards<TCfg> | undefined = undefined,
>(config: TCfg, options: CreateCheckerOptions<TCfg, TGuards> = {}) {
  type PermissionId = InferPermissionId<TCfg>;
  type FeatureName = InferFeatureName<TCfg>;
  type Contexts = FeatureContexts<TCfg, TGuards>;
  type Requirement = PermissionGateRequire<PermissionId>;

  const rules = createRules(config, options.guards);

  /** Whether the user has the permission, directly or through a role. */
  function has(subject: PermissionSubject, permission: PermissionId): boolean {
    return rules.has(permission, toGrants(subject));
  }

  /** Whether the user meets `anyOf`, `allOf` and `noneOf`, like `<PermissionGate>`. */
  function satisfies(
    subject: PermissionSubject,
    require: Requirement
  ): boolean {
    return rules.satisfies(require, toGrants(subject));
  }

  /** Whether the user can perform the action on the feature, like `<Can>`. */
  function can<F extends FeatureName, A extends InferActionNameFor<TCfg, F>>(
    subject: PermissionSubject,
    action: A,
    feature: F,
    context?: Contexts[F]
  ): boolean {
    return rules.can(action, feature, context, toGrants(subject));
  }

  /**
   * Keeps the items the user may see. `getRequirement` returns what an item
   * needs, or `undefined` for an item everyone may see.
   */
  function filter<TItem>(
    subject: PermissionSubject,
    items: readonly TItem[],
    getRequirement: (item: TItem) => Requirement | undefined
  ): TItem[] {
    const grants = toGrants(subject);
    return items.filter((item) => {
      const requirement = getRequirement(item);
      return requirement === undefined || rules.satisfies(requirement, grants);
    });
  }

  return { has, satisfies, can, filter } as const;
}
