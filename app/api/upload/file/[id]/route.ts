import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { deleteFiles } from "@/lib/services/files.service";
import { prisma } from "@/lib/db/prisma";
import { storageService } from "@/lib/storage";

/**
 * DELETE /api/upload/file/{id}
 * Delete file from database and storage
 * Ported from UploadController.DeleteFile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authorization
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
      await verifyToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // In Next.js 15+, params is a Promise - await it
    const { id } = await params;

    // Get file record from database to get storage path
    const fileRecord = await prisma.files.findUnique({
      where: {
        fil_id: parseInt(id),
      },
      select: {
        fil_path: true,
      },
    });

    if (!fileRecord) {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Delete from storage
    try {
      await storageService.deleteFile(fileRecord.fil_path);
    } catch (error) {
      // Log but continue - database deletion is more important
      console.warn("Failed to delete file from storage:", error);
    }

    // Delete from database (stored procedure handles this)
    await deleteFiles(id);

    return NextResponse.json({
      name: "Successfully Deleted",
    });
  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
