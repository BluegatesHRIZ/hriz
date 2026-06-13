import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { prisma } from "@/lib/db/prisma";

interface UFaceRecord {
  personId?: string;
  time?: string;
  date?: string;
  type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const body = await request.json() as { ter_code: string; startTime?: string; endTime?: string };
    if (!body.ter_code) {
      return NextResponse.json({ message: "ter_code required" }, { status: 400 });
    }

    const device = await prisma.terminal.findUnique({ where: { ter_code: body.ter_code } });
    if (!device) {
      return NextResponse.json({ message: "Device not found" }, { status: 404 });
    }

    const pass = device.ter_biopass ?? "";
    const ip = device.ter_ip ?? "";
    const startTime = body.startTime ?? new Date(Date.now() - 86_400_000).toISOString().replace("T", " ").substring(0, 19);
    const endTime = body.endTime ?? new Date().toISOString().replace("T", " ").substring(0, 19);

    const url = `http://${ip}:8090/newFindRecords?personId=-1&pass=${encodeURIComponent(pass)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&length=1000`;

    let records: UFaceRecord[] = [];
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`UFace responded ${res.status}`);
      const json = await res.json() as { data?: UFaceRecord[] };
      records = json.data ?? [];
    } catch (fetchErr) {
      return NextResponse.json({ message: "Failed to reach device", detail: String(fetchErr) }, { status: 502 });
    }

    let inserted = 0;
    for (const r of records) {
      const personId = r.personId;
      if (!personId || personId === "STRANGERBABY") continue;

      const scanDate = r.date ? new Date(r.date) : new Date();
      const dateStr = scanDate.toISOString().substring(0, 10).replace(/-/g, "");
      const timeStr = r.time ?? "000000";
      const bioId = `${dateStr}${personId}`;

      const exists = await prisma.biologs.findUnique({ where: { bio_id: bioId } });
      if (exists) continue;

      await prisma.biologs.create({
        data: {
          bio_id: bioId,
          bio_emp: personId,
          bio_date: scanDate,
          bio_type: r.type ?? "I",
          bio_time: new Date(`1970-01-01T${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`),
          bio_loc: device.ter_loc ?? null,
          bio_ip: ip,
          bio_local: device.ter_loc ?? "L1",
        },
      });
      inserted++;
    }

    await prisma.terminal.update({
      where: { ter_code: body.ter_code },
      data: { ter_logdate: new Date() },
    });

    return NextResponse.json({ inserted, total: records.length });
  } catch (error) {
    console.error("UFace extract error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
