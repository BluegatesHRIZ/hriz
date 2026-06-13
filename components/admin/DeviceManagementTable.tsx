"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Pencil, CheckCircle, XCircle, Ban, RefreshCw } from "lucide-react";
import {
  DeviceDTO,
  useAdminDevices,
  useUpdateDevice,
  useDeleteDevice,
} from "@/lib/hooks/useAdminDevices";
import { DeviceFormDialog } from "./DeviceFormDialog";
import { apiFetch } from "@/lib/api/client";
import { useToast } from "@/lib/hooks/use-toast";

const TYPE_LABEL: Record<number, string> = { 0: "Standard", 1: "Biometric" };

function StatusBadge({ status }: { status: number | null }) {
  if (status === 1)
    return <Badge variant="default" className="bg-green-600 text-white">Authorized</Badge>;
  if (status === 2)
    return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

export function DeviceManagementTable() {
  const { data: devices = [], isLoading } = useAdminDevices();
  const updateDevice = useUpdateDevice();
  const deleteDevice = useDeleteDevice();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DeviceDTO | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DeviceDTO | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);

  async function handleSync(d: DeviceDTO) {
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
      toast({ title: "Sync failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
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
    setActionError(null);
    try {
      await updateDevice.mutateAsync({ ter_code: d.ter_code, ter_status: 1 });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to authorize device.");
    }
  }

  async function handleUnauthorize(d: DeviceDTO) {
    setActionError(null);
    try {
      await updateDevice.mutateAsync({ ter_code: d.ter_code, ter_status: 0 });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to unauthorize device.");
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setActionError(null);
    try {
      await deleteDevice.mutateAsync(rejectTarget.ter_code);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to reject device.");
    } finally {
      setRejectTarget(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Registered Devices</CardTitle>
          <Button size="sm" onClick={openAdd}>
            <PlusCircle className="h-4 w-4 mr-1" />
            Register Device
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {actionError && (
            <p className="px-4 py-2 text-sm text-destructive">{actionError}</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No devices registered.
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((d) => (
                  <TableRow key={d.ter_code}>
                    <TableCell className="font-mono text-sm">{d.ter_code}</TableCell>
                    <TableCell>{d.ter_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{d.ter_ip ?? "—"}</TableCell>
                    <TableCell>{d.ter_loc ?? "—"}</TableCell>
                    <TableCell>{TYPE_LABEL[d.ter_type ?? 0] ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.ter_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {d.ter_status !== 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Authorize"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleAuthorize(d)}
                            disabled={updateDevice.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {d.ter_status === 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Unauthorize"
                            className="text-yellow-600 hover:text-yellow-700"
                            onClick={() => handleUnauthorize(d)}
                            disabled={updateDevice.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {d.ter_type === 1 && d.ter_status === 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Sync records from device"
                            className="text-blue-600 hover:text-blue-700"
                            onClick={() => handleSync(d)}
                            disabled={syncingCode === d.ter_code}
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingCode === d.ter_code ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Reject / Remove"
                          className="text-destructive hover:text-destructive/80"
                          onClick={() => setRejectTarget(d)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DeviceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTarget={editTarget}
      />

      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={(v) => { if (!v) setRejectTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Device</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject and remove <strong>{rejectTarget?.ter_id ?? rejectTarget?.ter_code}</strong> from
              the device list. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmReject}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
