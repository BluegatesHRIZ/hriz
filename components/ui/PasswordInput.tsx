"use client"

import { useState } from "react"
import { Input } from "./input"
import { Label } from "./label"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "./button"

interface PasswordInputProps {
  id: string
  label: string
  register: any
  error?: string
  disabled?: boolean
}

export function PasswordInput({
  id,
  label,
  register,
  error,
  disabled,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col w-full">
      <Label htmlFor={id}>{label}</Label>
      <div className="password-flex w-full flex items-center gap-2">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          {...register}
          placeholder=""
          className="border-[.5px] border-black rounded-md w-full bg-bgc-gray py-[3px] px-[4.5px]"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="w-max text-right text-[#9ca1a5] border-none bg-transparent"
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff className="w-6 h-6" stroke="#9ca1a5" />
          ) : (
            <Eye className="w-6 h-6" stroke="#9ca1a5" />
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
