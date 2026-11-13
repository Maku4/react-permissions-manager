/**
 * Defines a permissions config and keeps its literal types.
 * Features and roles can only reference permissions declared in
 * `permissions`, so a typo is a compile error.
 */
export function definePermissionsConfig<
  const TPermissions extends Record<string, string>,
  const TFeatures extends Record<
    string,
    Partial<Record<string, keyof TPermissions>>
  >,
  const TRoles extends Record<string, readonly (keyof TPermissions)[]>,
>(config: { permissions: TPermissions; features: TFeatures; roles: TRoles }) {
  return config;
}
