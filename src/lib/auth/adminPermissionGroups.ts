export const ADMIN_PERMISSION_GROUPS = {
  dashboardView: ["dashboard:view"],
  usersView: ["user:view", "user:manage"],
  usersManage: ["user:manage"],
  rbacView: ["rbac:view", "rbac:manage"],
  rbacManage: ["rbac:manage"],
  readingsView: ["reading:view", "reading:review"],
  readingsManage: ["reading:review", "reading:flag", "reading:reject"],
  historyView: ["history:view", "audit:view"],
  consumptionView: ["consumption:view"],
  metersView: ["meter:view", "meter:manage"],
  metersManage: ["meter:manage"],
  metersImport: ["meter:import"],
  tasksView: ["task:create", "task:update", "task:assign"],
  tasksCreate: ["task:create"],
  tasksManage: ["task:update", "task:assign"],
  billingEntry: [
    "billing:view",
    "billing:city:manage",
    "billing:zone:manage",
    "billing:tariff:manage",
    "billing:campaign:manage",
    "billing:invoice:view",
    "billing:invoice:manage",
  ],
  billingCitiesManage: ["billing:city:manage"],
  billingZonesManage: ["billing:zone:manage"],
  billingTariffsManage: ["billing:tariff:manage"],
  billingCampaignsManage: ["billing:campaign:manage"],
  billingInvoicesView: ["billing:invoice:view", "billing:invoice:manage"],
  billingInvoicesManage: ["billing:invoice:manage"],
  settingsManage: ["settings:manage"],
  staffUtilities: ["dashboard:view"],
} as const;

export function hasAnyPermissionCode(
  permissionCodes: string[] | readonly string[],
  requiredPermissions?: readonly string[]
) {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  return requiredPermissions.some((code) => permissionCodes.includes(code));
}
