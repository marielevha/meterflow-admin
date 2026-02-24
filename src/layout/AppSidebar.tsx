"use client";
import React, { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
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
import SidebarWidget from "./SidebarWidget";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Ecommerce", path: "/admin", pro: false },
      { name: "Overview", path: "/admin/overview", pro: false },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "User management",
    subItems: [
      { name: "Users", path: "/admin/users", pro: false },
      { name: "Rules & Permissions", path: "/admin/rules-permissions", pro: false },
    ],
  },
  {
    icon: <ListIcon />,
    name: "Operations",
    subItems: [
      { name: "Meters", path: "/admin/meters", pro: false },
      { name: "Add meter", path: "/admin/meters/create", pro: false },
      { name: "Readings", path: "/admin/readings", pro: false },
      { name: "History", path: "/admin/history", pro: false },
      { name: "Consumption", path: "/admin/consumption", pro: false },
    ],
  },
  {
    icon: <TaskIcon />,
    name: "Tasks management",
    subItems: [
      { name: "Tasks", path: "/admin/tasks", pro: false },
      { name: "Add task", path: "/admin/tasks/create", pro: false },
    ],
  },
  {
    icon: <PieChartIcon />,
    name: "Billing",
    subItems: [
      { name: "Overview", path: "/admin/billing", pro: false },
      { name: "Tariffs", path: "/admin/billing/tariffs", pro: false },
      { name: "Campaigns", path: "/admin/billing/campaigns", pro: false },
      { name: "Invoices", path: "/admin/billing/invoices", pro: false },
    ],
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/admin/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/admin/profile",
  },
  {
    icon: <PlugInIcon />,
    name: "Settings",
    path: "/admin/settings",
  },

  {
    name: "Forms",
    icon: <ListIcon />,
    subItems: [{ name: "Form Elements", path: "/admin/form-elements", pro: false }],
  },
  {
    name: "Tables",
    icon: <TableIcon />,
    subItems: [{ name: "Basic Tables", path: "/admin/basic-tables", pro: false }],
  },
  {
    name: "Pages",
    icon: <PageIcon />,
    subItems: [
      { name: "Blank Page", path: "/admin/blank", pro: false },
      { name: "404 Error", path: "/error-404", pro: false },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/admin/line-chart", pro: false },
      { name: "Bar Chart", path: "/admin/bar-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/admin/alerts", pro: false },
      { name: "Avatar", path: "/admin/avatars", pro: false },
      { name: "Badge", path: "/admin/badge", pro: false },
      { name: "Buttons", path: "/admin/buttons", pro: false },
      { name: "Images", path: "/admin/images", pro: false },
      { name: "Videos", path: "/admin/videos", pro: false },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => (
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
                <span className={`menu-item-text`}>{nav.name}</span>
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
                      {subItem.name}
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

    const inspect = (items: NavItem[], type: "main" | "others") => {
      items.forEach((nav, index) => {
        if (!nav.subItems) return;
        nav.subItems.forEach((subItem) => {
          if (!isActive(subItem.path)) return;
          const score = subItem.path.length;
          if (!best || score > best.score) {
            best = {
              key: `${type}-${index}`,
              submenu: { type, index },
              score,
            };
          }
        });
      });
    };

    inspect(navItems, "main");
    inspect(othersItems, "others");
    return best;
  })();

  const openSubmenu =
    manualOpenSubmenu ||
    (activeSubmenu && activeSubmenu.key !== collapsedActiveSubmenuKey
      ? activeSubmenu.submenu
      : null);

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
        <Link href="/admin">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/logo.svg"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/logo-dark.svg"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
            <Image
              src="/images/logo/logo-icon.svg"
              alt="Logo"
              width={32}
              height={32}
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
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>

            <div className="">
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Others"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(othersItems, "others")}
            </div>
          </div>
        </nav>
        {isExpanded || isHovered || isMobileOpen ? <SidebarWidget /> : null}
      </div>
    </aside>
  );
};

export default AppSidebar;
