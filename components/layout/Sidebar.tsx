"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useMenuList } from "@/lib/hooks/useMenu";
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
  Bell,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  title: string;
  href: string;
  icon?: React.ReactNode;
  className?: string;
}

function SidebarLink({ title, href, icon, className }: SidebarLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 py-2 px-4 text-sm hover:bg-[#002750] transition-colors",
        isActive && "bg-[#002750] border-l-4 border-white",
        className,
      )}
    >
      {icon && <span className="w-6 h-6">{icon}</span>}
      <span>{title}</span>
    </Link>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const { data: menus, isLoading: menusLoading } = useMenuList();
  const { data: company, isLoading: companyLoading } = useCompanySettings();
  const [activeAccordion, setActiveAccordion] = useState<string>("");

  if (menusLoading || companyLoading) {
    return (
      <div className="min-w-[350px] max-w-[350px] min-h-screen max-h-screen bg-bgc-dark-blue text-white flex flex-col justify-center items-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!menus || !company) {
    return (
      <div className="min-w-[350px] max-w-[350px] min-h-screen max-h-screen bg-bgc-dark-blue text-white flex flex-col justify-center items-center">
        <p>Error loading menu</p>
      </div>
    );
  }

  // Organize menus by category
  const activeMenus = menus.filter((m) => m.mnu_status === 1);
  const headerMenus = activeMenus.filter(
    (m) => m.mnu_id?.substring(0, 1) === "H",
  );
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
    <div className="min-w-[350px] max-w-[350px] min-h-screen max-h-screen bg-bgc-dark-blue text-white flex flex-col justify-between relative">
      <div className="overflow-y-auto h-full">
        {/* Company Logo and Name */}
        <div className="flex flex-col items-center pt-3">
          <Image
            src="/logos/client-logo.png"
            alt="Company Logo"
            width={88}
            height={86}
            className="w-[88px] h-[86px]"
          />
          <h1 className="font-bold text-lg mt-2">
            {company.com_name || "Company"}
          </h1>
        </div>

        {/* Menu Items */}
        <div className="mt-[50px] overflow-y-auto min-h-full px-2">
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
              icon={<Home className="w-6 h-6" />}
              className="mb-2"
            />

            {/* Requests Accordion */}
            {requestMenus.length > 0 && (
              <AccordionItem value="request" className="border-none">
                <AccordionTrigger className="py-2 px-4 hover:bg-[#002750]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    <span>{getHeaderTitle("H3") || "Requests"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  {requestMenus.map((menu) => (
                    <SidebarLink
                      key={menu.mnu_id}
                      title={menu.mnu_desc || ""}
                      href={menu.mnu_http || "#"}
                      className="py-[10px] text-sm pl-8"
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Payroll Accordion */}
            {payrollMenus.length > 0 && (
              <AccordionItem value="payroll" className="border-none">
                <AccordionTrigger className="py-2 px-4 hover:bg-[#002750]">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-6 h-6" />
                    <span>{getHeaderTitle("H5") || "Payroll"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  {payrollMenus.map((menu) => (
                    <SidebarLink
                      key={menu.mnu_id}
                      title={menu.mnu_desc || ""}
                      href={menu.mnu_http || "#"}
                      className="py-[10px] text-sm pl-8"
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Contributions Accordion */}
            {contriMenus.length > 0 && (
              <AccordionItem value="contributions" className="border-none">
                <AccordionTrigger className="py-2 px-4 hover:bg-[#002750]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    <span>{getHeaderTitle("H4") || "Contributions"}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  {contriMenus.map((menu) => (
                    <SidebarLink
                      key={menu.mnu_id}
                      title={menu.mnu_desc || ""}
                      href={menu.mnu_http || "#"}
                      className="py-[10px] text-sm pl-8"
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Reports Accordion */}
            {reportMenus.length > 0 &&
              headerMenus.some(
                (h) => h.mnu_id === "H2" && h.mnu_status === 1,
              ) && (
                <AccordionItem value="reports" className="border-none">
                  <AccordionTrigger className="py-2 px-4 hover:bg-[#002750]">
                    <div className="flex items-center gap-2">
                      <FileBarChart className="w-6 h-6" />
                      <span>{getHeaderTitle("H2") || "Reports"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    {reportMenus.map((menu) => (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={menu.mnu_http || "#"}
                        className="py-[10px] text-sm pl-8"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}

            {/* Administration Accordion */}
            {adminMenus.length > 0 &&
              headerMenus.some(
                (h) => h.mnu_id === "H1" && h.mnu_status === 1,
              ) && (
                <AccordionItem value="admin" className="border-none">
                  <AccordionTrigger className="py-2 px-4 hover:bg-[#002750]">
                    <div className="flex items-center gap-2">
                      <Settings className="w-6 h-6" />
                      <span>{getHeaderTitle("H1") || "Administration"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    {adminMenus.map((menu) => (
                      <SidebarLink
                        key={menu.mnu_id}
                        title={menu.mnu_desc || ""}
                        href={menu.mnu_http || "#"}
                        className="py-[10px] text-sm pl-8"
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              )}
          </Accordion>
        </div>
      </div>

      {/* Profile Section */}
      <div className="items-end p-4 border-t border-[#002750]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bgc-blue-gray flex items-center justify-center">
            <User className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {user?.Firstname} {user?.Lastname}
            </p>
            <p className="text-xs text-gray-400">{user?.name}</p>
          </div>
          <button className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>
    </div>
  );
}
