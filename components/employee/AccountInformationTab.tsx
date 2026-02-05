"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  EmployeeDetail,
  Department,
  Position,
  Location,
  useUpdateEmployeeAccount,
  useCreateEmployeeAccount,
} from "@/lib/hooks/useEmployeeDetail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Save, Plus, Pencil } from "lucide-react";
import { useToast } from "@/lib/hooks/use-toast";
import Image from "next/image";
import { useUploadFile } from "@/lib/hooks/useUpload";
import { useRouter } from "next/navigation";

const accountSchema = z.object({
  EmpLast: z.string().min(1, "Last name is required"),
  EmpFirst: z.string().min(1, "First name is required"),
  EmpMid: z.string().optional(),
  EmpDept: z.string().min(1, "Department is required"),
  EmpPos: z.string().min(1, "Position is required"),
  EmpLoc: z.string().min(1, "Location is required"),
  // Role is managed in Security tab; keep here only for initial value pass-through if needed
  EmpRole: z.string().optional(),
  EmpExternalId: z.string().optional(),
  // Personal Information
  EmpAddress: z
    .string()
    .min(1, "Address is required")
    .optional()
    .or(z.literal("")),
  EmpContact1: z.string().optional(),
  EmpContact2: z.string().optional(),
  EmpEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  EmpBirthday: z.date().optional(),
  EmpGender: z.string().optional(),
  EmpCivil: z.string().optional(),
  EmpFather: z.string().optional(),
  EmpMother: z.string().optional(),
  EmpSpouse: z.string().optional(),
  EmpAccount: z.string().optional(),
  // Work Information
  emp_code: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountInformationTabProps {
  employee: EmployeeDetail;
  departments: Department[] | undefined;
  positions: Position[] | undefined;
  locations: Location[] | undefined;
  isNewEmployee?: boolean;
}

export function AccountInformationTab({
  employee,
  departments,
  positions,
  locations,
  isNewEmployee = false,
}: AccountInformationTabProps) {
  const router = useRouter();
  const updateMutation = useUpdateEmployeeAccount(
    employee.Account.EmpId || "new"
  );
  const createMutation = useCreateEmployeeAccount();
  const { toast } = useToast();
  const uploadMutation = useUploadFile();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      EmpLast: employee.Account.EmpLast || "",
      EmpFirst: employee.Account.EmpFirst || "",
      EmpMid: employee.Account.EmpMid || "",
      EmpDept: employee.Account.EmpDept || "",
      EmpPos: employee.Account.EmpPos || "",
      EmpLoc: employee.Account.EmpLoc || "",
      EmpRole: employee.Account.EmpRole || "EMPLOYEE",
      EmpExternalId: employee.Account.EmpExternalId || "",
      EmpAddress: employee.Personal?.EmpAddress || "",
      EmpContact1: employee.Personal?.EmpContact1 || "",
      EmpContact2: employee.Personal?.EmpContact2 || "",
      EmpEmail: employee.Personal?.EmpEmail || "",
      EmpBirthday: employee.Personal?.EmpBirthday
        ? new Date(employee.Personal.EmpBirthday)
        : undefined,
      EmpGender: employee.Personal?.EmpGender || "",
      EmpCivil: employee.Personal?.EmpCivil || "",
      EmpFather: employee.Personal?.EmpFather || "",
      EmpMother: employee.Personal?.EmpMother || "",
      EmpSpouse: employee.Personal?.EmpSpouse || "",
      EmpAccount: employee.Personal?.EmpAccount || "",
      emp_code: employee.EmpWrk?.emp_supervisor || "",
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    try {
      if (isNewEmployee || !employee.Account.EmpId) {
        // Create new employee
        const created = await createMutation.mutateAsync({
          Account: {
            EmpLast: data.EmpLast,
            EmpFirst: data.EmpFirst,
            EmpMid: data.EmpMid ?? null,
            EmpDept: data.EmpDept,
            EmpPos: data.EmpPos,
            EmpLoc: data.EmpLoc,
            EmpRole: data.EmpRole ?? "EMPLOYEE",
            EmpExternalId: data.EmpExternalId ?? null,
          },
          Personal: {
            EmpAddress: data.EmpAddress || null,
            EmpBirthday: data.EmpBirthday ?? null,
            EmpMother: data.EmpMother || null,
            EmpFather: data.EmpFather || null,
            EmpGender: data.EmpGender || null,
            EmpCivil: data.EmpCivil || null,
            EmpSpouse: data.EmpSpouse || null,
            EmpContact1: data.EmpContact1 || null,
            EmpContact2: data.EmpContact2 || null,
            EmpEmail: data.EmpEmail || null,
            EmpAccount: data.EmpAccount || null,
          },
        });

        toast({
          title: "Success",
          description: "Employee created successfully",
        });

        // Navigate to the newly created employee's page
        if (created.emp_id) {
          router.push(`/employees/${created.emp_id}`);
        }
      } else {
        // Update existing employee
        await updateMutation.mutateAsync({
          Account: {
            EmpLast: data.EmpLast,
            EmpFirst: data.EmpFirst,
            EmpMid: data.EmpMid ?? null,
            EmpDept: data.EmpDept,
            EmpPos: data.EmpPos,
            EmpLoc: data.EmpLoc,
            EmpRole: data.EmpRole ?? null,
            EmpExternalId: data.EmpExternalId ?? null,
          },
          Personal: {
            EmpAddress: data.EmpAddress || null,
            EmpBirthday: data.EmpBirthday ?? null,
            EmpMother: data.EmpMother || null,
            EmpFather: data.EmpFather || null,
            EmpGender: data.EmpGender || null,
            EmpCivil: data.EmpCivil || null,
            EmpSpouse: data.EmpSpouse || null,
            EmpContact1: data.EmpContact1 || null,
            EmpContact2: data.EmpContact2 || null,
            EmpEmail: data.EmpEmail || null,
            EmpAccount: data.EmpAccount || null,
          },
        });
        toast({
          title: "Success",
          description: "Account information updated successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to update account information",
        variant: "destructive",
      });
    }
  };

  const handleProfileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadMutation.mutateAsync({
        path: "employee",
        fk: employee.Account.EmpId,
        type: "profile",
        files: [file],
      });
      toast({
        title: "Success",
        description: "Profile picture uploaded successfully",
      });
      // Refresh the page to show the new profile picture
      window.location.reload();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload profile picture",
        variant: "destructive",
      });
    }
  };

  // Profile picture URL from storage service
  const profileImageSrc = employee.files?.profile?.fil_url || null;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Profile Picture Section */}
      <div className="flex gap-6">
        <div className="flex-shrink-0">
          <div className="relative w-40 h-40 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            {profileImageSrc ? (
              <Image
                src={profileImageSrc}
                alt="Profile"
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg
                  className="w-24 h-24"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
          <label htmlFor="profile-upload" className="mt-2 block">
            <input
              id="profile-upload"
              type="file"
              accept=".png,.jpeg,.jpg"
              onChange={handleProfileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <span>
                <Plus className="mr-2 h-4 w-4" />
                Upload Photo
              </span>
            </Button>
          </label>
        </div>

        {/* Basic Information Section */}
        <div className="flex-1">
          <h4 className="text-lg font-semibold mb-4">Basic Information</h4>
          <div className="grid grid-cols-3 gap-4">
            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="EmpFirst">
                Firstname: <span className="text-red-500">*</span>
              </Label>
              <Input
                id="EmpFirst"
                {...register("EmpFirst")}
                placeholder="Enter first name"
                className="bg-gray-50"
              />
              {errors.EmpFirst && (
                <p className="text-sm text-red-600">
                  {errors.EmpFirst.message}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="EmpLast">
                Lastname: <span className="text-red-500">*</span>
              </Label>
              <Input
                id="EmpLast"
                {...register("EmpLast")}
                placeholder="Enter last name"
                className="bg-gray-50"
              />
              {errors.EmpLast && (
                <p className="text-sm text-red-600">{errors.EmpLast.message}</p>
              )}
            </div>

            {/* Middle Name */}
            <div className="space-y-2">
              <Label htmlFor="EmpMid">Middlename:</Label>
              <Input
                id="EmpMid"
                {...register("EmpMid")}
                placeholder="Enter middle name"
                className="bg-gray-50"
              />
            </div>

            {/* Usercode */}
            <div className="space-y-2">
              <Label htmlFor="emp_code">Usercode:</Label>
              <Input
                id="emp_code"
                {...register("emp_code")}
                placeholder="Enter usercode"
                className="bg-gray-50"
              />
            </div>

            {/* External ID */}
            <div className="space-y-2">
              <Label htmlFor="EmpExternalId">External ID:</Label>
              <Input
                id="EmpExternalId"
                {...register("EmpExternalId")}
                placeholder="Enter external ID"
                className="bg-gray-50"
              />
            </div>

            {/* Account # */}
            <div className="space-y-2">
              <Label htmlFor="EmpAccount">Account #:</Label>
              <Input
                id="EmpAccount"
                {...register("EmpAccount")}
                placeholder="Enter account number"
                className="bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Job Position Details Section */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">Job Position Details</h4>
        <div className="grid grid-cols-3 gap-4">
          {/* Department */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="EmpDept">
                Department: <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Select
              value={watch("EmpDept")}
              onValueChange={(value) => setValue("EmpDept", value)}
            >
              <SelectTrigger id="EmpDept" className="bg-gray-50">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments?.map((dept) => (
                  <SelectItem key={dept.dep_id} value={dept.dep_id}>
                    {dept.dep_desc || dept.dep_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.EmpDept && (
              <p className="text-sm text-red-600">{errors.EmpDept.message}</p>
            )}
          </div>

          {/* Position */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="EmpPos">
                Position: <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Select
              value={watch("EmpPos")}
              onValueChange={(value) => setValue("EmpPos", value)}
            >
              <SelectTrigger id="EmpPos" className="bg-gray-50">
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions?.map((pos) => (
                  <SelectItem key={pos.pst_id} value={pos.pst_id}>
                    {pos.pst_desc || pos.pst_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.EmpPos && (
              <p className="text-sm text-red-600">{errors.EmpPos.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="EmpLoc">
                Location: <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Select
              value={watch("EmpLoc")}
              onValueChange={(value) => setValue("EmpLoc", value)}
            >
              <SelectTrigger id="EmpLoc" className="bg-gray-50">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map((loc) => (
                  <SelectItem key={loc.loc_id} value={loc.loc_id}>
                    {loc.loc_desc || loc.loc_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.EmpLoc && (
              <p className="text-sm text-red-600">{errors.EmpLoc.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Additional Personal Information Section */}
      <div className="mt-6">
        <h4 className="text-lg font-semibold mb-4">
          Additional Personal Information
        </h4>
        <div className="grid grid-cols-2 gap-4">
          {/* Address */}
          <div className="space-y-2 col-span-2">
            <Label htmlFor="EmpAddress">
              Address: <span className="text-red-500">*</span>
            </Label>
            <Input
              id="EmpAddress"
              {...register("EmpAddress")}
              placeholder="Enter address"
              className="bg-gray-50"
            />
            {errors.EmpAddress && (
              <p className="text-sm text-red-600">
                {errors.EmpAddress.message}
              </p>
            )}
          </div>

          {/* Contact #1 */}
          <div className="space-y-2">
            <Label htmlFor="EmpContact1">
              Contact #1: <span className="text-red-500">*</span>
            </Label>
            <Input
              id="EmpContact1"
              {...register("EmpContact1")}
              placeholder="Enter contact number"
              className="bg-gray-50"
            />
            {errors.EmpContact1 && (
              <p className="text-sm text-red-600">
                {errors.EmpContact1.message}
              </p>
            )}
          </div>

          {/* Contact #2 */}
          <div className="space-y-2">
            <Label htmlFor="EmpContact2">
              Contact #2: <span className="text-red-500">*</span>
            </Label>
            <Input
              id="EmpContact2"
              {...register("EmpContact2")}
              placeholder="Enter contact number"
              className="bg-gray-50"
            />
            {errors.EmpContact2 && (
              <p className="text-sm text-red-600">
                {errors.EmpContact2.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="EmpEmail">Email:</Label>
            <Input
              id="EmpEmail"
              type="email"
              {...register("EmpEmail")}
              placeholder="Enter email"
              className="bg-gray-50"
            />
            {errors.EmpEmail && (
              <p className="text-sm text-red-600">{errors.EmpEmail.message}</p>
            )}
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label htmlFor="EmpBirthday">
              Birthday: <span className="text-red-500">*</span>
            </Label>
            <Input
              id="EmpBirthday"
              type="date"
              {...register("EmpBirthday", {
                setValueAs: (value: string) =>
                  value ? new Date(value) : undefined,
              })}
              className="bg-gray-50"
            />
            {errors.EmpBirthday && (
              <p className="text-sm text-red-600">
                {errors.EmpBirthday.message}
              </p>
            )}
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label htmlFor="EmpGender">Gender:</Label>
            <Select
              value={watch("EmpGender") || ""}
              onValueChange={(value) => setValue("EmpGender", value)}
            >
              <SelectTrigger id="EmpGender" className="bg-gray-50">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="N">Not Specified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Civil Status */}
          <div className="space-y-2">
            <Label htmlFor="EmpCivil">Civil Status:</Label>
            <Select
              value={watch("EmpCivil") || ""}
              onValueChange={(value) => setValue("EmpCivil", value)}
            >
              <SelectTrigger id="EmpCivil" className="bg-gray-50">
                <SelectValue placeholder="Select civil status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="S">Single</SelectItem>
                <SelectItem value="M">Married</SelectItem>
                <SelectItem value="D">Divorced</SelectItem>
                <SelectItem value="W">Widowed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Father's Name */}
          <div className="space-y-2">
            <Label htmlFor="EmpFather">Father&apos;s Name:</Label>
            <Input
              id="EmpFather"
              {...register("EmpFather")}
              placeholder="Enter father's name"
              className="bg-gray-50"
            />
          </div>

          {/* Mother's Name */}
          <div className="space-y-2">
            <Label htmlFor="EmpMother">Mother&apos;s Name:</Label>
            <Input
              id="EmpMother"
              {...register("EmpMother")}
              placeholder="Enter mother's name"
              className="bg-gray-50"
            />
          </div>

          {/* Spouse */}
          <div className="space-y-2">
            <Label htmlFor="EmpSpouse">Spouse:</Label>
            <Input
              id="EmpSpouse"
              {...register("EmpSpouse")}
              placeholder="Enter spouse name"
              className="bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Dependent List Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Dependents</h4>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Dependent
          </Button>
        </div>
        {employee.EmpDependent && employee.EmpDependent.length > 0 ? (
          <div className="space-y-2">
            {employee.EmpDependent.map((dep, idx) => (
              <div key={`dep-${dep.DepId}-${idx}`} className="border-b pb-2">
                <p className="font-medium">{dep.DepName || "N/A"}</p>
                <p className="text-sm text-gray-600">
                  {dep.DepRelation} -{" "}
                  {dep.DepBirthday
                    ? new Date(dep.DepBirthday).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No dependents added</p>
        )}
      </div>

      {/* Employment History Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold">Employment History</h4>
          <Button type="button" variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add History
          </Button>
        </div>
        {employee.EmpHistory && employee.EmpHistory.length > 0 ? (
          <div className="space-y-2">
            {employee.EmpHistory.map((his, idx) => (
              <div key={`his-${his.HisId}-${idx}`} className="border-b pb-2">
                <p className="font-medium">{his.HisCompany || "N/A"}</p>
                <p className="text-sm text-gray-600">
                  {his.HisPosition} -{" "}
                  {his.HisStartdate
                    ? new Date(his.HisStartdate).toLocaleDateString()
                    : "N/A"}{" "}
                  to{" "}
                  {his.HisEnddate
                    ? new Date(his.HisEnddate).toLocaleDateString()
                    : "Present"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No employment history</p>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          type="submit"
          disabled={isSubmitting || updateMutation.isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSubmitting || updateMutation.isPending
            ? "Saving..."
            : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
