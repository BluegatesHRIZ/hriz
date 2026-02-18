import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt-edge";
import { storageService } from "@/lib/storage";
import { insertFile } from "@/lib/services/files.service";
import { randomBytes } from "crypto";
import { extname } from "path";

const ALLOWED_FILE_TYPES = [".png", ".jpeg", ".jpg", ".pdf", ".xlsx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/upload/{path}/{fk}/{type}
 * Upload file(s) to S3 storage
 * Ported from UploadController.UploadFile
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string; fk: string; type: string }> }
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
    const { path: pathParam, fk, type } = await params;

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { message: "No files provided" },
        { status: 400 }
      );
    }

    const uploadedFiles: Array<{ name: string; path: string }> = [];

    for (const file of files) {
      // Validate file type
      const fileExt = extname(file.name).toLowerCase();
      if (!ALLOWED_FILE_TYPES.includes(fileExt)) {
        return NextResponse.json(
          {
            message: `File type ${fileExt} is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(
              ", "
            )}`,
          },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            message: `File ${file.name} exceeds maximum size of ${
              MAX_FILE_SIZE / 1024 / 1024
            }MB`,
          },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      // Handle Excel files specially (process and delete, don't store)
      // Dynamic import keeps xlsx out of the main Worker bundle (helps stay under 3 MiB on free plan)
      if (fileExt === ".xlsx") {
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(fileBuffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Return Excel data (matching C# behavior - file is processed and not stored)
          return NextResponse.json({
            data: jsonData,
            sheetName: sheetName,
          });
        } catch (error) {
          return NextResponse.json(
            {
              message: `Failed to read Excel file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
            { status: 400 }
          );
        }
      }

      // Generate unique filename (short format like C# Path.GetRandomFileName)
      // C# uses Path.GetRandomFileName() which generates ~11 char base + extension
      // We'll use a shorter random string to match the format
      const randomPart = randomBytes(8).toString("hex"); // 16 chars hex = shorter than 32
      const uniqueFilename = `${randomPart}${fileExt}`;
      const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Upload to S3 storage
      const storagePath = await storageService.uploadFile(
        fileBuffer,
        pathParam,
        uniqueFilename
      );

      // Store relative path in database (matching C# format: "./201/{path}/{filename}")
      // The database column is VARCHAR(45), so we need to keep it short
      // C# stores: "./201/employee/abc123.jpg" format
      const dbFilePath = `./201/${pathParam}/${uniqueFilename}`;

      // Verify it fits in VARCHAR(45)
      if (dbFilePath.length > 45) {
        throw new Error(
          `File path too long (${dbFilePath.length} chars, max 45). Path: ${dbFilePath}`
        );
      }

      // Insert file metadata into database
      await insertFile({
        fk: fk,
        filepath: dbFilePath, // Store relative path, not full storage path
        filename: sanitizedOriginalName,
        filetype: type,
      });

      uploadedFiles.push({
        name: file.name,
        path: uniqueFilename,
      });
    }

    return NextResponse.json(uploadedFiles);
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
