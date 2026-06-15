"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBiolog } from "@/lib/hooks/useBiolog";
import { useTeamBiolog } from "@/lib/hooks/useTeamBiolog";
import { useSettings } from "@/lib/hooks/useSettings";
import { useClockAttendance } from "@/lib/hooks/useAttendance";
import { CardWithHeader } from "@/components/cards/CardWithHeader";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/hooks/use-toast";
import type { BioGrid } from "@/lib/types/attendance";

const ITEMS_PER_PAGE = 5;

export function Biolog() {
  const router = useRouter();
  const { data: biologs, isLoading } = useBiolog();
  const { data: teamBiologs, isLoading: isLoadingTeam } = useTeamBiolog();
  const { data: settings } = useSettings();
  const clockMutation = useClockAttendance();
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [formDialog, setFormDialog] = useState(false);
  const [selectedBio, setSelectedBio] = useState<BioGrid | null>(null);

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [biologs?.length]);

  const showBreakButtons = settings?.set_biobreak !== 0;

  const handleRowClick = (bio: BioGrid) => {
    const msg = bio.msg ?? "";
    if (msg && bio.filed !== "F") {
      if (
        msg === "Undertime" ||
        msg.includes("Missing Log") ||
        msg === "Late" ||
        msg === "Absent"
      ) {
        setSelectedBio(bio);
        setFormDialog(true);
      }
    }
  };

  const handleNavigateToAttendanceChange = () => {
    if (!selectedBio) return;
    const msg = selectedBio.msg ?? "";
    const type =
      !selectedBio.mtin || msg === "Absent" || msg === "Late" ? "I" : "O";
    const sched =
      !selectedBio.mtin || msg === "Absent" || msg === "Late"
        ? selectedBio.sch_in
        : selectedBio.sch_out;
    const date = selectedBio.bio_date
      ? new Date(selectedBio.bio_date).toISOString().split("T")[0]
      : "";

    setFormDialog(false);
    router.push(
      `/request/attendance-change/apply?date=${date}&type=${type}&sched=${sched || ""}`
    );
  };

  const handleNavigateToLeave = () => {
    if (!selectedBio) return;
    const date = selectedBio.bio_date
      ? new Date(selectedBio.bio_date).toISOString().split("T")[0]
      : "";

    setFormDialog(false);
    router.push(`/request/leave/apply?date=${date}`);
  };

  const handleNavigateToUndertime = () => {
    if (!selectedBio) return;
    const date = selectedBio.bio_date
      ? new Date(selectedBio.bio_date).toISOString().split("T")[0]
      : "";

    setFormDialog(false);
    router.push(`/request/undertime/apply?date=${date}`);
  };

  const handleClock = async (type: "I" | "O" | "BI" | "BO") => {
    if (!isEnabled) return;

    setIsEnabled(false);
    try {
      // Use client's local date/time (matches C# DateTime.Now on client)
      const now = new Date();
      const clientDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const clientTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      const result = await clockMutation.mutateAsync({
        attendanceType: type,
        forYesterday: false,
        clientDate,
        clientTime,
      });
      toast({
        title: "Success",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to record attendance",
        variant: "destructive",
      });
    } finally {
      setIsEnabled(true);
    }
  };

  return (
    <CardWithHeader
      title="Attendance"
      icon={<Clock className="w-6 h-6" />}
      iconColor="#ee8fcb"
      className="mb-4"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <p>Loading...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleClock("I")}
              disabled={!isEnabled || clockMutation.isPending}
            >
              Clock in
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={() => handleClock("O")}
              disabled={!isEnabled || clockMutation.isPending}
            >
              Clock out
            </Button>
          </div>

          {showBreakButtons && (
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                onClick={() => handleClock("BI")}
                disabled={!isEnabled || clockMutation.isPending}
              >
                Break in
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={() => handleClock("BO")}
                disabled={!isEnabled || clockMutation.isPending}
              >
                Break out
              </Button>
            </div>
          )}

          <Tabs defaultValue="personal" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="team">My Team</TabsTrigger>
            </TabsList>
            <TabsContent value="personal" className="mt-4">
              {biologs && biologs.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {biologs
                      .slice(
                        (currentPage - 1) * ITEMS_PER_PAGE,
                        currentPage * ITEMS_PER_PAGE
                      )
                      .map((bio) => {
                        const dateStr = bio.bio_date
                          ? new Date(bio.bio_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A";
                        const isPrevCutoff = bio.current_cutoff === 0;
                        const msg = bio.msg ?? "";
                        const canSelect =
                          msg &&
                          bio.filed !== "F" &&
                          (msg === "Undertime" ||
                            msg.includes("Missing Log") ||
                            msg === "Late" ||
                            msg === "Absent");
                        return (
                          <div
                            key={bio.bio_id}
                            onClick={() => canSelect && handleRowClick(bio)}
                            className={`text-sm border-b pb-2 cursor-pointer transition-colors ${
                              isPrevCutoff ? "opacity-70" : ""
                            } ${
                              canSelect
                                ? "hover:bg-muted/50 hover:shadow-sm rounded px-2 py-1 -mx-2 -my-1"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-semibold">{dateStr}</p>
                              {isPrevCutoff && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                  Previous
                                </span>
                              )}
                            </div>
                            <p className="text-muted-foreground">
                              In: {bio.mtin ?? "N/A"} | Out: {bio.mtout ?? "N/A"}
                            </p>
                            {bio.msg && (
                              <p
                                className={`text-xs mt-1 ${
                                  bio.msg === "Absent" ||
                                  bio.msg.includes("Missing Log")
                                    ? "text-red-600"
                                    : bio.msg === "Late"
                                    ? "text-orange-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {bio.msg}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {biologs.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, biologs.length)}{" "}
                        of {biologs.length} records
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-foreground">
                          Page {currentPage} of{" "}
                          {Math.ceil(biologs.length / ITEMS_PER_PAGE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(
                                Math.ceil(biologs.length / ITEMS_PER_PAGE),
                                p + 1
                              )
                            )
                          }
                          disabled={
                            currentPage >= Math.ceil(biologs.length / ITEMS_PER_PAGE)
                          }
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No attendance records
                </p>
              )}
            </TabsContent>
            <TabsContent value="team" className="mt-4">
              {isLoadingTeam ? (
                <div className="flex items-center justify-center py-4">
                  <p>Loading...</p>
                </div>
              ) : teamBiologs && teamBiologs.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {teamBiologs
                      .slice(
                        (teamPage - 1) * ITEMS_PER_PAGE,
                        teamPage * ITEMS_PER_PAGE
                      )
                      .map((bio) => {
                        const dateStr = bio.bio_date
                          ? new Date(bio.bio_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "N/A";
                        return (
                          <div
                            key={bio.bio_id}
                            className="text-sm border-b pb-2"
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-semibold">{bio.emp_name ?? "N/A"}</p>
                              <p className="text-xs text-muted-foreground">{dateStr}</p>
                            </div>
                            <p className="text-muted-foreground">
                              In: {bio.mtin ?? "N/A"} | Out: {bio.mtout ?? "N/A"}
                            </p>
                            {bio.msg && (
                              <p
                                className={`text-xs mt-1 ${
                                  bio.msg === "Absent" ||
                                  bio.msg.includes("Missing Log")
                                    ? "text-red-600"
                                    : bio.msg === "Late"
                                    ? "text-orange-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {bio.msg}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {teamBiologs.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground">
                        Showing {(teamPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                        {Math.min(teamPage * ITEMS_PER_PAGE, teamBiologs.length)}{" "}
                        of {teamBiologs.length} records
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTeamPage((p) => Math.max(1, p - 1))}
                          disabled={teamPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-foreground">
                          Page {teamPage} of{" "}
                          {Math.ceil(teamBiologs.length / ITEMS_PER_PAGE)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setTeamPage((p) =>
                              Math.min(
                                Math.ceil(teamBiologs.length / ITEMS_PER_PAGE),
                                p + 1
                              )
                            )
                          }
                          disabled={
                            teamPage >= Math.ceil(teamBiologs.length / ITEMS_PER_PAGE)
                          }
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No team attendance records
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      <Dialog open={formDialog} onOpenChange={setFormDialog}>
        <DialogContent className="max-h-[35rem] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Suggested Forms ({selectedBio?.msg ?? ""})
            </DialogTitle>
            <DialogDescription>
              Select a form to file based on the attendance issue.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            {(selectedBio?.msg === "Absent" ||
              selectedBio?.msg?.includes("Missing Log") ||
              selectedBio?.msg === "Late") && (
              <Button
                onClick={handleNavigateToAttendanceChange}
                className="w-full"
              >
                Attendance Change
              </Button>
            )}
            {selectedBio?.msg === "Absent" && (
              <Button onClick={handleNavigateToLeave} className="w-full">
                Leave
              </Button>
            )}
            {selectedBio?.msg === "Undertime" && (
              <Button onClick={handleNavigateToUndertime} className="w-full">
                Undertime
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setFormDialog(false);
                setSelectedBio(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardWithHeader>
  );
}
