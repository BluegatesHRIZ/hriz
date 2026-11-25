/**
 * Approval chain types (the `approvallevels` table).
 *
 * An approver approves every request type. The table still stores one row per
 * request type (al_menu M1 to M6) because request routing looks rows up by
 * type, so the API adds and removes all six together.
 */

export interface ChainApprover {
  ApproverId: string;
  /** "Last, First", null when the employee no longer exists. */
  ApproverName: string | null;
  /**
   * False when this approver is set for only some request types at this level
   * (older data). Adding them again fills in the rest.
   */
  CoversAllTypes: boolean;
  /** Request types missing at this level, as readable labels. */
  MissingTypes: string[];
}

export interface ChainLevel {
  /** 1 is asked first. */
  Level: number;
  Approvers: ChainApprover[];
}

/** GET /api/employee/{id}/approval-levels */
export interface ApprovalChain {
  EmpId: string;
  Levels: ChainLevel[];
  /**
   * True when the employee's only approver is themselves (N/A), e.g. a CEO:
   * their requests come back to them to approve.
   */
  SelfApproved: boolean;
}

/** PUT /api/employee/{id}/approval-levels/self */
export interface SetSelfApprovalResponse {
  message: string;
}

/** POST /api/employee/{id}/approval-levels */
export interface AddApproverRequest {
  ApproverId: string;
  Level: number;
}

export interface AddApproverResponse {
  message: string;
  /** Request types newly covered (0 when the approver was already fully set). */
  addedTypes: number;
}

/** DELETE /api/employee/{id}/approval-levels?approver=...&level=... */
export interface RemoveApproverResponse {
  message: string;
}
