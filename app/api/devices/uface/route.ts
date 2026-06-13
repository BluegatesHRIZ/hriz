import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

interface UFaceRecognition {
  deviceKey?: string;
  ip?: string;
  personId?: string;
  time?: string;
  date?: string;
  type?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as UFaceRecognition;

    const { ip, personId, time, date, deviceKey } = body;

    if (!personId || personId === "STRANGERBABY") {
      return NextResponse.json({ message: "Unidentified person" }, { status: 400 });
    }

    // Validate device is registered and authorized
    const device = await prisma.terminal.findFirst({
      where: {
        ter_status: 1,
        OR: [
          { ter_ip: ip ?? "" },
          { ter_biokey: deviceKey ?? "" },
        ],
      },
    });

    if (!device) {
      return NextResponse.json({ message: "Device not registered" }, { status: 400 });
    }

    const scanDate = date ? new Date(date) : new Date();
    const dateStr = scanDate.toISOString().substring(0, 10).replace(/-/g, "");
    const bioId = `${dateStr}${personId}`;

    // Deduplicate — skip if already exists for same date+person+time
    const existing = await prisma.biologs.findFirst({
      where: { bio_id: bioId },
    });
    if (existing) {
      return NextResponse.json({ message: "Duplicate record" }, { status: 200 });
    }

    await prisma.biologs.create({
      data: {
        bio_id: bioId,
        bio_emp: personId,
        bio_date: scanDate,
        bio_type: "I",
        bio_time: time ? new Date(`1970-01-01T${time}`) : new Date(),
        bio_loc: device.ter_loc ?? null,
        bio_ip: ip ?? null,
        bio_local: device.ter_loc ?? "L1",
      },
    });

    return NextResponse.json({ message: "Recorded" }, { status: 201 });
  } catch (error) {
    console.error("UFace webhook error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
