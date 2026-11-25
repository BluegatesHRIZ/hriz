"use client"

import { useEffect, useRef, useState } from "react"
import { Clock, MonitorSmartphone, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/PasswordInput"
import { useDeviceStatus, useRegisterDevice } from "@/lib/hooks/useDevice"
import type { DeviceRegisterCredentials, DeviceStatus } from "@/lib/types/devices"

export type DeviceStep =
  | { kind: "register" }
  | { kind: "pending"; keyId: string | null; terCode: string | null }
  | { kind: "rejected" }

interface Props {
  step: DeviceStep
  /** What the person last entered, if anything; prefills the request and signs in once approved. */
  credentials: DeviceRegisterCredentials | null
  onStepChange: (step: DeviceStep) => void
  /** The request was sent with these credentials; keep them for the sign-in after approval. */
  onCredentials: (credentials: DeviceRegisterCredentials) => void
  /** The device was approved: sign in with the saved credentials. */
  onApproved: () => void
  /** Show the normal sign-in form. Administrators sign in anywhere. */
  onSignInInstead: () => void
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-[380px] animate-rise">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      {children}
    </div>
  )
}

function AdminLink({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mx-auto mt-2 block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
    >
      I&apos;m an administrator, sign in
    </button>
  )
}

export function DeviceRegistrationPanel({
  step,
  credentials,
  onStepChange,
  onCredentials,
  onApproved,
  onSignInInstead,
}: Props) {
  if (step.kind === "register") {
    return (
      <RegisterStep
        credentials={credentials}
        onRegistered={(sent, keyId, terCode, status) => {
          onCredentials(sent)
          if (status === "rejected") onStepChange({ kind: "rejected" })
          else if (status === "approved") onApproved()
          else onStepChange({ kind: "pending", keyId, terCode })
        }}
        onSignInInstead={onSignInInstead}
      />
    )
  }

  if (step.kind === "pending") {
    return (
      <PendingStep
        keyId={step.keyId}
        terCode={step.terCode}
        canSignInWhenApproved={!!credentials}
        onApproved={onApproved}
        onRejected={() => onStepChange({ kind: "rejected" })}
        onForgotten={() => onStepChange({ kind: "register" })}
        onSignInInstead={onSignInInstead}
      />
    )
  }

  return (
    <Shell icon={<ShieldX className="h-6 w-6" />} title="Device not approved">
      <p className="mb-6 text-center text-sm text-muted-foreground">
        An administrator declined this device, so you can&apos;t sign in here. If you
        need to use it, ask HR to approve it on the Register Device page.
      </p>
      <AdminLink onClick={onSignInInstead} />
    </Shell>
  )
}

function RegisterStep({
  credentials,
  onRegistered,
  onSignInInstead,
}: {
  credentials: DeviceRegisterCredentials | null
  onRegistered: (
    sent: DeviceRegisterCredentials,
    keyId: string,
    terCode: string,
    status: DeviceStatus,
  ) => void
  onSignInInstead: () => void
}) {
  // A QR sign-in that was refused already proves who this is; otherwise ask.
  const qrToken = credentials && "qrToken" in credentials ? credentials.qrToken : null
  const known = credentials && !("qrToken" in credentials) ? credentials : null

  const [empId, setEmpId] = useState(known?.EmpId ?? "")
  const [password, setPassword] = useState(known?.EmpPswd ?? "")
  const [name, setName] = useState("")
  const [missing, setMissing] = useState<string | null>(null)
  const register = useRegisterDevice()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setMissing(null)
    let sent: DeviceRegisterCredentials
    if (qrToken) {
      sent = { qrToken }
    } else {
      if (!empId.trim() || !password) {
        setMissing("Enter your username and password.")
        return
      }
      sent = { EmpId: empId.trim(), EmpPswd: password, external_id: known?.external_id }
    }
    register.mutate(
      { credentials: sent, name },
      { onSuccess: (r) => onRegistered(sent, r.keyId, r.ter_code, r.status) },
    )
  }

  const error = missing ?? register.error?.message ?? null

  return (
    <Shell icon={<MonitorSmartphone className="h-6 w-6" />} title="Register this device">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Sign-ins are only allowed on approved devices. Send a request, and you can
          sign in here once an administrator approves it.
        </p>

        {!qrToken && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="device_username">Username</Label>
              <Input
                id="device_username"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                autoComplete="username"
                disabled={register.isPending}
              />
            </div>
            <PasswordInput
              id="device_password"
              label="Password"
              register={{
                value: password,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value),
                autoComplete: "current-password",
              }}
              disabled={register.isPending}
            />
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="device_name">Device name (optional)</Label>
          <Input
            id="device_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Front desk PC"
            maxLength={100}
            disabled={register.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Helps the administrator recognise it. Leave blank to use the browser name.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
          {register.isPending ? "Sending request…" : "Send request"}
        </Button>
        <AdminLink onClick={onSignInInstead} disabled={register.isPending} />
      </form>
    </Shell>
  )
}

function PendingStep({
  keyId,
  terCode,
  canSignInWhenApproved,
  onApproved,
  onRejected,
  onForgotten,
  onSignInInstead,
}: {
  keyId: string | null
  terCode: string | null
  canSignInWhenApproved: boolean
  onApproved: () => void
  onRejected: () => void
  onForgotten: () => void
  onSignInInstead: () => void
}) {
  const { data } = useDeviceStatus(keyId)
  const status = data?.status
  const handled = useRef(false)

  // Act once per decision; the poll keeps returning the same answer.
  useEffect(() => {
    if (handled.current || !status || status === "pending") return
    handled.current = true
    if (status === "approved") onApproved()
    else if (status === "rejected") onRejected()
    else onForgotten()
  }, [status, onApproved, onRejected, onForgotten])

  const code = data?.ter_code ?? terCode

  return (
    <Shell icon={<Clock className="h-6 w-6" />} title="Waiting for approval">
      <p className="mb-4 text-center text-sm text-muted-foreground">
        This device is waiting for an administrator to approve it. This page checks
        on its own and{" "}
        {canSignInWhenApproved
          ? "signs you in once the device is approved."
          : "lets you sign in once the device is approved."}
      </p>
      {code && (
        <div className="mb-6 rounded-md border bg-muted/40 px-3 py-2.5 text-center text-sm">
          <span className="text-muted-foreground">Device code </span>
          <span className="font-mono font-medium">{code}</span>
          <p className="mt-1 text-xs text-muted-foreground">
            Give this to the administrator so they approve the right device.
          </p>
        </div>
      )}
      <AdminLink onClick={onSignInInstead} />
    </Shell>
  )
}
