"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStoreModal } from "./store-context";
import { logoutAndRedirectToLogin } from "@/lib/client-session";
import {
  DashboardIcon,
  EmployeesIcon,
  AttendanceIcon,
  SettingsIcon,
  InventoryIcon,
  SalaryIcon,
  SalesIcon,
  PnlIcon,
  WithdrawalsIcon,
  StoresIcon,
  UsersIcon,
  ProfileIcon,
  HamburgerIcon,
  ChevronLeftDoubleIcon,
  ChevronRightIcon,
  OutlineCloseIcon,
  SignOutIcon,
  SwitchIcon,
} from "@/app/components/icons";
import type { SidebarProps } from "@/types/app-shell";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: React.ReactNode;
}

interface NavGroup {
  label: string | null;
  icon?: React.ReactNode;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        roles: ["admin", "sub_admin", "franchise_admin", "employee"],
        icon: <DashboardIcon />,
      },
    ],
  },
  {
    label: "Store",
    icon: <SalesIcon />,
    items: [
      {
        label: "Sales",
        href: "/sales",
        roles: ["franchise_admin"],
        icon: <SalesIcon />,
      },
      {
        label: "Inventory",
        href: "/inventory",
        roles: ["franchise_admin"],
        icon: <InventoryIcon />,
      },
      {
        label: "P&L",
        href: "/pnl",
        roles: ["franchise_admin"],
        icon: <PnlIcon />,
      },
      {
        label: "Withdrawals",
        href: "/withdrawals",
        roles: ["franchise_admin"],
        icon: <WithdrawalsIcon />,
      },
    ],
  },
  {
    label: "Staff",
    icon: <EmployeesIcon />,
    items: [
      {
        label: "Employees",
        href: "/employees",
        roles: ["franchise_admin"],
        icon: <EmployeesIcon />,
      },
      {
        label: "Attendance",
        href: "/attendance",
        roles: ["franchise_admin"],
        icon: <AttendanceIcon />,
      },
      {
        label: "Salary",
        href: "/salary",
        roles: ["franchise_admin"],
        icon: <SalaryIcon />,
      },
    ],
  },
  {
    label: null,
    items: [
      {
        label: "Stores",
        href: "/stores",
        roles: ["admin", "sub_admin"],
        icon: <StoresIcon />,
      },
      {
        label: "Users",
        href: "/users",
        roles: ["admin", "sub_admin"],
        icon: <UsersIcon />,
      },
    ],
  },
];

function groupKey(group: NavGroup, index: number) {
  return group.label ?? `group-${index}`;
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.items.some((item) => item.href === pathname);
}

function activeGroupKey(pathname: string) {
  for (const [index, group] of navGroups.entries()) {
    if (group.label && isGroupActive(group, pathname)) return groupKey(group, index);
  }
  return null;
}

function NavLinkItem({
  item,
  collapsed,
  isActive,
  indent,
}: Readonly<{ item: NavItem; collapsed: boolean; isActive: boolean; indent?: boolean }>) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-xl text-sm font-medium transition ${
        collapsed ? "justify-center px-3 py-3" : indent ? "py-2.5 pl-9 pr-3" : "px-3 py-3"
      } ${
        isActive
          ? "border border-brand-teal/15 bg-brand-teal/10 text-brand-teal shadow-sm"
          : "text-gray-600 hover:bg-brand-sand hover:text-brand-orange"
      }`}
    >
      {item.icon}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function NavGroupSection({
  group,
  collapsed,
  pathname,
  userRole,
  open,
  onToggle,
}: Readonly<{
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  userRole: string;
  open: boolean;
  onToggle: () => void;
}>) {
  const visible = group.items.filter((item) => item.roles.includes(userRole));
  if (visible.length === 0) return null;

  if (!group.label) {
    return (
      <div className="space-y-1.5">
        {visible.map((item) => (
          <NavLinkItem key={item.href} item={item} collapsed={collapsed} isActive={pathname === item.href} />
        ))}
      </div>
    );
  }

  // Collapsed sidebar has no room for a clickable label, so just stack the icons flat.
  if (collapsed) {
    return (
      <div className="space-y-1.5">
        {visible.map((item) => (
          <NavLinkItem key={item.href} item={item} collapsed={collapsed} isActive={pathname === item.href} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-600 transition hover:bg-brand-sand hover:text-brand-orange"
      >
        {group.icon}
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRightIcon className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-1.5 pt-1.5">
            {visible.map((item) => (
              <NavLinkItem key={item.href} item={item} collapsed={collapsed} isActive={pathname === item.href} indent />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function useExpandedGroups(pathname: string) {
  const [manualOpen, setManualOpen] = useState<{ pathname: string; key: string | null } | null>(null);
  const openKey = manualOpen?.pathname === pathname ? manualOpen.key : activeGroupKey(pathname);

  function toggle(key: string) {
    setManualOpen({ pathname, key: openKey === key ? null : key });
  }

  return { expanded: openKey, toggle };
}

function NavList({
  collapsed,
  pathname,
  userRole,
}: Readonly<{
  collapsed: boolean;
  pathname: string;
  userRole: string;
}>) {
  const { expanded, toggle } = useExpandedGroups(pathname);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
      {navGroups.map((group, groupIndex) => {
        const key = groupKey(group, groupIndex);
        return (
          <NavGroupSection
            key={key}
            group={group}
            collapsed={collapsed}
            pathname={pathname}
            userRole={userRole}
            open={expanded === key}
            onToggle={() => toggle(key)}
          />
        );
      })}
    </nav>
  );
}

function MobileNavList({
  pathname,
  userRole,
}: Readonly<{ pathname: string; userRole: string }>) {
  const { expanded, toggle } = useExpandedGroups(pathname);
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
      {navGroups.map((group, groupIndex) => {
        const key = groupKey(group, groupIndex);
        return (
          <NavGroupSection
            key={key}
            group={group}
            collapsed={false}
            pathname={pathname}
            userRole={userRole}
            open={expanded === key}
            onToggle={() => toggle(key)}
          />
        );
      })}
    </nav>
  );
}

function ProfileLink({
  collapsed = false,
  pathname,
}: Readonly<{ collapsed?: boolean; pathname: string }>) {
  const isActive = pathname === "/profile";
  return (
    <Link
      href="/profile"
      title={collapsed ? "Profile" : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition ${
        collapsed ? "justify-center" : ""
      } ${
        isActive
          ? "border border-brand-teal/15 bg-brand-teal/10 text-brand-teal shadow-sm"
          : "text-gray-500 hover:bg-brand-sand hover:text-brand-orange"
      }`}
    >
      <ProfileIcon />
      {!collapsed && <span>Profile</span>}
    </Link>
  );
}

function StoreConfigLink({
  collapsed = false,
  pathname,
}: Readonly<{ collapsed?: boolean; pathname: string }>) {
  const isActive = pathname === "/store-config";
  return (
    <Link
      href="/store-config"
      title={collapsed ? "Store Config" : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition ${
        collapsed ? "justify-center" : ""
      } ${
        isActive
          ? "border border-brand-teal/15 bg-brand-teal/10 text-brand-teal shadow-sm"
          : "text-gray-500 hover:bg-brand-sand hover:text-brand-orange"
      }`}
    >
      <SettingsIcon />
      {!collapsed && <span>Store Config</span>}
    </Link>
  );
}

function FranchiseBadge({
  franchiseName,
  small,
  onSwitch,
}: Readonly<{
  franchiseName?: string;
  small?: boolean;
  onSwitch: () => void;
}>) {
  if (!franchiseName) return null;
  return (
    <button
      type="button"
      onClick={onSwitch}
      title="Switch store"
      aria-label={`Switch store. Active store: ${franchiseName}`}
      className={`group mx-3 mb-3 block w-[calc(100%-1.5rem)] cursor-pointer rounded-2xl border border-brand-beige bg-brand-sand/70 px-4 py-3 text-left shadow-sm transition hover:border-brand-orange hover:bg-brand-peach ${
        small ? "mx-1" : ""
      }`}
    >
      {!small && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">
            Active Store
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-brand-orange">
              {franchiseName}
            </p>
            <span className="relative shrink-0">
              <SwitchIcon className="h-4 w-4 text-gray-500" />
              <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] group-hover:block group-focus-visible:block">
                Switch store
              </span>
            </span>
          </div>
        </div>
      )}
      {small && <SwitchIcon className="mx-auto h-4 w-4 text-gray-500" />}
    </button>
  );
}

export default function Sidebar({
  franchiseName,
  userRole,
  userName,
  storeCount = 0,
}: Readonly<SidebarProps>) {
  const pathname = usePathname();
  const router = useRouter();
  const { openStoreModal } = useStoreModal();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const needsStore = userRole !== "admin" && userRole !== "sub_admin";
  // Hide switch button when user only has access to exactly one store
  const showSwitchStore = needsStore && storeCount !== 1;

  useEffect(() => {
    queueMicrotask(() => {
      setMobileOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    const returnTo = `${pathname}${globalThis.location.search}`;
    await logoutAndRedirectToLogin(router, returnTo);
  }

  function handleSwitchStore() {
    openStoreModal();
  }

  return (
    <>
      {/* ── Mobile: fixed top bar ─────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-brand-sand flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 rounded-lg text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition"
        >
          <HamburgerIcon />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center min-w-0">
            <span className="text-base font-bold text-brand-orange">Polar Bear</span>
            {franchiseName && (
              <span className="ml-2 text-xs text-gray-500 truncate hidden sm:inline">
                — {franchiseName}
              </span>
            )}
          </div>
          {userName && (
            <p className="text-[11px] text-gray-500 truncate">{userName}</p>
          )}
        </div>
      </div>

      {/* ── Mobile: backdrop overlay ──────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile: sliding drawer ────────────────────────────── */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-brand-beige flex flex-col h-screen transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-sand h-14 px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-[10px] font-black text-white">PB</span>
            <span className="text-sm font-semibold text-gray-800">Polar Bear</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition"
          >
            <OutlineCloseIcon />
          </button>
        </div>
        <MobileNavList pathname={pathname} userRole={userRole} />
        <div className="shrink-0">
          <div className="border-t border-brand-sand px-2 py-2">
            <ProfileLink pathname={pathname} />
            {userRole === "franchise_admin" && <StoreConfigLink pathname={pathname} />}
          </div>
          {showSwitchStore && (
            <FranchiseBadge
              franchiseName={franchiseName}
              onSwitch={handleSwitchStore}
            />
          )}
          <div className="px-2 py-3 border-t border-brand-sand">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition"
            >
              <SignOutIcon />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Desktop: sticky sidebar ───────────────────────────── */}
      <aside
        className={`hidden md:flex ${
          collapsed ? "w-16" : "w-60"
        } shrink-0 sticky top-0 h-screen bg-white/95 border-r border-brand-beige shadow-[8px_0_30px_rgba(36,50,58,0.04)] flex-col transition-all duration-200`}
      >
        <div
          className={`flex items-center border-b border-brand-sand h-14 px-3 shrink-0 ${
            collapsed ? "justify-center" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-[10px] font-black text-white">PB</span>
                <span className="block text-sm font-semibold text-gray-800 truncate">Polar Bear</span>
              </div>
              {userName && (
                <span className="block text-[11px] text-gray-500 truncate">
                  {userName}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition"
          >
            {collapsed ? <HamburgerIcon /> : <ChevronLeftDoubleIcon />}
          </button>
        </div>

        <NavList
          collapsed={collapsed}
          pathname={pathname}
          userRole={userRole}
        />

        {/* Franchise section + sign out */}
        <div className="shrink-0">
          <div className="border-t border-brand-sand px-2 py-2">
            <ProfileLink collapsed={collapsed} pathname={pathname} />
            {userRole === "franchise_admin" && (
              <StoreConfigLink collapsed={collapsed} pathname={pathname} />
            )}
          </div>
          {collapsed ? (
            <div className="px-1 pb-1 border-t border-brand-sand pt-2">
              {showSwitchStore && (
                <button
                  onClick={handleSwitchStore}
                  title={
                    franchiseName
                      ? `Switch store (${franchiseName})`
                      : "Select store"
                  }
                  className="flex w-full justify-center items-center py-2.5 rounded-lg text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition"
                >
                  <SwitchIcon />
                </button>
              )}
            </div>
          ) : (
            showSwitchStore && (
              <FranchiseBadge
                franchiseName={franchiseName}
                onSwitch={handleSwitchStore}
              />
            )
          )}
          <div className={`px-2 py-3 border-t border-brand-sand`}>
            <button
              onClick={handleSignOut}
              title={collapsed ? "Sign out" : undefined}
              className={`flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-brand-sand hover:text-brand-orange transition ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <SignOutIcon />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
