import {
  createPermissionChecker,
  type CreateCheckerOptions,
  type PermissionSubject,
} from './createPermissionChecker';
import type {
  FeatureContexts,
  Guards,
  InferActionNameFor,
  InferFeatureName,
  InferPermissionId,
  PermissionGateRequire,
  PermissionsConfig,
} from './types';

export interface CreateGuardOptions<
  TCfg extends PermissionsConfig,
  TSubject extends PermissionSubject,
  TGuards extends Guards<TCfg> | undefined = Guards<TCfg> | undefined,
> extends CreateCheckerOptions<TCfg, TGuards> {
  /**
   * Returns the user of the current request, or `null` when nobody is
   * signed in. It runs on every call, so memoize it per request.
   */
  getSubject: () =>
    TSubject | null | undefined | Promise<TSubject | null | undefined>;
  /**
   * Runs when `require` or `requireCan` fails. It must not return: throw,
   * or call a function that throws, such as a framework redirect.
   * `subject` is `null` when nobody is signed in.
   */
  onDenied: (denial: { subject: TSubject | null }) => never;
}

/**
 * Creates checks for the user of the current request: on the server, in
 * route handlers and server functions. The user comes from `getSubject`
 * on every call, so nothing is shared between requests. Without a user
 * every check is denied.
 */
export function createPermissionGuard<
  const TCfg extends PermissionsConfig,
  TSubject extends PermissionSubject = PermissionSubject,
  const TGuards extends Guards<TCfg> | undefined = undefined,
>(config: TCfg, options: CreateGuardOptions<TCfg, TSubject, TGuards>) {
  type PermissionId = InferPermissionId<TCfg>;
  type FeatureName = InferFeatureName<TCfg>;
  type Contexts = FeatureContexts<TCfg, TGuards>;
  type Requirement = PermissionGateRequire<PermissionId>;

  const checker = createPermissionChecker<TCfg, TGuards>(config, {
    guards: options.guards,
  });

  async function currentSubject(): Promise<TSubject | null> {
    return (await options.getSubject()) ?? null;
  }

  function deny(subject: TSubject | null): never {
    options.onDenied({ subject });
    throw new Error(
      'createPermissionGuard: onDenied returned. It has to throw or redirect.'
    );
  }

  /** Whether the current user has the permission. */
  async function has(permission: PermissionId): Promise<boolean> {
    const subject = await currentSubject();
    return subject !== null && checker.has(subject, permission);
  }

  /** Whether the current user meets `anyOf`, `allOf` and `noneOf`. */
  async function satisfies(require: Requirement): Promise<boolean> {
    const subject = await currentSubject();
    return subject !== null && checker.satisfies(subject, require);
  }

  /** Whether the current user can perform the action on the feature. */
  async function can<
    F extends FeatureName,
    A extends InferActionNameFor<TCfg, F>,
  >(action: A, feature: F, context?: Contexts[F]): Promise<boolean> {
    const subject = await currentSubject();
    return subject !== null && checker.can(subject, action, feature, context);
  }

  /** Keeps the items the current user may see. */
  async function filter<TItem>(
    items: readonly TItem[],
    getRequirement: (item: TItem) => Requirement | undefined
  ): Promise<TItem[]> {
    const subject = await currentSubject();
    if (subject === null) {
      return items.filter((item) => getRequirement(item) === undefined);
    }
    return checker.filter(subject, items, getRequirement);
  }

  /**
   * Returns the current user when they meet the requirement. Otherwise
   * calls `onDenied`.
   */
  async function require(requirement: Requirement): Promise<TSubject> {
    const subject = await currentSubject();
    if (subject === null || !checker.satisfies(subject, requirement)) {
      deny(subject);
    }
    return subject;
  }

  /**
   * Returns the current user when they can perform the action on the
   * feature. Otherwise calls `onDenied`.
   */
  async function requireCan<
    F extends FeatureName,
    A extends InferActionNameFor<TCfg, F>,
  >(action: A, feature: F, context?: Contexts[F]): Promise<TSubject> {
    const subject = await currentSubject();
    if (subject === null || !checker.can(subject, action, feature, context)) {
      deny(subject);
    }
    return subject;
  }

  return { has, satisfies, can, filter, require, requireCan } as const;
}
