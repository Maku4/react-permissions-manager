import { version as packageVersion } from '../package.json';

// Factory and config helper
export { createPermissionsAPI } from './createPermissionsAPI';
export { definePermissionsConfig } from './definePermissionsConfig';

// Checks outside React
export { createPermissionChecker } from './createPermissionChecker';
export type {
  CreateCheckerOptions,
  PermissionSubject,
} from './createPermissionChecker';

// Manager and store hook, for integrations and advanced usage
export { PermissionsManager } from './manager/PermissionsManager';
export type {
  LoadedPermissions,
  Unsubscribe,
} from './manager/PermissionsManager';
export { usePermissionsStore } from './hooks/usePermissionsStore';

// Public type exports
export type {
  CreateAPIOptions,
  FeatureContexts,
  FeatureGuards,
  Guards,
  InferActionName as ActionName,
  InferActionNameFor as ActionNameFor,
  InferFeatureName as FeatureName,
  InferPermissionId as PermissionId,
  InferRole as Role,
  PermissionGateRequire,
  PermissionsConfig,
  PermissionState,
  PermissionsStatus,
  TooltipComponent,
  TypedGuards,
  UIPolicy,
  UIPolicyEntry,
  UIPolicyForFeature,
  UIPolicyMode,
} from './types';

// Version
export const version: string = packageVersion;
