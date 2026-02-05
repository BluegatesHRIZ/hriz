/**
 * Attendance/biolog types.
 * Matches C# BioGrid and GET /api/biolog response shape.
 */

/** One row from GET /api/biolog (mapped from stored procedure get_attendance). */
export interface BioGrid {
  bio_id: string | null;
  att_emp: string | null;
  bio_date: string | null;
  bio_emp: string | null;
  mtin: string | null;
  brkin: string | null;
  brkout: string | null;
  mtout: string | null;
  msg_aux: string | null;
  bio_logdate: string | null;
  sch_in: string | null;
  sch_out: string | null;
  current_cutoff: number;
  msg: string | null;
  filed: string | null;
}

/**
 * Raw row from Prisma $queryRaw for CALL get_attendance (generic f0, f1, ...).
 * Used only inside the stored-procedure layer before mapping to BioGrid.
 */
export interface RawBioGridRow {
  f0?: unknown;
  f1?: unknown;
  f2?: unknown;
  f3?: unknown;
  f4?: unknown;
  f5?: unknown;
  f6?: unknown;
  f7?: unknown;
  f8?: unknown;
  f9?: unknown;
  f10?: unknown;
  f11?: unknown;
  f12?: unknown;
  f13?: unknown;
  f14?: unknown;
}
