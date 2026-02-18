"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/context"
import { useEmployees, useManageEmployeeStatus } from "@/lib/hooks/useEmployees"
import { useGenerateQrToken } from "@/lib/hooks/useAuth"
import { CardWithHeader } from "@/components/cards/CardWithHeader"
import { Users, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function EmployeesPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: employees, isLoading, error } = useEmployees()
  const [searchTerm, setSearchTerm] = useState("")
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

  const getStatusLabel = (status: number | null) => {
    switch (status) {
      case 1:
        return "Active"
      case 2:
        return "Resigned"
      case 3:
        return "End of Contract"
      case 4:
        return "Terminated"
      case 5:
        return "AWOL"
      default:
        return "Unknown"
    }
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

  const filteredEmployees = employees?.filter((emp) => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      emp.emp_id?.toLowerCase().includes(search) ||
      emp.emp_first?.toLowerCase().includes(search) ||
      emp.emp_last?.toLowerCase().includes(search) ||
      emp.emp_dept?.toLowerCase().includes(search) ||
      emp.emp_pos?.toLowerCase().includes(search)
    )
  }) || []

  return (
    <div className="container mt-4 pb-4 w-full max-w-[1400px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employee Management</h1>
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
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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
          ) : filteredEmployees.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500">No employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.emp_id}>
                      <TableCell className="font-medium">{emp.emp_id}</TableCell>
                      <TableCell>
                        {emp.emp_first} {emp.emp_mid} {emp.emp_last}
                      </TableCell>
                      <TableCell>{emp.emp_dept || "N/A"}</TableCell>
                      <TableCell>{emp.emp_pos || "N/A"}</TableCell>
                      <TableCell>{emp.emp_loc || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">
                            {getStatusLabel(emp.emp_status)}
                          </span>
                          <Select
                            value={String(emp.emp_status ?? 1)}
                            onValueChange={(value) =>
                              handleStatusChange(emp.emp_id, value)
                            }
                            disabled={manageStatusMutation.isPending}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
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
                        </div>
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
                  className="border rounded-lg p-2 bg-white"
                  width={300}
                  height={300}
                />
                <p className="text-sm text-gray-500 text-center">
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
