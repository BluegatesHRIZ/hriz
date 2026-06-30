/**
 * Request status tab groups, shared by the request-grid endpoints and hooks.
 *
 * Every request type (leave, overtime, undertime, COA, schedule change, loan)
 * uses the same status codes:
 *   - pending:  0 (filed) or 4 (resent)
 *   - approved: 1
 *   - rejected: 2 (disapproved) or 3 (cancelled)
 */
export type RequestStatusGroup = "pending" | "approved" | "rejected"

const GROUPS: Record<RequestStatusGroup, number[]> = {
  pending: [0, 4],
  approved: [1],
  rejected: [2, 3],
}

/**
 * Map a status-group query param to its status codes.
 * Returns undefined for an unknown/missing group (i.e. no status filter).
 */
export function statusGroupToCodes(group?: string | null): number[] | undefined {
  if (group && group in GROUPS) return GROUPS[group as RequestStatusGroup]
  return undefined
}
