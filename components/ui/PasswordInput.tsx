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
          className="rounded-md w-full"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="w-max text-right text-muted-foreground border-none bg-transparent"
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
