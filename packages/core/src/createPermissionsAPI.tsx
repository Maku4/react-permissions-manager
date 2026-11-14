import {
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type Context,
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
  PermissionsStatus,
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

  type Manager = PermissionsManager<TCfg>;
  type Initial = NonNullable<CreateAPIOptions<TCfg>['initial']>;

  const manager: Manager = new PermissionsManager<TCfg>(options.initial);

  // Created on first use, inside a component. Server code can then import
  // the module that calls this factory, where `createContext` is missing.
  let managerContext: Context<Manager | null> | undefined;
  function getManagerContext() {
    managerContext ??= createContext<Manager | null>(null);
    return managerContext;
  }

  /**
   * Returns the manager of the nearest `PermissionsProvider`, or the
   * shared one (`core`) outside a provider.
   */
  function usePermissionsManager(): Manager {
    return useContext(getManagerContext()) ?? manager;
  }

  /**
   * Gives the components and hooks below it their own manager, starting
   * with `initial`. Use it when rendering on the server, where the shared
   * manager would be visible to every request. When `initial` changes,
   * the provider switches to a new manager that starts with the new value.
   * Without `initial` it starts `idle`.
   */
  function PermissionsProvider(props: {
    initial?: Initial;
    children: ReactNode;
  }) {
    const initialKey =
      props.initial === undefined
        ? undefined
        : JSON.stringify([
            props.initial.permissions ?? [],
            props.initial.roles ?? [],
          ]);
    const [scope, setScope] = useState(() => ({
      manager: new PermissionsManager<TCfg>(props.initial),
      initialKey,
    }));
    // A changed `initial` gets a new manager in this same render, so no
    // child ever renders the new user with the previous user's grants
    let current = scope;
    if (scope.initialKey !== initialKey) {
      current = {
        manager: new PermissionsManager<TCfg>(props.initial),
        initialKey,
      };
      setScope(current);
    }

    const ManagerContext = getManagerContext();
    return (
      <ManagerContext.Provider value={current.manager}>
        {props.children}
      </ManagerContext.Provider>
    );
  }

  const rules = createRules(config, options.guards);

  // Before the permissions are known nothing is allowed, also not a
  // requirement that an empty set of grants would meet, such as `noneOf`
  function isPending(state: State): boolean {
    return state.status === 'idle' || state.status === 'loading';
  }

  function hasPermission(permission: string, state: State): boolean {
    return !isPending(state) && rules.has(permission, state);
  }

  function meetsRequirement(
    require: PermissionGateRequire<PermissionId>,
    state: State
  ): boolean {
    return !isPending(state) && rules.satisfies(require, state);
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
      allowed: !isPending(state) && rules.can(action, feature, context, state),
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
    /**
     * Rendered instead of `fallback` while the permissions are not known
     * yet: before anything is set and during the first load.
     */
    loading?: ReactNode;
    mode?: UIPolicyMode;
    tooltip?: ReactNode;
    TooltipComponent?: TooltipComponent;
  }) {
    const state = usePermissionsStore(usePermissionsManager());
    const allowed = meetsRequirement(props.require, state);

    if (typeof props.children === 'function') return props.children(allowed);
    if (allowed) return props.children;
    if (props.loading !== undefined && isPending(state)) return props.loading;
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
    /**
     * Rendered instead of `fallback` while the permissions are not known
     * yet: before anything is set and during the first load.
     */
    loading?: ReactNode;
    of?: Contexts[F];
    mode?: UIPolicyMode;
    tooltip?: ReactNode;
    TooltipComponent?: TooltipComponent;
  }) {
    const state = usePermissionsStore(usePermissionsManager());
    const { allowed, ui } = useMemo(
      () => evaluate(props.I, props.a, props.of, state),
      [props.I, props.a, props.of, state]
    );

    if (typeof props.children === 'function') return props.children(allowed);
    if (allowed) return props.children;
    if (props.loading !== undefined && isPending(state)) return props.loading;
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
    const state = usePermissionsStore(usePermissionsManager());
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
    const state = usePermissionsStore(usePermissionsManager());
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

  /**
   * Returns the status of the permissions: `idle` before anything is set,
   * `loading` during the first load, `ready` when they are known and
   * `error` when the last load failed. Wait for `ready` or `error` before
   * redirecting a user who lacks access.
   */
  function usePermissionsStatus(): PermissionsStatus {
    return usePermissionsStore(
      usePermissionsManager(),
      (state) => state.status
    );
  }

  return {
    Can,
    PermissionGate,
    useCan,
    usePermissionFilter,
    usePermissionsStatus,
    usePermissionsManager,
    PermissionsProvider,
    core: manager,
  } as const;
}
