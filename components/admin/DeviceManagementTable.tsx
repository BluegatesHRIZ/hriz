"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Ban,
  Check,
  CheckCircle,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/lib/hooks/use-toast";
import {
  DeviceDTO,
  useAdminDevices,
  useDeleteDevice,
  useUpdateDevice,
} from "@/lib/hooks/useAdminDevices";
import type { DeviceListFilter } from "@/lib/types/devices";
import { cn } from "@/lib/utils";
import { describeUserAgent } from "@/lib/utils/user-agent";
import { DeviceFormDialog } from "./DeviceFormDialog";

const TYPE_LABEL: Record<number, string> = { 0: "Standard", 1: "Biometric" };

/** A browser that asked to be registered from the sign-in page. */
function isBrowserRequest(d: DeviceDTO): boolean {
  return !!d.ter_reqemp;
}

function deviceName(d: DeviceDTO): string {
  return d.ter_id?.trim() || d.ter_code;
}

/** "::ffff:127.0.0.1" is an IPv4 address written as IPv6; show the familiar form. */
function displayIp(ip: string | null): string | null {
  return ip ? ip.replace(/^::ffff:/i, "") : null;
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === 1)
    return <Badge className="bg-green-600 text-white hover:bg-green-600">Authorized</Badge>;
  if (status === 2) return <Badge variant="destructive">Rejected</Badge>;
  return (
    <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
      Waiting
    </Badge>
  );
}

function CountPill({ value, highlight }: { value: number | undefined; highlight?: boolean }) {
  if (value === undefined) return null;
  return (
    <span
      className={cn(
        "ml-2 rounded-full px-1.5 py-px text-xs tabular-nums",
        highlight && value > 0
          ? "bg-amber-500 text-white"
          : "bg-muted-foreground/15 text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

const EMPTY_TEXT: Record<DeviceListFilter, string> = {
  all: "No devices yet.",
  pending: "Nothing is waiting for approval.",
  authorized: "No authorized devices.",
};

export function DeviceManagementTable() {
  const [filter, setFilter] = useState<DeviceListFilter>("all");
  const [page, setPage] = useState(1);
  const { data: devicesPage, isLoading } = useAdminDevices(filter, page);
  const devices = devicesPage?.data ?? [];
  const counts = devicesPage?.counts;
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DeviceDTO | null>(null);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);
  const busy = updateDevice.isPending || deleteDevice.isPending;

  function changeFilter(value: string) {
    setFilter(value as DeviceListFilter);
    setPage(1);
  }

  function failed(title: string, err: unknown) {
    toast({
      title,
      description: err instanceof Error ? err.message : undefined,
      variant: "destructive",
    });
  }

  async function handleSync(d: DeviceDTO) {
    const ok = await confirm({
      title: `Pull logs from ${deviceName(d)}?`,
      description: `Attendance records stored on ${d.ter_code} are copied in. Records already imported are skipped.`,
      confirmText: "Pull logs",
    });
    if (!ok) return;

    setSyncingCode(d.ter_code);
    try {
      const token = localStorage.getItem("auth_token") ?? "";
      const result = await apiFetch<{ inserted: number; total: number }>("/devices/uface/extract", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ter_code: d.ter_code }),
      });
      toast({ title: "Sync complete", description: `Inserted ${result.inserted} of ${result.total} records.` });
    } catch (err) {
      failed("Sync failed", err);
    } finally {
      setSyncingCode(null);
    }
  }

  function openAdd() {
    setEditTarget(null);
    setDialogOpen(true);
  }

  function openEdit(d: DeviceDTO) {
    setEditTarget(d);
    setDialogOpen(true);
  }

  async function handleAuthorize(d: DeviceDTO) {
    const ok = await confirm({
      title: `Authorize ${deviceName(d)}?`,
      description: isBrowserRequest(d)
        ? `Anyone with an HRIZ account can sign in on ${d.ter_code} (${describeUserAgent(d.ter_agent)}, requested by ${d.ter_reqemp_name ?? d.ter_reqemp}).`
        : d.ter_type === 1
          ? `Face scans sent by ${d.ter_code} will be accepted as attendance punches.`
          : `${d.ter_code} can be used to sign in.`,
      confirmText: "Authorize",
    });
    if (!ok) return;

    try {
      await updateDevice.mutateAsync({ ter_code: d.ter_code, ter_status: 1 });
      toast({ title: `${deviceName(d)} authorized.` });
    } catch (err) {
      failed("Could not authorize the device.", err);
    }
  }

  async function handleUnauthorize(d: DeviceDTO) {
    const ok = await confirm({
      title:
        d.ter_type === 1
          ? `Stop accepting scans from ${deviceName(d)}?`
          : `Stop sign-ins on ${deviceName(d)}?`,
      description:
        d.ter_type === 1
          ? `Punches from ${d.ter_code} will be refused until you authorize it again.`
          : `Nobody can sign in on ${d.ter_code} until you authorize it again. Anyone already signed in there stays in for up to an hour. It moves back to Waiting for approval.`,
      confirmText: "Unauthorize",
      destructive: true,
    });
    if (!ok) return;

    try {
      await updateDevice.mutateAsync({ ter_code: d.ter_code, ter_status: 0 });
      toast({ title: `${deviceName(d)} unauthorized.` });
    } catch (err) {
      failed("Could not unauthorize the device.", err);
    }
  }

  async function handleReject(d: DeviceDTO) {
    const pending = d.ter_status !== 1;
    const ok = await confirm({
      title: pending ? `Reject ${deviceName(d)}?` : `Remove ${deviceName(d)}?`,
      description: `${d.ter_code} is taken off this list and can't be used to sign in or send punches. This can't be undone.`,
      confirmText: pending ? "Reject" : "Remove",
      destructive: true,
    });
    if (!ok) return;

    try {
      await deleteDevice.mutateAsync(d.ter_code);
      toast({ title: pending ? `${deviceName(d)} rejected.` : `${deviceName(d)} removed.` });
    } catch (err) {
      failed(pending ? "Could not reject the device." : "Could not remove the device.", err);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={changeFilter}>
            <TabsList>
              <TabsTrigger value="all">
                All
                <CountPill value={counts?.all} />
              </TabsTrigger>
              <TabsTrigger value="pending">
                Waiting for approval
                <CountPill value={counts?.pending} highlight />
              </TabsTrigger>
              <TabsTrigger value="authorized">
                Authorized
                <CountPill value={counts?.authorized} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" onClick={openAdd}>
            <PlusCircle className="mr-1 h-4 w-4" />
            Add device
          </Button>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Device</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {EMPTY_TEXT[filter]}
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((d) => {
                  const pending = d.ter_status !== 1 && d.ter_status !== 2;
                  const requester = d.ter_reqemp ? d.ter_reqemp_name ?? d.ter_reqemp : null;
                  const requestedBits = [
                    requester && `by ${requester}`,
                    d.ter_agent && describeUserAgent(d.ter_agent),
                  ].filter(Boolean);
                  const location = d.ter_loc_desc ?? d.ter_loc;
                  const ip = displayIp(d.ter_ip);

                  return (
                    <TableRow key={d.ter_code} className={cn(pending && "bg-amber-500/[0.04]")}>
                      <TableCell className="pl-4">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="text-left font-medium hover:underline"
                        >
                          {deviceName(d)}
                        </button>
                        <div className="font-mono text-xs text-muted-foreground">{d.ter_code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="whitespace-nowrap">
                          {TYPE_LABEL[d.ter_type ?? 0] ?? "Unknown"}
                          {location ? ` · ${location}` : ""}
                        </div>
                        {ip && <div className="font-mono text-xs text-muted-foreground">{ip}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="whitespace-nowrap">
                          {format(new Date(d.ter_logdate), "MMM d, yyyy h:mm a")}
                        </div>
                        {requestedBits.length > 0 && (
                          <div className="text-xs text-muted-foreground" title={d.ter_agent ?? undefined}>
                            {requestedBits.join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.ter_status} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {pending && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-600 text-white hover:bg-green-700"
                                onClick={() => handleAuthorize(d)}
                                disabled={busy}
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(d)}
                                disabled={busy}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {/* Non-modal: items open dialogs, and a modal menu closing under an
                              opening dialog can leave the page unclickable. */}
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label={`More actions for ${deviceName(d)}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => openEdit(d)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit details
                              </DropdownMenuItem>
                              {d.ter_status === 1 ? (
                                <DropdownMenuItem onSelect={() => handleUnauthorize(d)} disabled={busy}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Unauthorize
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onSelect={() => handleAuthorize(d)} disabled={busy}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Authorize
                                </DropdownMenuItem>
                              )}
                              {d.ter_type === 1 && d.ter_status === 1 && (
                                <DropdownMenuItem
                                  onSelect={() => handleSync(d)}
                                  disabled={syncingCode === d.ter_code}
                                >
                                  <RefreshCw
                                    className={cn("mr-2 h-4 w-4", syncingCode === d.ter_code && "animate-spin")}
                                  />
                                  Pull logs
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => handleReject(d)}
                                disabled={busy}
                                className="text-destructive focus:text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {pending ? "Reject" : "Remove"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {devicesPage?.meta && devicesPage.meta.pageCount > 1 && (
            <div className="px-4 pb-4">
              <Pagination meta={devicesPage.meta} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTarget={editTarget}
      />
    </>
  );
}
