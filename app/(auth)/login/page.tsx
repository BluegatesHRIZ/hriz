"use client"

export const dynamic = "force-dynamic"

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
import { ThemeToggle } from "@/components/ui/theme-toggle"
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
  const scannerStoppingRef = useRef(false)
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

  const cleanupScanner = async () => {
    const scanner = html5QrCodeRef.current
    if (!scanner || scannerStoppingRef.current) return

    scannerStoppingRef.current = true
    try {
      await scanner.stop()
    } catch {
      // ignore stop transition errors
    } finally {
      try {
        await scanner.clear()
      } catch {
        // ignore clear errors
      }
      html5QrCodeRef.current = null
      scannerStoppingRef.current = false
    }
  }

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
      void cleanupScanner()
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
            void cleanupScanner()
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
      void cleanupScanner()
    }
  }, [qrScannerOpen])

  const year = new Date().getFullYear()

  // Track the cursor by writing CSS vars straight to the DOM — no re-renders.
  const handlePanelMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }

  return (
    <div className="min-h-[100dvh] w-full lg:grid lg:grid-cols-[1fr_1.05fr]">
      {/* Left: form */}
      <div className="relative flex min-h-[100dvh] flex-col px-6 py-8 sm:px-10 lg:px-14">
        {/* Brand mark + theme toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BGCLogo className="w-9" />
            <span className="text-xl font-semibold tracking-tight">HRIZ</span>
          </div>
          <ThemeToggle className="text-muted-foreground" />
        </div>

        {/* Form, vertically centered */}
        <div className="flex flex-1 items-center justify-center py-10">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full max-w-[380px] animate-rise"
          >
            {/* Client Logo */}
            <div className="mb-6 flex justify-center">
              <Image
                src="/logos/client-logo.png"
                alt="Company logo"
                width={72}
                height={72}
                className="h-16 w-auto"
                priority
              />
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your credentials to access your dashboard.
              </p>
            </div>

            {/* Time/Pay Tabs (if set_includes === 2) */}
            {setIncludes === 2 && (
              <Tabs
                value={includeTabIndex === 0 ? "time" : "pay"}
                onValueChange={(value: string) =>
                  setIncludeTabIndex(value === "time" ? 0 : 1)
                }
                className="mb-5 w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="time">Time</TabsTrigger>
                  <TabsTrigger value="pay">Pay</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex flex-col gap-4">
              {/* Username Field */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hris_username">Username</Label>
                <Input
                  id="hris_username"
                  {...register("EmpId")}
                  autoComplete="username"
                  disabled={loginMutation.isPending}
                />
                {errors.EmpId && (
                  <p className="text-sm text-destructive">{errors.EmpId.message}</p>
                )}
                {settings?.set_extid === 1 && (
                  <label
                    htmlFor="external_id"
                    className="mt-1 flex items-center justify-end gap-2 text-sm text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      id="external_id"
                      {...register("external_id", {
                        setValueAs: (value: unknown) =>
                          value === true || value === "on",
                      })}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    Use External ID
                  </label>
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

              {/* Error Message */}
              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="mt-1 w-full"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setQrScannerOpen(true)}
                disabled={loginMutation.isPending || loginQrMutation.isPending}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Sign in with QR code
              </Button>
            </div>
          </form>
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-muted-foreground">
          © {year} Bluegates Cube Inc. All rights reserved.
        </p>
      </div>

      {/* Right: brand panel */}
      <div
        onMouseMove={handlePanelMouseMove}
        className="group relative hidden overflow-hidden bg-sidebar text-sidebar-foreground [--mx:50%] [--my:40%] lg:flex lg:flex-col lg:justify-center lg:p-14"
      >
        {/* Ambient depth */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-sidebar-ring/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full bg-primary/25 blur-3xl" />

          {/* Base dotted grid (dim) */}
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--sidebar-foreground)) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          {/* Dotted grid brightened only around the cursor */}
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--sidebar-ring)) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              WebkitMaskImage:
                "radial-gradient(220px circle at var(--mx) var(--my), black 0%, transparent 70%)",
              maskImage:
                "radial-gradient(220px circle at var(--mx) var(--my), black 0%, transparent 70%)",
            }}
          />

          {/* Soft glow that follows the cursor */}
          <div
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(480px circle at var(--mx) var(--my), hsl(var(--sidebar-ring) / 0.16), transparent 45%)",
            }}
          />
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Your workday, in one place.
          </h2>
          <p className="mt-4 leading-relaxed text-sidebar-muted">
            Clock in, file requests, track attendance, and view your payslips —
            all from a single dashboard.
          </p>
        </div>

        <p className="absolute bottom-14 left-14 text-sm text-sidebar-muted">
          Human Resource Information System
        </p>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={qrScannerOpen} onOpenChange={setQrScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code to sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div
              ref={scannerRef}
              className="relative flex min-h-[300px] w-full max-w-sm items-center justify-center overflow-hidden rounded-lg bg-muted"
            >
              {scannerError && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted">
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {scannerError}
                  </p>
                </div>
              )}
            </div>
            {scannerError && (
              <div className="w-full rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {scannerError}
              </div>
            )}
            {loginQrMutation.isPending && (
              <p className="text-sm text-muted-foreground">Signing in…</p>
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
