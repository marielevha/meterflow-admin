"use client";
import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { E2CAdminBrand } from "@/components/brand/E2CAdminBrand";
import { useAdminI18n } from "@/hooks/use-admin-i18n";
import { ADMIN_PERMISSION_GROUPS } from "@/lib/auth/adminPermissionGroups";
import { useSidebar } from "../context/SidebarContext";
import {
  BoxCubeIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  ListIcon,
  PageIcon,
  PieChartIcon,
  PlugInIcon,
  TaskIcon,
  TableIcon,
  UserCircleIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  requiredAnyOfPermissions?: string[];
  subItems?: {
    name: string;
    path: string;
    pro?: boolean;
    new?: boolean;
    requiredAnyOfPermissions?: string[];
  }[];
};
const SHOW_DEMO_MENU = process.env.NEXT_PUBLIC_SHOW_DEMO_MENU === "1";

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Ecommerce", path: "/admin", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.dashboardView] },
      { name: "Overview", path: "/admin/overview", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.dashboardView] },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "User management",
    subItems: [
      { name: "Users", path: "/admin/users", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.usersView] },
      { name: "Rules & Permissions", path: "/admin/rules-permissions", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.rbacView] },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Reading management",
    subItems: [
      { name: "Readings", path: "/admin/readings", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.readingsView] },
      { name: "History", path: "/admin/history", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.historyView] },
      { name: "Consumption", path: "/admin/consumption", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.consumptionView] },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Meter management",
    subItems: [
      { name: "Meters", path: "/admin/meters", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.metersView] },
      { name: "Add meter", path: "/admin/meters/create", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.metersCreate] },
      {
        name: "Import meters",
        path: "/admin/meters/import",
        pro: false,
        requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.metersImport],
      },
    ],
  },
  {
    icon: <TaskIcon />,
    name: "Tasks management",
    subItems: [
      { name: "Tasks", path: "/admin/tasks", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.tasksView] },
      { name: "Add task", path: "/admin/tasks/create", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.tasksCreate] },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Billing",
    subItems: [
      { name: "Overview", path: "/admin/billing", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingOverviewView] },
      { name: "Cities", path: "/admin/billing/cities", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingCitiesView] },
      { name: "Zones", path: "/admin/billing/zones", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingZonesView] },
      { name: "Tariffs", path: "/admin/billing/tariffs", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingTariffsView] },
      { name: "Campaigns", path: "/admin/billing/campaigns", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingCampaignsView] },
      { name: "Invoices", path: "/admin/billing/invoices", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.billingInvoicesView] },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/admin/calendar",
    requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.calendarView],
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/admin/profile",
    requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.profileView],
  },
  {
    icon: <PlugInIcon />,
    name: "Settings",
    path: "/admin/settings",
    requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.settingsView],
  },

];

const demoMainItems: NavItem[] = [
  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [{ name: "Form Elements", path: "/admin/form-elements", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] }],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/admin/basic-tables", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] }],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "Blank Page", path: "/admin/blank", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "404 Error", path: "/error-404", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
    ],
  },
];

const demoOtherItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/admin/line-chart", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Bar Chart", path: "/admin/bar-chart", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/admin/alerts", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Avatar", path: "/admin/avatars", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Badge", path: "/admin/badge", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Buttons", path: "/admin/buttons", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Images", path: "/admin/images", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Videos", path: "/admin/videos", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
      { name: "Sign Up", path: "/signup", pro: false, requiredAnyOfPermissions: [...ADMIN_PERMISSION_GROUPS.showcaseView] },
    ],
  },
];

const AppSidebar: React.FC<{ permissionCodes?: string[] }> = ({ permissionCodes = [] }) => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const { t } = useAdminI18n();
  const hasAnyPermission = useCallback(
    (requiredPermissions?: string[]) => {
      if (!requiredPermissions || requiredPermissions.length === 0) return true;
      return requiredPermissions.some((code) => permissionCodes.includes(code));
    },
    [permissionCodes]
  );

  const filterNavItems = useCallback(
    (items: NavItem[]) =>
      items.flatMap((nav) => {
        if (!nav.subItems) {
          return hasAnyPermission(nav.requiredAnyOfPermissions) ? [nav] : [];
        }
        const allowedSubItems = nav.subItems.filter((subItem) =>
          hasAnyPermission(subItem.requiredAnyOfPermissions)
        );
        if (allowedSubItems.length === 0) return [];
        return [{ ...nav, subItems: allowedSubItems }];
      }),
    [hasAnyPermission]
  );

  const effectiveMainItems = filterNavItems(SHOW_DEMO_MENU ? [...navItems, ...demoMainItems] : navItems);
  const effectiveOtherItems = SHOW_DEMO_MENU ? demoOtherItems : [];

  const renderMenuItems = (
    menuItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {menuItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{translateNavLabel(t, nav.name)}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "auto"
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => {
                  const activeSubItemPath = getActiveSubItemPath(nav.subItems || []);
                  const isSubItemActive = activeSubItemPath === subItem.path;
                  return (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isSubItemActive
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {translateNavLabel(t, subItem.name)}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isSubItemActive
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isSubItemActive
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                  );
                })}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [manualOpenSubmenu, setManualOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [collapsedActiveSubmenuKey, setCollapsedActiveSubmenuKey] = useState<string | null>(null);

  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(`${path}/`),
    [pathname]
  );

  const getActiveSubItemPath = useCallback(
    (subItems: { path: string }[]) => {
      const matches = subItems
        .map((item) => item.path)
        .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
        .sort((a, b) => b.length - a.length);

      return matches[0] || null;
    },
    [pathname]
  );

  const activeSubmenu: {
    key: string;
    submenu: { type: "main" | "others"; index: number };
    score: number;
  } | null = (() => {
    let best:
      | {
          key: string;
          submenu: { type: "main" | "others"; index: number };
          score: number;
        }
      | null = null;

    for (const [index, nav] of effectiveMainItems.entries()) {
      if (!nav.subItems) continue;

      for (const subItem of nav.subItems) {
        if (!isActive(subItem.path)) continue;

        const score = subItem.path.length;
        if (!best || score > best.score) {
          best = {
            key: `main-${index}`,
            submenu: { type: "main", index },
            score,
          };
        }
      }
    }

    for (const [index, nav] of effectiveOtherItems.entries()) {
      if (!nav.subItems) continue;

      for (const subItem of nav.subItems) {
        if (!isActive(subItem.path)) continue;

        const score = subItem.path.length;
        if (!best || score > best.score) {
          best = {
            key: `others-${index}`,
            submenu: { type: "others", index },
            score,
          };
        }
      }
    }

    return best;
  })();

  const activeSubmenuKey = activeSubmenu?.key ?? null;
  const activeSubmenuState = activeSubmenu?.submenu ?? null;

  let openSubmenu = manualOpenSubmenu;
  if (
    !openSubmenu &&
    activeSubmenuKey &&
    activeSubmenuKey !== collapsedActiveSubmenuKey &&
    activeSubmenuState
  ) {
    openSubmenu = activeSubmenuState;
  }

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    const clickedKey = `${menuType}-${index}`;
    const currentKey = openSubmenu ? `${openSubmenu.type}-${openSubmenu.index}` : null;

    if (currentKey === clickedKey) {
      setManualOpenSubmenu(null);
      if (activeSubmenu?.key === clickedKey) {
        setCollapsedActiveSubmenuKey(clickedKey);
      }
      return;
    }

    setCollapsedActiveSubmenuKey(null);
    setManualOpenSubmenu({ type: menuType, index });
  };

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/admin" aria-label="E2C Admin">
          {isExpanded || isHovered || isMobileOpen ? (
            <E2CAdminBrand subtitle={t("layout.backoffice")} />
          ) : (
            <E2CAdminBrand
              showText={false}
              className="align-middle"
              frameClassName="h-10 w-10 rounded-xl"
              markSize={24}
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  t("layout.menu")
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(effectiveMainItems, "main")}
            </div>

            {effectiveOtherItems.length > 0 ? (
              <div className="">
                <h2
                  className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                    !isExpanded && !isHovered
                      ? "lg:justify-center"
                      : "justify-start"
                  }`}
                >
                  {isExpanded || isHovered || isMobileOpen ? (
                    t("layout.others")
                  ) : (
                    <HorizontaLDots />
                  )}
                </h2>
                {renderMenuItems(effectiveOtherItems, "others")}
              </div>
            ) : null}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;

function translateNavLabel(t: (key: string) => string, label: string) {
  const map: Record<string, string> = {
    Dashboard: "nav.dashboard",
    Ecommerce: "nav.ecommerce",
    Overview: "nav.overview",
    "User management": "nav.userManagement",
    Users: "nav.users",
    "Rules & Permissions": "nav.rulesPermissions",
    "Reading management": "nav.readingManagement",
    Readings: "nav.readings",
    History: "nav.history",
    Consumption: "nav.consumption",
    "Meter management": "nav.meterManagement",
    Meters: "nav.meters",
    "Add meter": "nav.addMeter",
    "Import meters": "nav.importMeters",
    "Tasks management": "nav.tasksManagement",
    Tasks: "nav.tasks",
    "Add task": "nav.addTask",
    Billing: "nav.billing",
    Cities: "nav.cities",
    Zones: "nav.zones",
    Tariffs: "nav.tariffs",
    Campaigns: "nav.campaigns",
    Invoices: "nav.invoices",
    Calendar: "nav.calendar",
    "User Profile": "nav.profile",
    Settings: "nav.settings",
    Forms: "nav.forms",
    "Form Elements": "nav.formElements",
    Tables: "nav.tables",
    "Basic Tables": "nav.basicTables",
    Pages: "nav.pages",
    "Blank Page": "nav.blankPage",
    "404 Error": "nav.error404",
    Charts: "nav.charts",
    "Line Chart": "nav.lineChart",
    "Bar Chart": "nav.barChart",
    "UI Elements": "nav.uiElements",
    Alerts: "nav.alerts",
    Avatar: "nav.avatars",
    Badge: "nav.badge",
    Buttons: "nav.buttons",
    Images: "nav.images",
    Videos: "nav.videos",
    Authentication: "nav.authentication",
    "Sign In": "nav.signIn",
    "Sign Up": "nav.signUp",
  };

  return t(map[label] || label);
}
