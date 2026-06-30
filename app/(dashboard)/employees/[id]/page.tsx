"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import {
  useEmployeeDetail,
  useDepartments,
  usePositions,
  useLocations,
  EMPTY_EMPLOYEE_DETAIL,
  type EmployeeDetail,
} from "@/lib/hooks/useEmployeeDetail";
import { useEmployees, type Employee } from "@/lib/hooks/useEmployees";
import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AccountInformationTab } from "@/components/employee/AccountInformationTab";
import { WorkScheduleTab } from "@/components/employee/WorkScheduleTab";
import { WorkInformationTab } from "@/components/employee/WorkInformationTab";
import { BenefitsAndLeaveTab } from "@/components/employee/BenefitsAndLeaveTab";
import { SalaryHistoryTab } from "@/components/employee/SalaryHistoryTab";
import { AdvancesAndLoansTab } from "@/components/employee/AdvancesAndLoansTab";
import { SecurityTab } from "@/components/employee/SecurityTab";
import { MedicalRecordsTab } from "@/components/employee/MedicalRecordsTab";
import { AssetsTab } from "@/components/employee/AssetsTab";
import { MovementTab } from "@/components/employee/MovementTab";
import { MemosTab } from "@/components/employee/MemosTab";
import { TrainingsTab } from "@/components/employee/TrainingsTab";
import { RequirementsTab } from "@/components/employee/RequirementsTab";
import { ApprovalLevelsTab } from "@/components/employee/ApprovalLevelsTab";

const TABS = [
  { value: "account", label: "Account Information" },
  { value: "schedule", label: "Work Schedule" },
  { value: "work", label: "Work Information" },
  { value: "benefits", label: "Benefits & Leave" },
  { value: "salary", label: "Salary History" },
  { value: "advances", label: "Advances & Loans" },
  { value: "security", label: "Security" },
  { value: "medical", label: "Medical Records" },
  { value: "assets", label: "Assets" },
  { value: "movement", label: "Movement" },
  { value: "memos", label: "Memos" },
  { value: "trainings", label: "Trainings" },
  { value: "requirements", label: "Requirements" },
  { value: "approvals", label: "Approval Levels" },
];

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const empId = params.id as string;

  const isNewEmployee = empId === "new";
  const {
    data: employee,
    isLoading,
    error,
  } = useEmployeeDetail(empId, !isNewEmployee);
  const { data: departments } = useDepartments();
  const { data: positions } = usePositions();
  const { data: locations } = useLocations();
  // Fetch a large page to populate the employee dropdown (server-side paginated).
  const { data: employeesPage } = useEmployees(1, 100);
  const employees = employeesPage?.data;

  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || (!isNewEmployee && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isNewEmployee && (error || !employee)) {
    return (
      <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-1 text-muted-foreground hover:text-foreground">
          <Link href="/employees">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Employee Management
          </Link>
        </Button>
        <CardWithHeader
          title="Error"
          icon={<User className="w-6 h-6" />}
          iconColor="#8db7ff"
        >
          <p className="text-destructive">
            {error ? "Failed to load employee details" : "Employee not found"}
          </p>
        </CardWithHeader>
      </div>
    );
  }

  const displayEmployee: EmployeeDetail = isNewEmployee
    ? EMPTY_EMPLOYEE_DETAIL
    : employee!;

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8">
      {/* Header */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-3 -ml-1 text-muted-foreground hover:text-foreground"
        >
          <Link href="/employees">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Employee Management
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground leading-tight">
          {isNewEmployee
            ? "Add New Employee"
            : displayEmployee.Account.EmpLast
            ? `${displayEmployee.Account.EmpLast}, ${displayEmployee.Account.EmpFirst}`
            : "Employee Detail"}
        </h1>
        {!isNewEmployee && displayEmployee.Account.EmpId && (
          <p className="text-sm text-muted-foreground mt-1">
            Employee ID: {displayEmployee.Account.EmpId}
          </p>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Underline tab bar — scrolls horizontally for many tabs */}
        <div className="overflow-x-auto mb-4">
          <TabsList className="flex w-max min-w-full bg-transparent h-auto p-0 rounded-none items-end gap-0 border-b-2 border-border">
            {TABS.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent mb-[-2px] pb-3 pt-2 px-4 text-sm font-normal whitespace-nowrap text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:bg-transparent data-[state=active]:shadow-none transition-colors"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="account" className="mt-0">
          <AccountInformationTab
            employee={displayEmployee}
            departments={departments}
            positions={positions}
            locations={locations}
            isNewEmployee={isNewEmployee}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-0">
          <WorkScheduleTab employee={displayEmployee} />
        </TabsContent>

        <TabsContent value="work" className="mt-0">
          <WorkInformationTab
            employee={displayEmployee}
            employeeList={employees?.map((emp: Employee) => ({
              EmpId: emp.emp_id,
              TextName: `${emp.emp_last || ""}, ${emp.emp_first || ""} ${
                emp.emp_mid || ""
              }`.trim(),
            }))}
          />
        </TabsContent>

        <TabsContent value="benefits" className="mt-0">
          <BenefitsAndLeaveTab
            employee={displayEmployee}
            isNewEmployee={isNewEmployee}
          />
        </TabsContent>

        <TabsContent value="salary" className="mt-0">
          <SalaryHistoryTab
            employee={displayEmployee}
            positions={positions}
          />
        </TabsContent>

        <TabsContent value="advances" className="mt-0">
          <AdvancesAndLoansTab employee={displayEmployee} />
        </TabsContent>

        <TabsContent value="security" className="mt-0">
          <SecurityTab employee={displayEmployee} />
        </TabsContent>

        <TabsContent value="medical" className="mt-0">
          {!isNewEmployee && <MedicalRecordsTab empId={empId} />}
        </TabsContent>

        <TabsContent value="assets" className="mt-0">
          {!isNewEmployee && <AssetsTab empId={empId} />}
        </TabsContent>

        <TabsContent value="movement" className="mt-0">
          {!isNewEmployee && <MovementTab empId={empId} />}
        </TabsContent>

        <TabsContent value="memos" className="mt-0">
          {!isNewEmployee && <MemosTab empId={empId} />}
        </TabsContent>

        <TabsContent value="trainings" className="mt-0">
          {!isNewEmployee && <TrainingsTab empId={empId} />}
        </TabsContent>

        <TabsContent value="requirements" className="mt-0">
          {!isNewEmployee && <RequirementsTab empId={empId} />}
        </TabsContent>

        <TabsContent value="approvals" className="mt-0">
          {!isNewEmployee && <ApprovalLevelsTab empId={empId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
