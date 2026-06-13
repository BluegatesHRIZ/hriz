"use client";

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
  const { data: employees } = useEmployees();

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
      <div className="container mt-4 pb-4">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" asChild>
            <Link href="/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Link>
          </Button>
        </div>
        <CardWithHeader
          title="Error"
          icon={<User className="w-6 h-6" />}
          iconColor="#8db7ff"
        >
          <p className="text-red-600">
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
    <div className="container mt-4 mb-2 pb-1">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="outline" asChild>
            <Link href="/employees">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>
        <h2 className="text-2xl font-normal text-[#2972fb] mb-0">
          {isNewEmployee ? "Add New Employee" : "Employee Management"}
        </h2>
        {!isNewEmployee &&
          displayEmployee.Account.EmpLast &&
          displayEmployee.Account.EmpFirst && (
            <h6 className="text-sm text-gray-500 font-normal italic mt-0 mb-0">
              {displayEmployee.Account.EmpId
                ? `(${displayEmployee.Account.EmpId}) ${displayEmployee.Account.EmpLast}, ${displayEmployee.Account.EmpFirst}`
                : `${displayEmployee.Account.EmpLast}, ${displayEmployee.Account.EmpFirst}`}
            </h6>
          )}
      </div>

      {/* Tabs */}
      <div className="bg-white pb-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap bg-transparent border-b rounded-none h-auto p-0">
            <TabsTrigger
              value="account"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Account Information
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Work Schedule
            </TabsTrigger>
            <TabsTrigger
              value="work"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Work Information
            </TabsTrigger>
            <TabsTrigger
              value="benefits"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Benefits & Leave
            </TabsTrigger>
            <TabsTrigger
              value="salary"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Salary History
            </TabsTrigger>
            <TabsTrigger
              value="advances"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Advances & Loans
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Security
            </TabsTrigger>
            <TabsTrigger
              value="medical"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Medical Records
            </TabsTrigger>
            <TabsTrigger
              value="assets"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Assets
            </TabsTrigger>
            <TabsTrigger
              value="movement"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Movement
            </TabsTrigger>
            <TabsTrigger
              value="memos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Memos
            </TabsTrigger>
            <TabsTrigger
              value="trainings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Trainings
            </TabsTrigger>
            <TabsTrigger
              value="requirements"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Requirements
            </TabsTrigger>
            <TabsTrigger
              value="approvals"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#2972fb] data-[state=active]:bg-transparent data-[state=active]:text-[#2972fb]"
            >
              Approval Levels
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6">
            <AccountInformationTab
              employee={displayEmployee}
              departments={departments}
              positions={positions}
              locations={locations}
              isNewEmployee={isNewEmployee}
            />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <WorkScheduleTab employee={displayEmployee} />
          </TabsContent>

          <TabsContent value="work" className="mt-6">
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

          <TabsContent value="benefits" className="mt-6">
            <BenefitsAndLeaveTab
              employee={displayEmployee}
              isNewEmployee={isNewEmployee}
            />
          </TabsContent>

          <TabsContent value="salary" className="mt-6">
            <SalaryHistoryTab
              employee={displayEmployee}
              positions={positions}
            />
          </TabsContent>

          <TabsContent value="advances" className="mt-6">
            <AdvancesAndLoansTab employee={displayEmployee} />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <SecurityTab employee={displayEmployee} />
          </TabsContent>

          <TabsContent value="medical" className="mt-6">
            {!isNewEmployee && <MedicalRecordsTab empId={empId} />}
          </TabsContent>

          <TabsContent value="assets" className="mt-6">
            {!isNewEmployee && <AssetsTab empId={empId} />}
          </TabsContent>

          <TabsContent value="movement" className="mt-6">
            {!isNewEmployee && <MovementTab empId={empId} />}
          </TabsContent>

          <TabsContent value="memos" className="mt-6">
            {!isNewEmployee && <MemosTab empId={empId} />}
          </TabsContent>

          <TabsContent value="trainings" className="mt-6">
            {!isNewEmployee && <TrainingsTab empId={empId} />}
          </TabsContent>

          <TabsContent value="requirements" className="mt-6">
            {!isNewEmployee && <RequirementsTab empId={empId} />}
          </TabsContent>

          <TabsContent value="approvals" className="mt-6">
            {!isNewEmployee && <ApprovalLevelsTab empId={empId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
