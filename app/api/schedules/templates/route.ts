import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  listScheduleTemplates,
  createScheduleTemplate,
  type TemplateDay,
} from "@/lib/services/schedule-template.service";

/**
 * GET  /api/schedules/templates  — list saved schedule templates.
 * POST /api/schedules/templates  — create a template. Body:
 *   { name: string, description?: string, days: TemplateDay[] }
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const templates = await listScheduleTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("List schedule templates error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      days?: TemplateDay[];
    };

    const name = (body.name ?? "").trim();
    const days = Array.isArray(body.days) ? body.days : [];
    if (!name) {
      return NextResponse.json(
        { message: "Template name is required." },
        { status: 400 }
      );
    }
    if (!days.length) {
      return NextResponse.json(
        { message: "Template must include a schedule." },
        { status: 400 }
      );
    }

    const id = await createScheduleTemplate({
      name,
      description: body.description ?? null,
      createdBy: auth.payload.name ?? null,
      days,
    });

    return NextResponse.json({ id, message: "Template saved." }, { status: 201 });
  } catch (error) {
    console.error("Create schedule template error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
