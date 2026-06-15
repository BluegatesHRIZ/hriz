"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useAdminSettings,
  useAdminCompany,
  usePeriodTypes,
  useUpdateSettings,
  SettingsUpdatePayload,
} from "@/lib/hooks/useAdminSettings";

// Extract "HH:mm" from a Date-like ISO string returned by Prisma for Time fields
function toTimeStr(val: Date | string | null | undefined): string {
  if (!val) return "";
  const iso = typeof val === "string" ? val : val.toISOString();
  // Prisma Time fields serialize as "1970-01-01THH:mm:ss.000Z"
  return iso.slice(11, 16);
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-4 mb-4 items-center">
      <Label className="col-span-3 text-sm font-medium text-right">{label}</Label>
      <div className="col-span-5">{children}</div>
    </div>
  );
}

export function SettingsForm() {
  const { data: settings, isLoading: loadingSettings } = useAdminSettings();
  const { data: company, isLoading: loadingCompany } = useAdminCompany();
  const { data: periodTypes = [], isLoading: loadingPeriod } = usePeriodTypes();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();

  // Company tab state
  const [comName, setComName] = useState("");
  const [comAddress, setComAddress] = useState("");
  const [comEmail, setComEmail] = useState("");
  const [extId, setExtId] = useState(false);
  const [bioBreak, setBioBreak] = useState(false);
  const [flexSched, setFlexSched] = useState(false);
  const [period, setPeriod] = useState<string>("");
  const [gracePeriod, setGracePeriod] = useState("");

  // System tab state
  const [defIn, setDefIn] = useState("");
  const [defBin, setDefBin] = useState("");
  const [defBout, setDefBout] = useState("");
  const [defOut, setDefOut] = useState("");
  const [numUsers, setNumUsers] = useState<number | "">(0);
  const [numTerminals, setNumTerminals] = useState<number | "">(0);
  const [numDevices, setNumDevices] = useState<number | "">(0);
  const [coaBefore, setCoaBefore] = useState<number | "">(0);
  const [coaAfter, setCoaAfter] = useState<number | "">(0);
  const [utmLead, setUtmLead] = useState<number | "">(0);
  const [utmAfter, setUtmAfter] = useState<number | "">(0);
  const [otmBefore, setOtmBefore] = useState<number | "">(0);
  const [otmAfter, setOtmAfter] = useState<number | "">(0);
  const [scaBefore, setScaBefore] = useState<number | "">(0);
  const [scaAfter, setScaAfter] = useState<number | "">(0);
  const [yrDays, setYrDays] = useState<number | "">(0);
  const [wkDays, setWkDays] = useState<number | "">(0);

  useEffect(() => {
    if (settings) {
      setExtId(settings.set_extid === 1);
      setBioBreak(Number(settings.set_biobreak) === 1);
      setFlexSched(Number(settings.set_flex) === 1);
      setPeriod(settings.set_period != null ? String(settings.set_period) : "");
      setGracePeriod(toTimeStr(settings.set_graceperiod));
      setDefIn(toTimeStr(settings.set_din));
      setDefBin(toTimeStr(settings.set_dbin));
      setDefBout(toTimeStr(settings.set_dbout));
      setDefOut(toTimeStr(settings.set_dout));
      setNumUsers(settings.set_user ?? 0);
      setNumTerminals(settings.set_terminal ?? 0);
      setNumDevices(settings.set_device ?? 0);
      setCoaBefore(settings.set_coabefore ?? 0);
      setCoaAfter(settings.set_coaafter ?? 0);
      setUtmLead(settings.set_utmlead ?? 0);
      setUtmAfter(settings.set_utmafter ?? 0);
      setOtmBefore(settings.set_otmbefore ?? 0);
      setOtmAfter(settings.set_otmafter ?? 0);
      setScaBefore(settings.set_scabefore ?? 0);
      setScaAfter(settings.set_scaafter ?? 0);
      setYrDays(settings.set_yrdays ?? 0);
      setWkDays(settings.set_wkdays ?? 0);
    }
  }, [settings]);

  useEffect(() => {
    if (company) {
      setComName(company.com_name ?? "");
      setComAddress(company.com_address ?? "");
      setComEmail(company.com_email ?? "");
    }
  }, [company]);

  const isLoading = loadingSettings || loadingCompany || loadingPeriod;

  async function handleSave() {
    const payload: SettingsUpdatePayload = {
      settings: {
        set_din: defIn || undefined,
        set_dbin: defBin || undefined,
        set_dbout: defBout || undefined,
        set_dout: defOut || undefined,
        set_graceperiod: gracePeriod || undefined,
        set_extid: extId ? 1 : 0,
        set_flex: flexSched ? 1 : 0,
        set_biobreak: bioBreak ? 1 : 0,
        set_period: period ? Number(period) : undefined,
        set_user: numUsers !== "" ? Number(numUsers) : undefined,
        set_terminal: numTerminals !== "" ? Number(numTerminals) : undefined,
        set_device: numDevices !== "" ? Number(numDevices) : undefined,
        set_coabefore: coaBefore !== "" ? Number(coaBefore) : undefined,
        set_coaafter: coaAfter !== "" ? Number(coaAfter) : undefined,
        set_utmlead: utmLead !== "" ? Number(utmLead) : undefined,
        set_utmafter: utmAfter !== "" ? Number(utmAfter) : undefined,
        set_otmbefore: otmBefore !== "" ? Number(otmBefore) : undefined,
        set_otmafter: otmAfter !== "" ? Number(otmAfter) : undefined,
        set_scabefore: scaBefore !== "" ? Number(scaBefore) : undefined,
        set_scaafter: scaAfter !== "" ? Number(scaAfter) : undefined,
        set_yrdays: yrDays !== "" ? Number(yrDays) : undefined,
        set_wkdays: wkDays !== "" ? Number(wkDays) : undefined,
      },
      company: {
        com_name: comName,
        com_address: comAddress,
        com_email: comEmail,
      },
    };

    updateSettings.mutate(payload, {
      onSuccess: () => toast({ title: "Settings saved successfully." }),
      onError: (e) => toast({ title: "Failed to save settings.", description: e.message, variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">HRIZ Settings</h2>

      <div className="border rounded-lg bg-card shadow-sm">
        <Tabs defaultValue="company">
          <TabsList className="w-full justify-start rounded-t-lg rounded-b-none border-b px-4 pt-2 h-auto bg-transparent gap-1">
            <TabsTrigger value="company" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
              Company
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2">
              System
            </TabsTrigger>
          </TabsList>

          {/* ── Company Tab ── */}
          <TabsContent value="company" className="p-6">
            <FieldRow label="Company Name">
              <Input value={comName} onChange={(e) => setComName(e.target.value)} />
            </FieldRow>

            <FieldRow label="Address">
              <Input value={comAddress} onChange={(e) => setComAddress(e.target.value)} />
            </FieldRow>

            <FieldRow label="Email">
              <Input type="email" value={comEmail} onChange={(e) => setComEmail(e.target.value)} />
            </FieldRow>

            <FieldRow label="Grace Period">
              <Input
                type="time"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)}
                className="w-36"
              />
            </FieldRow>

            <FieldRow label="Payroll Period">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {periodTypes.map((pt) => (
                    <SelectItem key={pt.pyt_id} value={String(pt.pyt_id)}>
                      {pt.pyt_desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Use External ID">
              <Switch checked={extId} onCheckedChange={setExtId} />
            </FieldRow>

            <FieldRow label="Bio Break In/Out">
              <Switch checked={bioBreak} onCheckedChange={setBioBreak} />
            </FieldRow>

            <FieldRow label="Late on Flexible Schedule">
              <Switch checked={flexSched} onCheckedChange={setFlexSched} />
            </FieldRow>
          </TabsContent>

          {/* ── System Tab ── */}
          <TabsContent value="system" className="p-6">
            <p className="text-sm text-muted-foreground mb-5 font-medium">Default Time Settings</p>

            <FieldRow label="Default Time In">
              <Input type="time" value={defIn} onChange={(e) => setDefIn(e.target.value)} className="w-36" />
            </FieldRow>
            <FieldRow label="Default Break In">
              <Input type="time" value={defBin} onChange={(e) => setDefBin(e.target.value)} className="w-36" />
            </FieldRow>
            <FieldRow label="Default Break Out">
              <Input type="time" value={defBout} onChange={(e) => setDefBout(e.target.value)} className="w-36" />
            </FieldRow>
            <FieldRow label="Default Time Out">
              <Input type="time" value={defOut} onChange={(e) => setDefOut(e.target.value)} className="w-36" />
            </FieldRow>

            <p className="text-sm text-muted-foreground mb-5 mt-6 font-medium">Limits</p>

            <FieldRow label="Number of Users">
              <Input type="number" value={numUsers} onChange={(e) => setNumUsers(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
            </FieldRow>
            <FieldRow label="Number of Terminals">
              <Input type="number" value={numTerminals} onChange={(e) => setNumTerminals(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
            </FieldRow>
            <FieldRow label="Number of Devices">
              <Input type="number" value={numDevices} onChange={(e) => setNumDevices(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
            </FieldRow>

            <p className="text-sm text-muted-foreground mb-5 mt-6 font-medium">Request Windows (minutes)</p>

            <div className="grid grid-cols-2 gap-x-12 gap-y-0">
              <div>
                <FieldRow label="COA Before">
                  <Input type="number" value={coaBefore} onChange={(e) => setCoaBefore(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="COA After">
                  <Input type="number" value={coaAfter} onChange={(e) => setCoaAfter(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="UTM Lead">
                  <Input type="number" value={utmLead} onChange={(e) => setUtmLead(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="UTM After">
                  <Input type="number" value={utmAfter} onChange={(e) => setUtmAfter(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="OTM Before">
                  <Input type="number" value={otmBefore} onChange={(e) => setOtmBefore(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="OTM After">
                  <Input type="number" value={otmAfter} onChange={(e) => setOtmAfter(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="SCA Before">
                  <Input type="number" value={scaBefore} onChange={(e) => setScaBefore(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
                <FieldRow label="SCA After">
                  <Input type="number" value={scaAfter} onChange={(e) => setScaAfter(e.target.value === "" ? "" : Number(e.target.value))} className="w-28" />
                </FieldRow>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-5 mt-6 font-medium">Payroll Days</p>

            <FieldRow label="Year Days">
              <Input type="number" value={yrDays} onChange={(e) => setYrDays(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
            </FieldRow>
            <FieldRow label="Work Days/Week">
              <Input type="number" value={wkDays} onChange={(e) => setWkDays(e.target.value === "" ? "" : Number(e.target.value))} className="w-36" />
            </FieldRow>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex justify-end gap-2 pb-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Close
        </Button>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
