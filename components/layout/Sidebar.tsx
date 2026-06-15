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
          "flex items-center gap-2 py-2 px-4 text-sm text-sidebar-foreground/50 cursor-not-allowed",
          className,
        )}
      >
        {icon && <span className="w-5 h-5">{icon}</span>}
        <span>{title}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 py-2 px-4 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors cursor-pointer rounded-r-lg",
        isActive && "bg-sidebar-accent border-l-[3px] border-primary font-medium",
        className,
      )}
      style={{ pointerEvents: "auto" }}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      <span>{title}</span>
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
      <div className="min-w-[300px] max-w-[300px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col justify-center items-center">
        <p className="text-sidebar-foreground/60 text-sm">Loading...</p>
      </div>
    );
  }

  if (!menus || !company) {
    return (
      <div className="min-w-[300px] max-w-[300px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col justify-center items-center">
        <p className="text-sidebar-foreground/60 text-sm">Error loading menu</p>
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
    <div className="min-w-[300px] max-w-[300px] min-h-screen max-h-screen bg-sidebar text-sidebar-foreground flex flex-col justify-between relative">
      <div className="overflow-y-auto h-full">
        {/* Company Logo and Name */}
        <div className="flex flex-col items-center pt-6 pb-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center mb-2">
            <Image
              src="/logos/client-logo.png"
              alt="Company Logo"
              width={64}
              height={64}
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="font-bold text-base text-sidebar-foreground">
            {company.com_name || "Company"}
          </h1>
        </div>

        <div className="mx-4 border-t border-sidebar-border/50 mb-4" />

        {/* Menu Items */}
        <div className="px-2">
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
                <AccordionTrigger className="py-2 px-4 text-sidebar-foreground hover:bg-sidebar-accent rounded-r-lg hover:no-underline">
                  <div className="flex items-center gap-2 text-sm">
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
                <AccordionTrigger className="py-2 px-4 text-sidebar-foreground hover:bg-sidebar-accent rounded-r-lg hover:no-underline">
                  <div className="flex items-center gap-2 text-sm">
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
                <AccordionTrigger className="py-2 px-4 text-sidebar-foreground hover:bg-sidebar-accent rounded-r-lg hover:no-underline">
                  <div className="flex items-center gap-2 text-sm">
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
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-sidebar-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {user?.Firstname} {user?.Lastname}
            </p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{user?.name}</p>
          </div>
          <ThemeToggle />
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
    </div>
  );
}
