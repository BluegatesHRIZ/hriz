"use client";

import { useRef, useState } from "react";
import { Upload, Download, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/lib/hooks/use-toast";
import { apiFetch, ApiError } from "@/lib/api/client";

interface BulkRowResult {
  row: number;
  status: "success" | "error";
  error?: string;
  empId?: string;
}

interface UploadResponse {
  results: BulkRowResult[];
  successCount: number;
  errorCount: number;
}

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (!token) throw new ApiError("No token found", 401);
  return { Authorization: `Bearer ${token}` };
}

interface Props {
  type: "employees" | "schedules";
  title: string;
  description: string;
}

export function BulkUploadTab({ type, title, description }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<BulkRowResult[] | null>(null);
  const [summary, setSummary] = useState<{ successCount: number; errorCount: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResults(null);
    setSummary(null);
  }

  async function handleUpload() {
    if (!file) { toast({ title: "Please select a file.", variant: "destructive" }); return; }

    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/bulk-upload/${type}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed." }));
        toast({ title: err.message ?? "Upload failed.", variant: "destructive" });
        return;
      }

      const data: UploadResponse = await res.json();
      setResults(data.results);
      setSummary({ successCount: data.successCount, errorCount: data.errorCount });

      if (data.errorCount === 0) {
        toast({ title: `All ${data.successCount} rows processed successfully.` });
      } else {
        toast({
          title: `${data.successCount} succeeded, ${data.errorCount} failed.`,
          variant: data.successCount === 0 ? "destructive" : "default",
        });
      }
    } catch (err) {
      toast({ title: "Upload error.", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/bulk-upload/template?type=${type}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) { toast({ title: "Template download failed.", variant: "destructive" }); return; }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Template download failed.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-1" />
            Download Template
          </Button>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
              id={`bulk-file-${type}`}
            />
            <label htmlFor={`bulk-file-${type}`} className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-1" />
                  {file ? file.name : "Select .xlsx File"}
                </span>
              </Button>
            </label>
          </div>

          <Button size="sm" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? "Uploading..." : "Upload & Process"}
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      )}

      {summary && (
        <div className="flex gap-4 text-sm font-medium">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" /> {summary.successCount} succeeded
          </span>
          {summary.errorCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="w-4 h-4" /> {summary.errorCount} failed
            </span>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Row</TableHead>
                <TableHead className="w-24">Status</TableHead>
                {type === "employees" && <TableHead>Employee ID</TableHead>}
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.row}>
                  <TableCell>{r.row}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "success" ? "default" : "destructive"}>
                      {r.status === "success" ? "OK" : "Error"}
                    </Badge>
                  </TableCell>
                  {type === "employees" && <TableCell>{r.empId ?? "—"}</TableCell>}
                  <TableCell className="text-red-600 text-sm">{r.error ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
