import { prisma } from "@/lib/db/prisma";

/**
 * File metadata service (Prisma-based).
 * Replaces stored procedures insert_file, delete_files (reference: sql/stored_proc.sql).
 */

export async function insertFile(params: {
  fk: string;
  filepath: string;
  filename: string;
  filetype: string;
}) {
  // A new profile picture supersedes the old one. The uploader sends
  // "profile"; "emp_profile" is the legacy C# spelling, still present in older
  // rows. Missing "profile" here left every past upload active, so lists had to
  // guess which row was current.
  if (params.filetype === "profile" || params.filetype === "emp_profile") {
    await prisma.files.updateMany({
      where: {
        fil_fk: params.fk,
        fil_type: { in: ["profile", "emp_profile"] },
        fil_status: 1,
      },
      data: { fil_status: 0 },
    });
  }
  return prisma.files.create({
    data: {
      fil_fk: params.fk,
      fil_path: params.filepath,
      fil_name: params.filename,
      fil_type: params.filetype,
    },
  });
}

export async function deleteFiles(fileId: string) {
  const id = parseInt(fileId, 10);
  if (Number.isNaN(id)) {
    throw new Error("Invalid file ID");
  }
  return prisma.files.delete({
    where: { fil_id: id },
  });
}
