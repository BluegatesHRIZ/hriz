# Agent instructions

Guidance for AI and human contributors.

## Migration flow

When migrating a feature from the C# app to the Next app:

1. **Frontend**: Inspect the C# UI for that feature and rebuild it with shadcn + React.
2. **API**: Identify the APIs used by that UI in C# and implement equivalent Next API routes.
3. **Stored procedure → service**: If an endpoint in C# used a stored procedure:
   - Look up the procedure in the **sql folder** (e.g. `stored_proc.sql` at repo root or files under `sql/`).
   - **Convert** that stored procedure into a **TypeScript function** in the appropriate **service** under `lib/services/` (e.g. `attendance.service.ts`), using **Prisma** as the ORM.
   - Have the **API route** call that service function. Do not call stored procedures from the app.

**Database logic**: We do not execute stored procedures. All such logic lives in TypeScript under `lib/services/` with Prisma.

## CRITICAL: Stored Procedure Conversion Rules

**⚠️ NEVER DEVIATE FROM STORED PROCEDURE LOGIC**

When converting stored procedures from `sql/stored_proc.sql` to TypeScript services:

1. **Exact Output Match**: The TypeScript implementation MUST produce the EXACT SAME OUTPUT as the stored procedure. Never deviate from the stored procedure's logic, conditions, calculations, or message generation.

2. **Line-by-Line Conversion**: Read the stored procedure carefully and convert it line-by-line. Pay special attention to:
   - Conditional logic (`CASE` statements, `IF` conditions)
   - Date comparisons (`@today > att_date` vs `@today >= att_date`)
   - Message generation (`msg` field) - must match exactly
   - Field calculations and aggregations
   - Default values and null handling

3. **Test Against Stored Procedure**: Always verify that the TypeScript output matches the stored procedure output for the same inputs. If there's any discrepancy, fix the TypeScript code to match the stored procedure exactly.

4. **No "Improvements"**: Do not "improve" or "optimize" the logic unless explicitly requested. The goal is to replicate the stored procedure's behavior exactly, even if the logic seems redundant or could be optimized.

5. **Reference Only**: The `sql/stored_proc.sql` file is the source of truth. When in doubt, check the stored procedure first and match it exactly.

## API and JSON types

- **Always define a TypeScript type (or interface) for every expected JSON API return.**
  Do not use `any` or untyped objects for responses from our own APIs or from services that feed them.

- **Where to put types**

  - Shared types live under `lib/types/` **divided by concern** in subfolders, each with an `index.ts` that exports the types for that concern:
    - `lib/types/auth/` – login, JWT payload, refresh token
    - `lib/types/attendance/` – biolog, attendance (e.g. BioGrid, RawBioGridRow)
    - Add new folders as needed (e.g. `requests/`, `employees/`).
  - `lib/types/index.ts` re-exports all concerns for `import { X } from "@/lib/types"`.
  - Request/response types for a single feature can live next to the feature if they are not shared.

- **How to use them**

  - API route handlers: return data that matches the response type; use that type in the handler.
  - Service layer: define a type for the raw DB result (e.g. `RawBioGridRow` for `f0,f1,...`) and a type for the mapped response (e.g. `BioGrid`); use both so the pipeline is fully typed.
  - Hooks (e.g. `useBiolog`): type the query result as the response type (e.g. `BioGrid[]`), and use that type in `apiFetch<BioGrid[]>(...)`.
  - Components: consume the typed data from hooks; no `any` or `[key: string]: any` for API data.

- **Avoid**
  - `any` for API response or request bodies.
  - `[key: string]: any` as the only shape for a DTO.
  - Returning raw Prisma/DB results without a mapped type when the API contract is known.

This keeps API contracts explicit, improves autocomplete and refactors, and prevents accidental shape changes.
