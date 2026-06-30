"use client";

import { useState } from "react";
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

interface SidebarLinkProps {
  title: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
}

function SidebarLink({ title, href, icon, className }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  if (!href || href === "#") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-3 mx-2 rounded-lg text-sm text-sidebar-muted cursor-not-allowed",
          className,
        )}
      >
        {icon && <span className="w-[18px] h-[18px] shrink-0">{icon}</span>}
        <span>{title}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 py-2 px-3 mx-2 rounded-lg text-sm text-sidebar-foreground/80 transition-colors duration-150 cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-foreground",
        isActive &&
          "bg-sidebar-accent text-sidebar-foreground font-medium before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-full before:bg-sidebar-ring",
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
      <span className="truncate">{title}</span>
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: menus, isLoading: menusLoading } = useMenuList();
  const { data: authMap, isLoading: authMapLoading } = useAuthorizationMap();
  const { data: company, isLoading: companyLoading } = useCompanySettings();
  const [activeAccordion, setActiveAccordion] = useState<string>("");

  if (menusLoading || companyLoading || authMapLoading) {
    return (
      <div className="min-w-[280px] max-w-[280px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="flex flex-col items-center pt-7 pb-5 gap-2">
          <div className="w-14 h-14 rounded-2xl bg-sidebar-accent animate-pulse" />
          <div className="h-4 w-32 rounded bg-sidebar-accent animate-pulse" />
        </div>
        <div className="mx-4 border-t border-sidebar-border/60 mb-4" />
        <div className="px-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-sidebar-accent/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!menus || !company) {
    return (
      <div className="min-w-[280px] max-w-[280px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col justify-center items-center px-6 text-center">
        <p className="text-sidebar-foreground text-sm font-medium">Couldn&apos;t load the menu</p>
        <p className="text-sidebar-muted text-xs mt-1">Please refresh the page to try again.</p>
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
  const adminMenus = activeMenus
    .filter((m) => m.mnu_id?.substring(0, 1) === "A")
    .sort((a, b) => (a.mnu_ctr || 0) - (b.mnu_ctr || 0));
  const reportMenus = activeMenus
    .filter((m) => m.mnu_id?.substring(0, 1) === "R")
    .sort((a, b) => (a.mnu_ctr || 0) - (b.mnu_ctr || 0));
  const requestMenus = activeMenus
    .filter((m) => m.mnu_id?.substring(0, 1) === "M")
    .sort((a, b) => (a.mnu_ctr || 0) - (b.mnu_ctr || 0));
  const contriMenus = activeMenus
    .filter((m) => m.mnu_id?.substring(0, 1) === "C")
    .sort((a, b) => (a.mnu_ctr || 0) - (b.mnu_ctr || 0));
  const payrollMenus = activeMenus
    .filter((m) => m.mnu_id?.substring(0, 2) === "PR")
    .sort((a, b) => (a.mnu_ctr || 0) - (b.mnu_ctr || 0));

  const getHeaderTitle = (headerId: string) => {
    return headerMenus.find((h) => h.mnu_id === headerId)?.mnu_desc || "";
  };

  return (
    <nav className="min-w-[280px] max-w-[280px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col justify-between relative">
      <div className="overflow-y-auto h-full">
        {/* Company Logo and Name */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="w-11 h-11 rounded-xl bg-sidebar-accent ring-1 ring-sidebar-border overflow-hidden flex items-center justify-center shrink-0">
            <Image
              src="/logos/client-logo.png"
              alt={`${company.com_name || "Company"} logo`}
              width={44}
              height={44}
              className="w-9 h-9 object-contain"
            />
          </div>
          <h1 className="font-semibold text-[15px] leading-tight tracking-tight text-sidebar-foreground truncate">
            {company.com_name || "Company"}
          </h1>
        </div>

        <div className="mx-4 border-t border-sidebar-border/60 mb-3" />

        {/* Menu Items */}
        <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-muted">
          Menu
        </p>
        <div className="pb-2">
          <Accordion
            type="single"
            collapsible
            value={activeAccordion}
            onValueChange={setActiveAccordion}
            className="w-full"
          >
            {/* Dashboard Link */}
            <SidebarLink
              title="Dashboard"
              href="/dashboard"
              icon={<Home className="w-5 h-5" />}
              className="mb-1"
            />

            {/* Requests Accordion */}
            {requestMenus.length > 0 && (
              <AccordionItem value="request" className="border-none">
                <AccordionTrigger className="py-2 px-3 mx-2 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground hover:no-underline data-[state=open]:text-sidebar-foreground [&>svg]:text-sidebar-muted">
                  <div className="flex items-center gap-3 text-sm [&>svg]:text-sidebar-muted">
                    <FileText className="w-5 h-5" />
                    <span>{getHeaderTitle("H3") || "Requests"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                  {requestMenus.map((menu) => {
                    const href = menu.mnu_http || "#";
                    const normalizedHref =
                      href !== "#" && !href.startsWith("/") && !href.startsWith("http")
                        ? `/${href}`
                        : href;
                    return (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={normalizedHref}
                        className="py-2 text-sm pl-8"
                      />
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Payroll Accordion */}
            {payrollMenus.length > 0 && (
              <AccordionItem value="payroll" className="border-none">
                <AccordionTrigger className="py-2 px-3 mx-2 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground hover:no-underline data-[state=open]:text-sidebar-foreground [&>svg]:text-sidebar-muted">
                  <div className="flex items-center gap-3 text-sm [&>svg]:text-sidebar-muted">
                    <DollarSign className="w-5 h-5" />
                    <span>{getHeaderTitle("H5") || "Payroll"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                  {payrollMenus.map((menu) => {
                    const href = menu.mnu_http || "#";
                    const normalizedHref =
                      href !== "#" && !href.startsWith("/") && !href.startsWith("http")
                        ? `/${href}`
                        : href;
                    return (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={normalizedHref}
                        className="py-2 text-sm pl-8"
                      />
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Contributions Accordion */}
            {contriMenus.length > 0 && (
              <AccordionItem value="contributions" className="border-none">
                <AccordionTrigger className="py-2 px-3 mx-2 rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground hover:no-underline data-[state=open]:text-sidebar-foreground [&>svg]:text-sidebar-muted">
                  <div className="flex items-center gap-3 text-sm [&>svg]:text-sidebar-muted">
                    <Building2 className="w-5 h-5" />
                    <span>{getHeaderTitle("H4") || "Contributions"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                  {contriMenus.map((menu) => {
                    const href = menu.mnu_http || "#";
                    const normalizedHref =
                      href !== "#" && !href.startsWith("/") && !href.startsWith("http")
                        ? `/${href}`
                        : href;
                    return (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={normalizedHref}
                        className="py-2 text-sm pl-8"
                      />
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Reports Accordion */}
            {reportMenus.length > 0 &&
              headerMenus.some((h) => h.mnu_id === "H2" && h.mnu_status === 1) && (
                <AccordionItem value="reports" className="border-none">
                  <AccordionTrigger className="py-2 px-4 text-sidebar-foreground hover:bg-sidebar-accent rounded-r-lg hover:no-underline">
                    <div className="flex items-center gap-2 text-sm">
                      <FileBarChart className="w-5 h-5" />
                      <span>{getHeaderTitle("H2") || "Reports"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                    {reportMenus.map((menu) => {
                      const href = menu.mnu_http || "#";
                      const normalizedHref =
                        href !== "#" && !href.startsWith("/") && !href.startsWith("http")
                          ? `/${href}`
                          : href;
                      return (
                        <SidebarLink
                          key={menu.mnu_id}
                          title={menu.mnu_desc || ""}
                          href={normalizedHref}
                          className="py-2 text-sm pl-8"
                        />
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              )}

            {/* Administration Accordion */}
            {adminMenus.length > 0 &&
              headerMenus.some((h) => h.mnu_id === "H1" && h.mnu_status === 1) && (
                <AccordionItem value="admin" className="border-none">
                  <AccordionTrigger className="py-2 px-4 text-sidebar-foreground hover:bg-sidebar-accent rounded-r-lg hover:no-underline">
                    <div className="flex items-center gap-2 text-sm">
                      <Settings className="w-5 h-5" />
                      <span>{getHeaderTitle("H1") || "Administration"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0" onClick={(e) => e.stopPropagation()}>
                    {adminMenus.map((menu) => {
                      const href = menu.mnu_http || "#";
                      const normalizedHref =
                        href !== "#" && !href.startsWith("/") && !href.startsWith("http")
                          ? `/${href}`
                          : href;
                      return (
                        <SidebarLink
                          key={menu.mnu_id}
                          title={menu.mnu_desc || ""}
                          href={normalizedHref}
                          className="py-2 text-sm pl-8"
                        />
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              )}
          </Accordion>
        </div>
      </div>

      {/* Profile Section */}
      <div className="m-3 p-3 rounded-xl bg-sidebar-accent/40 border border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border flex items-center justify-center shrink-0">
            <User className="w-[18px] h-[18px] text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.Firstname} {user?.Lastname}
            </p>
            <p className="text-xs text-sidebar-muted truncate">{user?.name}</p>
          </div>
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-foreground/30" />
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center p-1 rounded hover:bg-sidebar-accent transition-colors outline-none focus:ring-2 focus:ring-sidebar-foreground/30 focus:ring-offset-1 focus:ring-offset-sidebar"
                aria-label="Open menu"
              >
                <ChevronDown className="w-4 h-4 text-sidebar-foreground/70" />
              </button>
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
      </div>
    </nav>
  );
}
