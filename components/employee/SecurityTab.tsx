"use client"

import { useState } from "react"
import {
  EmployeeDetail,
  useChangePassword,
  useRoles,
  useUpdateEmployeeAccount,
} from "@/lib/hooks/useEmployeeDetail"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Save, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/lib/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SecurityTabProps {
  employee: EmployeeDetail
}

export function SecurityTab({ employee }: SecurityTabProps) {
  const { toast } = useToast()
  const passwordMutation = useChangePassword(employee.Account.EmpId)
  const updateAccountMutation = useUpdateEmployeeAccount(employee.Account.EmpId)
  const { data: roles } = useRoles()

  const [selectedRole, setSelectedRole] = useState(
    employee.Account.EmpRole || "EMPLOYEE"
  )

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const handleSavePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Validation Error",
        description: "All password fields are required",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New password and confirm password do not match",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Validation Error",
        description: "New password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    try {
      await passwordMutation.mutateAsync({
        oldPassword,
        newPassword,
        confirmPassword,
      })
      toast({
        title: "Success",
        description: "Password changed successfully",
      })
      // Clear form
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      })
    }
  }

  const handleSaveRole = async () => {
    try {
      await updateAccountMutation.mutateAsync({
        Account: {
          EmpLast: employee.Account.EmpLast || "",
          EmpFirst: employee.Account.EmpFirst || "",
          EmpMid: employee.Account.EmpMid || null,
          EmpDept: employee.Account.EmpDept || null,
          EmpPos: employee.Account.EmpPos || null,
          EmpLoc: employee.Account.EmpLoc || null,
          EmpRole: selectedRole || null,
          EmpExternalId: employee.Account.EmpExternalId || null,
        },
        Personal: employee.Personal
          ? {
              EmpAddress: employee.Personal.EmpAddress || null,
              EmpBirthday: employee.Personal.EmpBirthday || null,
              EmpMother: employee.Personal.EmpMother || null,
              EmpFather: employee.Personal.EmpFather || null,
              EmpGender: employee.Personal.EmpGender || null,
              EmpCivil: employee.Personal.EmpCivil || null,
              EmpSpouse: employee.Personal.EmpSpouse || null,
              EmpContact1: employee.Personal.EmpContact1 || null,
              EmpContact2: employee.Personal.EmpContact2 || null,
              EmpEmail: employee.Personal.EmpEmail || null,
              EmpAccount: employee.Personal.EmpAccount || null,
            }
          : null,
      })

      toast({
        title: "Success",
        description: "Role updated successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update role",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Role Assignment */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Assign Role</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <Label htmlFor="EmpRole">Role Type</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value)}
            >
              <SelectTrigger id="EmpRole" className="bg-gray-50">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role) => (
                  <SelectItem key={role.rol_id} value={role.rol_id}>
                    {role.rol_name || role.rol_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="role_description">Description</Label>
            <p id="role_description" className="text-sm text-gray-600 mt-1">
              {roles?.find((r) => r.rol_id === selectedRole)?.rol_desc ??
                "Undefined"}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            onClick={handleSaveRole}
            disabled={updateAccountMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {updateAccountMutation.isPending ? "Saving..." : "Save Role"}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div>
        <h4 className="text-lg font-semibold mb-4">Change Password</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
          <div>
            <Label htmlFor="old_password">Old Password</Label>
            <div className="relative">
              <Input
                id="old_password"
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter old password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowOldPassword(!showOldPassword)}
              >
                {showOldPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="new_password">New Password</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button 
          type="button" 
          onClick={handleSavePassword}
          disabled={passwordMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {passwordMutation.isPending ? "Saving..." : "Change Password"}
        </Button>
      </div>
    </div>
  )
}
