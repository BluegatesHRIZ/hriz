"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { EmployeeDetail } from "@/lib/hooks/useEmployeeDetail";

interface Props {
  data: EmployeeDetail;
}

function fmt(val: Date | string | null | undefined): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function num(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-12 py-2 border-b last:border-0">
      <dt className="col-span-4 text-sm text-muted-foreground font-medium">{label}</dt>
      <dd className="col-span-8 text-sm">{value ?? "—"}</dd>
    </div>
  );
}

export function ProfileTabs({ data }: Props) {
  const { Account, Personal, EmpWrk, EmpLeave, EmpSalary, EmpAdvance } = data;

  const fullName = [Account.EmpFirst, Account.EmpMid, Account.EmpLast]
    .filter(Boolean)
    .join(" ");

  const EMP_TYPE: Record<number, string> = { 0: "Regular", 1: "Probationary", 2: "Contractual", 3: "Part-time" };

  return (
    <Tabs defaultValue="account">
      <TabsList className="mb-4 flex-wrap h-auto gap-1">
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="work">Work</TabsTrigger>
        <TabsTrigger value="benefits">Benefits & Leave</TabsTrigger>
        <TabsTrigger value="salary">Salary History</TabsTrigger>
        <TabsTrigger value="advances">Advances & Loans</TabsTrigger>
      </TabsList>

      {/* ── Account tab ─────────────────────────────────────────── */}
      <TabsContent value="account">
        <Card>
          <CardContent className="pt-6">
            <dl>
              <Row label="Employee ID" value={Account.EmpId} />
              <Row label="Full Name" value={fullName || "—"} />
              <Row label="Department" value={Account.EmpDept ?? undefined} />
              <Row label="Position" value={Account.EmpPos ?? undefined} />
              <Row label="Location" value={Account.EmpLoc ?? undefined} />
              <Row label="Role" value={Account.EmpRole ?? undefined} />
              <Row label="Email" value={Personal?.EmpEmail ?? undefined} />
              <Row label="Address" value={Personal?.EmpAddress ?? undefined} />
              <Row label="Birthday" value={fmt(Personal?.EmpBirthday)} />
              <Row label="Gender" value={Personal?.EmpGender ?? undefined} />
              <Row label="Civil Status" value={Personal?.EmpCivil ?? undefined} />
              <Row label="Contact 1" value={Personal?.EmpContact1 ?? undefined} />
              <Row label="Contact 2" value={Personal?.EmpContact2 ?? undefined} />
              <Row label="Spouse" value={Personal?.EmpSpouse ?? undefined} />
              <Row label="Father" value={Personal?.EmpFather ?? undefined} />
              <Row label="Mother" value={Personal?.EmpMother ?? undefined} />
              <Row label="Bank Account" value={Personal?.EmpAccount ?? undefined} />
            </dl>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Work tab ────────────────────────────────────────────── */}
      <TabsContent value="work">
        <Card>
          <CardContent className="pt-6">
            <dl>
              <Row label="Employee Type" value={EmpWrk?.emp_type != null ? (EMP_TYPE[EmpWrk.emp_type] ?? String(EmpWrk.emp_type)) : undefined} />
              <Row label="Date Hired" value={fmt(EmpWrk?.emp_datehired)} />
              <Row label="Expected Regularization" value={fmt(EmpWrk?.emp_dateexp)} />
              <Row label="Date of Regularization" value={fmt(EmpWrk?.emp_datereg)} />
              <Row label="Supervisor" value={EmpWrk?.emp_supervisor ?? undefined} />
              <Row label="SSS" value={EmpWrk?.emp_sss ?? undefined} />
              <Row label="PhilHealth" value={EmpWrk?.emp_philhealth ?? undefined} />
              <Row label="Pag-IBIG" value={EmpWrk?.emp_pagibig ?? undefined} />
              <Row label="TIN" value={EmpWrk?.emp_tin ?? undefined} />
              <Row label="Tax Status" value={EmpWrk?.emp_taxstat ?? undefined} />
              <Row label="RDO" value={EmpWrk?.emp_rdo ?? undefined} />
              <Row label="Passport" value={EmpWrk?.emp_passport ?? undefined} />
              <Row label="PRC" value={EmpWrk?.emp_prc ?? undefined} />
              <Row label="Remarks" value={EmpWrk?.emp_remarks ?? undefined} />
            </dl>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Benefits & Leave tab ─────────────────────────────────── */}
      <TabsContent value="benefits">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EmpLeave.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No leave records.
                    </TableCell>
                  </TableRow>
                ) : (
                  EmpLeave.map((lv) => (
                    <TableRow key={lv.LevId}>
                      <TableCell>{lv.LevTypeDesc || lv.LevType || "—"}</TableCell>
                      <TableCell className="text-right">{num(lv.LevCredits, 1)}</TableCell>
                      <TableCell className="text-right">{num(lv.LevUsed, 1)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={(lv.LevRemaining ?? 0) > 0 ? "default" : "outline"}>
                          {num(lv.LevRemaining, 1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Salary History tab ───────────────────────────────────── */}
      <TabsContent value="salary">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead>Payroll Type</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Allowance</TableHead>
                  <TableHead className="text-right">De Minimis</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EmpSalary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No salary records.
                    </TableCell>
                  </TableRow>
                ) : (
                  EmpSalary.map((s) => (
                    <TableRow key={s.SalId}>
                      <TableCell>{s.SalPosition ?? "—"}</TableCell>
                      <TableCell>{s.SalPayrollType ?? "—"}</TableCell>
                      <TableCell className="text-right">{num(s.SalAmount)}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell>{fmt(s.SalDateFrom)}</TableCell>
                      <TableCell>{fmt(s.SalDateTo)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Advances & Loans tab ─────────────────────────────────── */}
      <TabsContent value="advances">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {EmpAdvance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No advance or loan records.
                    </TableCell>
                  </TableRow>
                ) : (
                  EmpAdvance.map((a) => (
                    <TableRow key={a.AdvId}>
                      <TableCell>{a.AdvType ?? "—"}</TableCell>
                      <TableCell>{fmt(a.AdvDate)}</TableCell>
                      <TableCell className="text-right">{num(a.AdvAmount)}</TableCell>
                      <TableCell>{a.AdvRemarks ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
