// Entry point without React: for servers, route handlers, scripts and tests
export { definePermissionsConfig } from './definePermissionsConfig';
export { createPermissionChecker } from './createPermissionChecker';
export type {
  CreateCheckerOptions,
  PermissionSubject,
} from './createPermissionChecker';
export { createPermissionGuard } from './createPermissionGuard';
export type { CreateGuardOptions } from './createPermissionGuard';
export type {
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
  TypedGuards,
} from './types';
