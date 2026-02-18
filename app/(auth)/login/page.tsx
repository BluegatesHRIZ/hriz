"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useLogin, useLoginWithQr } from "@/lib/hooks/useAuth"
import { useSettings } from "@/lib/hooks/useSettings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { BGCLogo } from "@/components/ui/BGCLogo"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { QrCode } from "lucide-react"
import Image from "next/image"

const loginSchema = z.object({
  EmpId: z.string().min(1, "Username is required"),
  EmpPswd: z.string().min(1, "Password is required"),
  external_id: z.boolean(),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const loginMutation = useLogin()
  const loginQrMutation = useLoginWithQr()
  const { data: settings } = useSettings()
  const [error, setError] = useState<string | null>(null)
  const [includeTabIndex, setIncludeTabIndex] = useState(0)
  const [qrScannerOpen, setQrScannerOpen] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<any>(null)
  const [scannerError, setScannerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      external_id: settings?.set_extid === 1 ? true : false,
    },
  })

  // Update external_id default when settings load
  useEffect(() => {
    if (settings?.set_extid === 1) {
      setValue("external_id", true)
    }
  }, [settings, setValue])

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    try {
      await loginMutation.mutateAsync({
        ...data,
        IpAddress: "", // Can be filled from request headers on server
      })

      // Token is stored in the mutation's onSuccess callback
      // Wait a moment for auth context to update, then redirect
      setTimeout(() => {
        router.push("/dashboard")
      }, 200)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("Login failed. Please try again.")
      }
    }
  }

  const setIncludes = settings?.set_includes || 0

  const handleQrScan = async (decodedText: string) => {
    try {
      await loginQrMutation.mutateAsync({ qrToken: decodedText })
      setQrScannerOpen(false)
      // Wait a moment for auth context to update, then redirect
      setTimeout(() => {
        router.push("/dashboard")
      }, 200)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError("QR login failed. Please try again.")
      }
      // Keep scanner open for retry
    }
  }

  useEffect(() => {
    if (!qrScannerOpen) {
      // Clean up scanner when dialog closes
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current?.clear()
            html5QrCodeRef.current = null
          })
          .catch(() => {
            // Ignore stop errors
          })
      }
      setScannerError(null)
      return
    }

    // Wait for dialog to fully render before initializing scanner
    const timer = setTimeout(async () => {
      if (!scannerRef.current) {
        setScannerError("Scanner container not found")
        return
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        const scannerId = `qr-scanner-${Date.now()}`
        scannerRef.current.id = scannerId

        const scanner = new Html5Qrcode(scannerId)
        html5QrCodeRef.current = scanner

        await scanner.start(
          { facingMode: "environment" }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            // Stop scanner once QR is decoded
            scanner.stop().then(() => {
              scanner.clear()
              html5QrCodeRef.current = null
            })
            handleQrScan(decodedText)
          },
          (errorMessage: string) => {
            // Ignore scanning errors - scanner will keep trying
            // Only log if it's not a "not found" error
            if (!errorMessage.includes("NotFoundException")) {
              console.debug("QR scan error:", errorMessage)
            }
          }
        )
        setScannerError(null)
      } catch (error: any) {
        console.error("Failed to initialize QR scanner:", error)
        const errorMsg =
          error?.message?.includes("Permission") ||
          error?.message?.includes("NotAllowedError")
            ? "Camera permission denied. Please allow camera access and try again."
            : error?.message?.includes("NotFoundError")
            ? "No camera found. Please connect a camera and try again."
            : "Failed to access camera. Please check permissions and try again."
        setScannerError(errorMsg)
        if (html5QrCodeRef.current) {
          html5QrCodeRef.current = null
        }
      }
    }, 300) // Increased delay to ensure dialog is fully rendered

    return () => {
      clearTimeout(timer)
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current
          .stop()
          .then(() => {
            html5QrCodeRef.current?.clear()
            html5QrCodeRef.current = null
          })
          .catch(() => {
            // Ignore stop errors
          })
      }
    }
  }, [qrScannerOpen])

  return (
    <div className="relative h-screen w-screen bg-bgc-gray flex items-center justify-center">
      {/* BGC Logo in top-left */}
      <div className="flex items-center absolute top-0 left-0 gap-2 pl-3 mt-2">
        <BGCLogo className="w-[55px]" />
        <h1 className="font-bold text-[28px]">HRIZ.</h1>
      </div>

      {/* Login Form Card */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="shadow-bgc-card flex flex-col items-center w-[430px] gap-3 pt-4 px-4 bg-white rounded-md"
      >
        {/* Client Logo */}
        <div className="w-[85px]">
          <Image
            src="/logos/client-logo.png"
            alt="Client Logo"
            width={85}
            height={85}
            className="w-full"
            priority
          />
        </div>

        {/* Time/Pay Tabs (if set_includes === 2) */}
        {setIncludes === 2 && (
          <Tabs
            value={includeTabIndex === 0 ? "time" : "pay"}
            onValueChange={(value: string) =>
              setIncludeTabIndex(value === "time" ? 0 : 1)
            }
            className="w-[80%]"
          >
            <TabsList className="grid w-full grid-cols-2 bg-[#D9D9D9]">
              <TabsTrigger
                value="time"
                className="data-[state=active]:bg-white data-[state=active]:text-[#333333] data-[state=active]:shadow-md rounded-lg"
              >
                Time
              </TabsTrigger>
              <TabsTrigger
                value="pay"
                className="data-[state=active]:bg-white data-[state=active]:text-[#333333] data-[state=active]:shadow-md rounded-lg"
              >
                Pay
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="w-full flex flex-col gap-3">
          {/* Username Field */}
          <div className="flex flex-col">
            <Label htmlFor="hris_username" className="text-[0.9rem]">
              Username
            </Label>
            <Input
              id="hris_username"
              {...register("EmpId")}
              placeholder=""
              className="border-[.5px] border-black rounded-md bg-bgc-gray py-[3px] px-[4.5px]"
              disabled={loginMutation.isPending}
            />
            {errors.EmpId && (
              <p className="text-sm text-red-600 mt-1">{errors.EmpId.message}</p>
            )}
            {settings?.set_extid === 1 && (
              <div className="right-control flex justify-end w-full text-gray-500 mt-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="external_id"
                    {...register("external_id", {
                      setValueAs: (value: unknown) =>
                        value === true || value === "on",
                    })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="external_id" className="text-sm font-normal">
                    Use External ID
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Password Field */}
          <PasswordInput
            id="hris_password"
            label="Password"
            register={register("EmpPswd")}
            error={errors.EmpPswd?.message}
            disabled={loginMutation.isPending}
          />

          {/* Login Button */}
          <div className="flex justify-between items-center mt-7 mb-7">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQrScannerOpen(true)}
              disabled={loginMutation.isPending || loginQrMutation.isPending}
              className="text-sm"
            >
              <QrCode className="mr-2 h-4 w-4" />
              Login with QR
            </Button>
            <button
              type="submit"
              className="w-max bg-bgc-blue-gray font-bold px-5 py-2 rounded-md text-white disabled:opacity-50"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Please wait" : "Login"}
            </button>
          </div>

          {/* Copyright */}
          <p className="text-[13px] text-[#828282] text-center pb-2">
            © 2023 Bluegates Cube Inc. All Rights Reserved
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 w-full">
            {error}
          </div>
        )}
      </form>

      {/* QR Scanner Dialog */}
      <Dialog open={qrScannerOpen} onOpenChange={setQrScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code to sign in
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              ref={scannerRef}
              className="w-full max-w-sm min-h-[300px] flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden"
              style={{ position: "relative" }}
            >
              {scannerError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
                  <p className="text-sm text-gray-600 text-center p-4">{scannerError}</p>
                </div>
              )}
            </div>
            {scannerError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 w-full">
                {scannerError}
              </div>
            )}
            {loginQrMutation.isPending && (
              <p className="text-sm text-gray-600">Logging in...</p>
            )}
            <Button
              variant="outline"
              onClick={() => setQrScannerOpen(false)}
              disabled={loginQrMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
