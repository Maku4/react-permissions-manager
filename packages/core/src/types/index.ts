import type { ComponentType, ReactNode } from 'react';

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * The root configuration accepted by `createPermissionsAPI`.
 * Literal keys and values drive type inference for the whole API.
 */
export interface PermissionsConfig {
  permissions: Record<string, string>;
  features: Record<string, Partial<Record<string, string>>>;
  roles: Record<string, readonly string[]>;
}

export type InferPermissionId<TCfg extends PermissionsConfig> =
  keyof TCfg['permissions'] & string;
export type InferFeatureName<TCfg extends PermissionsConfig> =
  keyof TCfg['features'] & string;
export type InferActionNameFor<
  TCfg extends PermissionsConfig,
  TFeature extends InferFeatureName<TCfg>,
> = keyof TCfg['features'][TFeature] & string;
export type InferActionName<TCfg extends PermissionsConfig> = keyof {
  [F in InferFeatureName<TCfg> as InferActionNameFor<TCfg, F>]: unknown;
} &
  string;
export type InferRole<TCfg extends PermissionsConfig> = keyof TCfg['roles'] &
  string;

export type UIPolicyMode = 'hide' | 'disable';

export type TooltipComponent = ComponentType<{
  title?: string;
  content?: ReactNode;
  children: ReactNode;
}>;

export type UIPolicyEntry = {
  mode: UIPolicyMode;
  /** Tooltip shown when `mode` is `'disable'`. */
  tooltip?: ReactNode;
  /**
   * Tooltip component for this entry. It receives `title` when the tooltip
   * is a string, `content` with the tooltip as given, and the disabled
   * element as `children`.
   */
  TooltipComponent?: TooltipComponent;
};

export type UIPolicyForFeature<
  TCfg extends PermissionsConfig,
  TFeature extends InferFeatureName<TCfg>,
> = Prettify<
  Partial<
    Record<InferActionNameFor<TCfg, TFeature> | '_default', UIPolicyEntry>
  >
>;

export type UIPolicy<TCfg extends PermissionsConfig> = Prettify<
  Partial<{
    [F in InferFeatureName<TCfg>]: UIPolicyForFeature<TCfg, F>;
  }>
>;

/**
 * Guards of one feature. `context` is never called. It only carries the
 * context type that `<Can of>` and `useCan` accept for this feature.
 */
export interface FeatureGuards<TContext = unknown> {
  context?: TContext;
  [action: string]: ((ctx: TContext) => boolean) | undefined | TContext;
}

export interface Guards<TCfg extends PermissionsConfig> {
  byFeature?: Partial<{
    [F in InferFeatureName<TCfg>]:
      | FeatureGuards
      | Partial<Record<InferActionNameFor<TCfg, F>, (ctx: unknown) => boolean>>;
  }>;
}

/** Guards shape for when one context type applies to every feature. */
export interface TypedGuards<
  TCfg extends PermissionsConfig,
  TContext = unknown,
> {
  byFeature?: Partial<{
    [F in InferFeatureName<TCfg>]: FeatureGuards<TContext>;
  }>;
}

export interface CreateAPIOptions<
  TCfg extends PermissionsConfig,
  TGuards extends Guards<TCfg> | undefined = Guards<TCfg> | undefined,
> {
  uiPolicy?: UIPolicy<TCfg>;
  guards?: TGuards;
  /**
   * Tooltip component used when an element is disabled. A policy entry or
   * a local prop overrides it.
   */
  defaultTooltipComponent?: TooltipComponent;
  /**
   * Permissions and roles known before the first render, for example read
   * from a token. The manager then starts `ready`. The manager lives in
   * module scope, so use this in apps rendered in the browser only.
   */
  initial?: {
    permissions?: readonly InferPermissionId<TCfg>[];
    roles?: readonly InferRole<TCfg>[];
  };
}

/** Per-feature context types read from the guards passed to the factory. */
export type FeatureContexts<
  TCfg extends PermissionsConfig,
  TGuards extends Guards<TCfg> | undefined = Guards<TCfg> | undefined,
> = {
  [F in InferFeatureName<TCfg>]: TGuards extends { byFeature?: infer BF }
    ? BF extends Record<string, unknown>
      ? BF[F] extends FeatureGuards<infer C>
        ? C
        : unknown
      : unknown
    : unknown;
};

export type PermissionGateRequire<TPerm extends string> =
  | TPerm
  | {
      anyOf?: readonly TPerm[];
      allOf?: readonly TPerm[];
      noneOf?: readonly TPerm[];
    };

/**
 * `idle`: nothing was set yet. `loading`: the first load is running.
 * `ready`: permissions and roles are known. `error`: the last load failed.
 */
export type PermissionsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PermissionState<TCfg extends PermissionsConfig> {
  status: PermissionsStatus;
  granted: Set<string>;
  roles: Set<InferRole<TCfg>>;
  /** What the loader threw. Set only while `status` is `error`. */
  error?: unknown;
}
