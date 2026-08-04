"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useMenuList } from "@/lib/hooks/useMenu";
import { useAuthorizationMap } from "@/lib/hooks/useAuthorization";
import { useCompanySettings } from "@/lib/hooks/useSettings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Home,
  FileText,
  DollarSign,
  Building2,
  FileBarChart,
  Settings,
  User,
  ChevronDown,
  ChevronLeft,
  LogOut,
  KeyRound,
  Receipt,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { hasAnyPermission, parsePermissionMask } from "@/lib/auth/permissions";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

const normalizeHref = (href?: string | null) => {
  const h = href || "#";
  return h !== "#" && !h.startsWith("/") && !h.startsWith("http") ? `/${h}` : h;
};

interface SidebarLinkProps {
  title: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
  collapsed?: boolean;
}

function SidebarLink({ title, href, icon, className, collapsed }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  if (!href || href === "#") {
    return (
      <div
        title={collapsed ? title : undefined}
        className={cn(
          "flex items-center gap-3 py-2 px-3 mx-2 rounded-lg text-sm text-sidebar-muted cursor-not-allowed",
          collapsed && "w-10 h-10 mx-auto justify-center gap-0 p-0",
          className,
        )}
      >
        {icon && <span className="w-[18px] h-[18px] shrink-0">{icon}</span>}
        {!collapsed && <span>{title}</span>}
      </div>
    );
  }

  return (
    <Link
      href={href}
      title={collapsed ? title : undefined}
      className={cn(
        "group relative flex items-center gap-3 py-2 px-3 mx-2 rounded-lg text-sm text-sidebar-foreground/80 transition-colors duration-150 cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed && "w-10 h-10 mx-auto justify-center gap-0 p-0",
        isActive &&
          (collapsed
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "bg-sidebar-accent text-sidebar-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-sidebar-ring"),
        className,
      )}
      style={{ pointerEvents: "auto" }}
    >
      {icon && (
        <span
          className={cn(
            "w-[18px] h-[18px] shrink-0 transition-colors",
            isActive ? "text-sidebar-ring" : "text-sidebar-muted group-hover:text-sidebar-foreground",
          )}
        >
          {icon}
        </span>
      )}
      {!collapsed && <span className="truncate">{title}</span>}
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: menus, isLoading: menusLoading } = useMenuList();
  const { data: authMap, isLoading: authMapLoading } = useAuthorizationMap();
  const { data: company, isLoading: companyLoading } = useCompanySettings();
  const [activeAccordion, setActiveAccordion] = useState<string>("");
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true") {
      setCollapsedState(true);
    }
  }, []);

  const setCollapsed = (next: boolean) => {
    setCollapsedState(next);
    localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
  };

  const widthClass = collapsed ? "w-[76px]" : "w-[280px]";
  const shellClass = cn(
    widthClass,
    "shrink-0 min-h-screen max-h-screen bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
  );

  if (menusLoading || companyLoading || authMapLoading) {
    return (
      <div className={cn(shellClass, "flex flex-col")}>
        <div className="flex flex-col items-center pt-7 pb-5 gap-2">
          <div className="w-14 h-14 rounded-2xl bg-sidebar-accent animate-pulse" />
          {!collapsed && <div className="h-4 w-32 rounded bg-sidebar-accent animate-pulse" />}
        </div>
        <div className="mx-4 border-t border-sidebar-border/60 mb-4" />
        <div className={cn("space-y-2", collapsed ? "px-3" : "px-4")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-sidebar-accent/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!menus || !company) {
    return (
      <div className={cn(shellClass, "flex flex-col justify-center items-center px-4 text-center")}>
        <p className="text-sidebar-foreground text-sm font-medium">Couldn&apos;t load the menu</p>
        {!collapsed && (
          <p className="text-sidebar-muted text-xs mt-1">Please refresh the page to try again.</p>
        )}
      </div>
    );
  }

  const userMask = parsePermissionMask(user?.permissions ?? "0");
  const activeMenus = menus
    .filter((m) => m.mnu_status === 1)
    .filter((m) => {
      if (!m.mnu_id) return true;
      const requiredMask = parsePermissionMask(authMap?.menuPermissions?.[m.mnu_id] ?? "0");
      return hasAnyPermission(userMask, requiredMask);
    });
  const headerMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 1) === "H");
  const byCounter = (a: { mnu_ctr?: number | null }, b: { mnu_ctr?: number | null }) =>
    (a.mnu_ctr || 0) - (b.mnu_ctr || 0);
  const adminMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 1) === "A").sort(byCounter);
  const reportMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 1) === "R").sort(byCounter);
  const requestMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 1) === "M").sort(byCounter);
  const contriMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 1) === "C").sort(byCounter);
  const payrollMenus = activeMenus.filter((m) => m.mnu_id?.substring(0, 2) === "PR").sort(byCounter);

  const getHeaderTitle = (headerId: string) => {
    return headerMenus.find((h) => h.mnu_id === headerId)?.mnu_desc || "";
  };

  const headerEnabled = (headerId: string) =>
    headerMenus.some((h) => h.mnu_id === headerId && h.mnu_status === 1);

  const groups = [
    {
      value: "request",
      icon: FileText,
      label: getHeaderTitle("H3") || "Requests",
      menus: requestMenus,
      show: requestMenus.length > 0,
    },
    {
      value: "payroll",
      icon: DollarSign,
      label: getHeaderTitle("H5") || "Payroll",
      menus: payrollMenus,
      show: payrollMenus.length > 0,
    },
    {
      value: "contributions",
      icon: Building2,
      label: getHeaderTitle("H4") || "Contributions",
      menus: contriMenus,
      show: contriMenus.length > 0,
    },
    {
      value: "reports",
      icon: FileBarChart,
      label: getHeaderTitle("H2") || "Reports",
      menus: reportMenus,
      show: reportMenus.length > 0 && headerEnabled("H2"),
    },
    {
      value: "admin",
      icon: Settings,
      label: getHeaderTitle("H1") || "Administration",
      menus: adminMenus,
      show: adminMenus.length > 0 && headerEnabled("H1"),
    },
  ].filter((g) => g.show);

  return (
    <nav className={cn(shellClass, "flex flex-col justify-between relative")}>
      <div className="overflow-y-auto h-full">
        {/* Company Logo and Name */}
        <div
          className={cn(
            "flex items-center pt-6 pb-5",
            collapsed ? "flex-col gap-3 px-2" : "gap-3 px-5",
          )}
        >
          <div className="w-11 h-11 rounded-xl bg-sidebar-accent ring-1 ring-sidebar-border overflow-hidden flex items-center justify-center shrink-0">
            <Image
              src="/logos/client-logo.png"
              alt={`${company.com_name || "Company"} logo`}
              width={44}
              height={44}
              className="w-9 h-9 object-contain"
            />
          </div>
          {!collapsed && (
            <h1 className="flex-1 min-w-0 font-semibold text-[15px] leading-tight tracking-tight text-sidebar-foreground truncate">
              {company.com_name || "Company"}
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors shrink-0",
              !collapsed && "ml-auto",
            )}
          >
            <ChevronLeft
              className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")}
            />
          </button>
        </div>

        <div className="mx-4 border-t border-sidebar-border/60 mb-3" />

        {/* Menu Items */}
        {!collapsed && (
          <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-muted">
            Menu
          </p>
        )}
        <div className="pb-2">
          <Accordion
            type="single"
            collapsible
            value={collapsed ? "" : activeAccordion}
            onValueChange={setActiveAccordion}
            className="w-full"
          >
            {/* Dashboard Link */}
            <SidebarLink
              title="Dashboard"
              href="/dashboard"
              icon={<Home className="w-5 h-5" />}
              className="mb-1"
              collapsed={collapsed}
            />

            {groups.map((group) => {
              const Icon = group.icon;

              if (collapsed) {
                return (
                  <button
                    key={group.value}
                    onClick={() => {
                      setActiveAccordion(group.value);
                      setCollapsed(false);
                    }}
                    title={group.label}
                    aria-label={group.label}
                    className="group flex w-10 h-10 mx-auto my-0.5 items-center justify-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <Icon className="w-[18px] h-[18px] text-sidebar-muted group-hover:text-sidebar-foreground" />
                  </button>
                );
              }

              return (
                <AccordionItem key={group.value} value={group.value} className="border-none">
                  <AccordionTrigger className="py-2 px-3 mx-2 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground hover:no-underline data-[state=open]:text-sidebar-foreground [&>svg]:text-sidebar-muted">
                    <div className="flex items-center gap-3 text-sm">
                      <Icon className="w-5 h-5 text-sidebar-muted" />
                      <span>{group.label}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                    {group.menus.map((menu) => (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={normalizeHref(menu.mnu_http)}
                        className="py-2 text-sm pl-8"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>

      {/* Profile Section */}
      <div className="border-t border-sidebar-border/60 mx-3 mt-2" />
      <div
        className={cn(
          collapsed
            ? "flex flex-col items-center gap-1 py-3"
            : "m-3 p-3 rounded-xl bg-sidebar-accent/40 border border-sidebar-border flex items-center gap-3",
        )}
      >
        {!collapsed && (
          <>
            <div className="w-9 h-9 rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border flex items-center justify-center shrink-0">
              <User className="w-[18px] h-[18px] text-sidebar-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.Firstname} {user?.Lastname}
              </p>
              <p className="text-xs text-sidebar-muted truncate">{user?.name}</p>
            </div>
          </>
        )}
        <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-foreground/30" />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {collapsed ? (
              <button
                className="flex w-10 h-10 items-center justify-center rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors outline-none focus:ring-2 focus:ring-sidebar-foreground/30"
                aria-label="Open profile menu"
                title={`${user?.Firstname ?? ""} ${user?.Lastname ?? ""}`.trim()}
              >
                <User className="w-[18px] h-[18px]" />
              </button>
            ) : (
              <button
                className="flex items-center justify-center p-1 rounded hover:bg-sidebar-accent transition-colors outline-none focus:ring-2 focus:ring-sidebar-foreground/30 focus:ring-offset-1 focus:ring-offset-sidebar"
                aria-label="Open menu"
              >
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/70" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/change-password" className="flex items-center gap-2 cursor-pointer">
                  <KeyRound className="w-4 h-4" />
                  Change Password
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/payslip" className="flex items-center gap-2 cursor-pointer">
                  <Receipt className="w-4 h-4" />
                  Payslip
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  logout();
                }}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </nav>
  );
}
