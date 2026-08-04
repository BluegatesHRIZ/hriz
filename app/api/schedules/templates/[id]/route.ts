import { NextRequest, NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/authorization";
import {
  getScheduleTemplate,
  updateScheduleTemplate,
  deleteScheduleTemplate,
  type TemplateDay,
} from "@/lib/services/schedule-template.service";

/**
 * GET    /api/schedules/templates/[id] — full template incl. its 7 day rows.
 * PUT    /api/schedules/templates/[id] — update a template.
 * DELETE /api/schedules/templates/[id] — soft-delete a template.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const template = await getScheduleTemplate(id);
    if (!template) {
      return NextResponse.json({ message: "Template not found." }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    console.error("Get schedule template error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
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

    await updateScheduleTemplate(id, {
      name,
      description: body.description ?? null,
      days,
    });

    return NextResponse.json({ message: "Template updated." });
  } catch (error) {
    console.error("Update schedule template error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApiRequest(request, "apiScheduleManagement");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    await deleteScheduleTemplate(id);
    return NextResponse.json({ message: "Template deleted." });
  } catch (error) {
    console.error("Delete schedule template error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
