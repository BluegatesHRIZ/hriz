import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import { listPhicContribution } from "@/lib/services/contributions.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const auth = await authorizeApiRequest(request, "apiContributionPhic");
  if (!auth.ok) return auth.response;

  try {
    const { year } = await params;
    const emp = request.nextUrl.searchParams.get("emp") ?? "All";
    const rows = await listPhicContribution(Number(year), emp);
    return NextResponse.json(rows);
  } catch (error) {
    console.error("PHIC contribution report error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message: "DBErr:" + message }, { status: 500 });
  }
}
