import {
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { usePermissionsStore } from './hooks/usePermissionsStore';
import { PermissionsManager } from './manager/PermissionsManager';
import { createRules } from './rules/createRules';
import type {
  CreateAPIOptions,
  FeatureContexts,
  Guards,
  InferActionName,
  InferActionNameFor,
  InferFeatureName,
  InferPermissionId,
  PermissionGateRequire,
  PermissionsConfig,
  PermissionState,
  TooltipComponent,
  UIPolicyEntry,
  UIPolicyMode,
} from './types';

type RenderableChildren = ReactNode | ((allowed: boolean) => ReactNode);

interface DisabledElementProps {
  disabled?: boolean;
  'aria-disabled'?: boolean;
  title?: string;
}

function renderDisabled(
  child: ReactNode,
  tooltip: ReactNode,
  Tooltip: TooltipComponent | undefined
): ReactNode {
  const title = typeof tooltip === 'string' ? tooltip : undefined;
  const disabledNode = (
    <span
      aria-disabled
      title={title}
      style={{ pointerEvents: 'none', opacity: 0.6 }}
    >
      {child}
    </span>
  );
  if (!Tooltip) return disabledNode;
  return (
    <Tooltip title={title} content={tooltip}>
      {disabledNode}
    </Tooltip>
  );
}

function disableElement(child: ReactNode, tooltip: ReactNode): ReactNode {
  if (!isValidElement<DisabledElementProps>(child)) return child;
  return cloneElement(child, {
    disabled: true,
    'aria-disabled': true,
    title: typeof tooltip === 'string' ? tooltip : child.props.title,
  });
}

/**
 * Creates the permissions API for one config: the `Can` and
 * `PermissionGate` components, the `useCan` hook and the manager (`core`)
 * that holds the current user's permissions and roles.
 */
export function createPermissionsAPI<
  const TCfg extends PermissionsConfig,
  const TGuards extends Guards<TCfg> | undefined = undefined,
>(config: TCfg, options: CreateAPIOptions<TCfg, TGuards> = {}) {
  type PermissionId = InferPermissionId<TCfg>;
  type FeatureName = InferFeatureName<TCfg>;
  type ActionName = InferActionName<TCfg>;
  type Contexts = FeatureContexts<TCfg, TGuards>;
  type State = PermissionState<TCfg>;

  const manager = new PermissionsManager<TCfg>();

  const rules = createRules(config, options.guards);

  function hasPermission(permission: string, state: State): boolean {
    return state.status !== 'loading' && rules.has(permission, state);
  }

  function meetsRequirement(
    require: PermissionGateRequire<PermissionId>,
    state: State
  ): boolean {
    return state.status !== 'loading' && rules.satisfies(require, state);
  }

  function resolvePolicy(
    feature: string,
    action: string
  ): UIPolicyEntry | undefined {
    const byFeature = options.uiPolicy as
      | Record<string, Record<string, UIPolicyEntry | undefined> | undefined>
      | undefined;
    const featurePolicy = byFeature?.[feature];
    return featurePolicy?.[action] ?? featurePolicy?._default;
  }

  function evaluate(
    action: string,
    feature: string,
    context: unknown,
    state: State
  ): { allowed: boolean; ui?: UIPolicyEntry } {
    return {
      allowed:
        state.status !== 'loading' &&
        rules.can(action, feature, context, state),
      ui: resolvePolicy(feature, action),
    };
  }

  /**
   * Renders its children when every listed requirement is met. Use it for
   * checks on raw permission ids, without features and actions.
   */
  function PermissionGate(props: {
    require: PermissionGateRequire<PermissionId>;
    children: RenderableChildren;
    fallback?: ReactNode;
    mode?: UIPolicyMode;
    tooltip?: ReactNode;
    TooltipComponent?: TooltipComponent;
  }) {
    const state = usePermissionsStore(manager);
    const allowed = meetsRequirement(props.require, state);

    if (typeof props.children === 'function') return props.children(allowed);
    if (allowed) return props.children;
    if ((props.mode ?? 'hide') === 'hide') return props.fallback ?? null;

    return renderDisabled(
      props.children,
      props.tooltip,
      props.TooltipComponent ?? options.defaultTooltipComponent
    );
  }

  /**
   * Renders its children when the user can perform action `I` on feature
   * `a`. `of` is the context passed to the guard of that action.
   */
  function Can<
    F extends FeatureName,
    A extends InferActionNameFor<TCfg, F>,
  >(props: {
    I: A;
    a: F;
    children: RenderableChildren;
    fallback?: ReactNode;
    of?: Contexts[F];
    mode?: UIPolicyMode;
    tooltip?: ReactNode;
    TooltipComponent?: TooltipComponent;
  }) {
    const state = usePermissionsStore(manager);
    const { allowed, ui } = useMemo(
      () => evaluate(props.I, props.a, props.of, state),
      [props.I, props.a, props.of, state]
    );

    if (typeof props.children === 'function') return props.children(allowed);
    if (allowed) return props.children;
    if ((props.mode ?? ui?.mode ?? 'hide') === 'hide') {
      return props.fallback ?? null;
    }

    const tooltip = props.tooltip ?? ui?.tooltip;
    return renderDisabled(
      disableElement(props.children, tooltip),
      tooltip,
      props.TooltipComponent ??
        ui?.TooltipComponent ??
        options.defaultTooltipComponent
    );
  }

  /**
   * With a permission id, returns whether the user has it. With an action
   * and a feature, returns `{ allowed, ui }`, where `ui` is the UI policy
   * entry for that action.
   */
  function useCan(permission: PermissionId): boolean;
  function useCan<F extends FeatureName, A extends InferActionNameFor<TCfg, F>>(
    action: A,
    feature: F,
    context?: Contexts[F]
  ): { allowed: boolean; ui?: UIPolicyEntry };
  function useCan(
    permissionOrAction: PermissionId | ActionName,
    feature?: FeatureName,
    context?: unknown
  ): boolean | { allowed: boolean; ui?: UIPolicyEntry } {
    const state = usePermissionsStore(manager);
    const actionResult = useMemo(
      () =>
        feature === undefined
          ? undefined
          : evaluate(permissionOrAction, feature, context, state),
      [permissionOrAction, feature, context, state]
    );
    return actionResult ?? hasPermission(permissionOrAction, state);
  }

  /**
   * Returns a function that keeps the items the user may see.
   * `getRequirement` returns what an item needs, or `undefined` for an item
   * everyone may see. The function changes when permissions or roles
   * change, so it works as a `useMemo` dependency.
   */
  function usePermissionFilter() {
    const state = usePermissionsStore(manager);
    return useCallback(
      <TItem,>(
        items: readonly TItem[],
        getRequirement: (
          item: TItem
        ) => PermissionGateRequire<PermissionId> | undefined
      ): TItem[] =>
        items.filter((item) => {
          const requirement = getRequirement(item);
          return (
            requirement === undefined || meetsRequirement(requirement, state)
          );
        }),
      [state]
    );
  }

  return {
    Can,
    PermissionGate,
    useCan,
    usePermissionFilter,
    core: manager,
  } as const;
}
