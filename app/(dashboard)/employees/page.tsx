"use client"

export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { useEmployees, useManageEmployeeStatus } from "@/lib/hooks/useEmployees"
import {
  useDepartments,
  useLocations,
  usePositions,
} from "@/lib/hooks/useEmployeeDetail"
import { useGenerateQrToken } from "@/lib/hooks/useAuth"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Users, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import Link from "next/link"
import { Plus, Search } from "lucide-react"
import { Pagination } from "@/components/ui/Pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Radix Select forbids an empty item value, so "all" stands in for no filter. */
const ALL = "all"

export default function EmployeesPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [page, setPage] = useState(1)

  // `searchInput` is what the user sees; `search` is the debounced value the
  // server actually queries on.
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [dept, setDept] = useState(ALL)
  const [loc, setLoc] = useState(ALL)
  const [pos, setPos] = useState(ALL)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: employeesPage, isLoading, error } = useEmployees({
    page,
    search,
    dept: dept === ALL ? undefined : dept,
    loc: loc === ALL ? undefined : loc,
    pos: pos === ALL ? undefined : pos,
  })
  const employees = employeesPage?.data ?? []

  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const { data: locations } = useLocations()
  const manageStatusMutation = useManageEmployeeStatus()
  const generateQrMutation = useGenerateQrToken()
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, authLoading, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const onSearchChange = (v: string) => {
    setSearchInput(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setSearch(v)
      setPage(1)
    }, 300)
  }

  // Any filter change invalidates the current page number.
  const onFilterChange = (set: (v: string) => void) => (v: string) => {
    set(v)
    setPage(1)
  }

  const handleStatusChange = (empId: string, value: string) => {
    const status = Number(value)
    if (!status || ![1, 2, 3, 4, 5].includes(status)) return
    manageStatusMutation.mutate({ empId, status })
  }

  const handleGenerateQr = async (empId: string) => {
    setSelectedEmpId(empId)
    setQrDialogOpen(true)
    setQrCodeDataUrl(null)
    
    try {
      const response = await generateQrMutation.mutateAsync({ empId })
      
      // Generate QR code using qrcode library
      if (typeof window !== "undefined") {
        const QRCode = (await import("qrcode")).default
        const dataUrl = await QRCode.toDataURL(response.qrToken, {
          width: 300,
          margin: 2,
        })
        setQrCodeDataUrl(dataUrl)
      }
    } catch (error) {
      console.error("Failed to generate QR code:", error)
      setQrDialogOpen(false)
    }
  }

  return (
    <div className="w-full px-4 md:px-6 lg:px-8 pt-5 pb-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Employee Management</h1>
        <Button asChild>
          <Link href="/employees/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Link>
        </Button>
      </div>

      <CardWithHeader
        title="Employee List"
        icon={<Users className="w-6 h-6" />}
        iconColor="#8db7ff"
        className="mb-4"
      >
        <div className="space-y-4">
          {/* Search and filters — all applied server-side */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID or name..."
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={dept} onValueChange={onFilterChange(setDept)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments?.map((d) => (
                  <SelectItem key={d.dep_id} value={d.dep_id}>
                    {d.dep_desc || d.dep_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pos} onValueChange={onFilterChange(setPos)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All positions</SelectItem>
                {positions?.map((p) => (
                  <SelectItem key={p.pst_id} value={p.pst_id}>
                    {p.pst_desc || p.pst_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={loc} onValueChange={onFilterChange(setLoc)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All locations</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.loc_id} value={l.loc_id}>
                    {l.loc_desc || l.loc_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p>Loading employees...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-red-600">Error loading employees</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <span className="sr-only">Photo</span>
                    </TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.emp_id}>
                      <TableCell className="w-12 pr-0">
                        <Avatar
                          src={emp.emp_avatar_url}
                          name={`${emp.emp_first ?? ""} ${emp.emp_last ?? ""}`}
                          size={32}
                          rounded="rounded-full"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{emp.emp_id}</TableCell>
                      <TableCell>
                        {emp.emp_first} {emp.emp_mid} {emp.emp_last}
                      </TableCell>
                      <TableCell>{emp.emp_dept_desc || emp.emp_dept || "N/A"}</TableCell>
                      <TableCell>{emp.emp_pos_desc || emp.emp_pos || "N/A"}</TableCell>
                      <TableCell>{emp.emp_loc_desc || emp.emp_loc || "N/A"}</TableCell>
                      <TableCell>
                        {/* The dropdown shows the current status as its value —
                            a separate label beside it just repeated itself. */}
                        <Select
                          value={String(emp.emp_status ?? 1)}
                          onValueChange={(value) =>
                            handleStatusChange(emp.emp_id, value)
                          }
                          disabled={manageStatusMutation.isPending}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Active</SelectItem>
                            <SelectItem value="2">Resigned</SelectItem>
                            <SelectItem value="3">End of Contract</SelectItem>
                            <SelectItem value="4">Terminated</SelectItem>
                            <SelectItem value="5">AWOL</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/employees/${emp.emp_id}`}>View</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateQr(emp.emp_id)}
                            disabled={generateQrMutation.isPending}
                          >
                            <QrCode className="mr-1 h-4 w-4" />
                            QR Login
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {employeesPage?.meta && (
            <Pagination meta={employeesPage.meta} onPageChange={setPage} />
          )}
        </div>
      </CardWithHeader>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Login Code</DialogTitle>
            <DialogDescription>
              Scan this QR code with the login page to sign in as{" "}
              {selectedEmpId && employees?.find((e) => e.emp_id === selectedEmpId)
                ? `${employees.find((e) => e.emp_id === selectedEmpId)?.emp_first} ${employees.find((e) => e.emp_id === selectedEmpId)?.emp_last}`
                : selectedEmpId}
              . This QR code does not expire.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {generateQrMutation.isPending ? (
              <div className="flex items-center justify-center h-[300px]">
                <p>Generating QR code...</p>
              </div>
            ) : qrCodeDataUrl ? (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="border rounded-lg p-2 bg-card"
                  width={300}
                  height={300}
                />
                <p className="text-sm text-muted-foreground text-center">
                  Scan this code with the login page to sign in
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-red-600">Failed to generate QR code</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
