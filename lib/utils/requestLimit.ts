/**
 * Request date limits – mirrors HRIS_API.Shared.Utils.RequestLimit.
 * Return true if the date should be DISABLED in the calendar.
 * 
 * C# comment: "if results is TRUE date is DISABLED, if FALSE date in ENABLED"
 * Returns true if date is NOT allowed (should be disabled/rejected).
 */

function toDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Leave: before (days in past), after (days in future), lead (days from today allowed as "lead").
 * Returns true if the date should be disabled/rejected (matches C# RequestLimit.BeforeAfterLead exactly).
 * 
 * Matches C# logic line-by-line.
 */
export function beforeAfterLead(
  dateRaw: Date,
  before: number,
  after: number,
  lead: number,
): boolean {
  const date = toDate(dateRaw);
  const today = toDate(new Date());
  const beforeDate = toDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - before),
  );
  const afterDate = toDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + after),
  );
  const leadDate = toDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + lead),
  );
  let result = false;

  if (date < today) {
    // Before (past dates)
    if (before > 0) {
      result = date < beforeDate;
    } else if (before === 0) {
      return true; // Reject all past dates
    } else if (before < 0) {
      result = false; // Allow past dates
    }
  } else if (date > today) {
    // Lead (future dates)
    if (lead > 0) {
      // Lead - has limit
      if (lead > 0) {
        result = date <= leadDate; // Note: C# sets result = true when within lead
      } else if (lead < 0) {
        result = false;
      }

      if (!result) {
        // Date is beyond lead time
        if (after > 0) {
          return date > afterDate;
        } else if (after === 0) {
          return true; // Reject all beyond lead
        } else if (after < 0) {
          result = false; // Allow if after < 0
        }
      }
    } else {
      // Lead - has no limit or disabled
      if (after > 0) {
        result = date > afterDate;
      } else if (after < 0) {
        result = true; // Reject if after < 0
      }
    }
  } else {
    // Today
    result = false; // Allow today
  }

  return result;
}

/**
 * COA/Undertime: before (days in past), after (days in future).
 * Returns true if the date should be disabled/rejected (matches C# RequestLimit.BeforeAfter).
 * 
 * Matches C# logic line-by-line.
 */
export function beforeAfter(
  dateRaw: Date,
  before: number,
  after: number,
): boolean {
  const date = toDate(dateRaw);
  const today = toDate(new Date());
  const beforeDate = toDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - before),
  );
  const afterDate = toDate(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + after),
  );
  let result = false;

  if (date < today) {
    // Before (past dates)
    if (before > 0) {
      result = date < beforeDate;
    } else if (before === 0) {
      return true; // Reject all past dates
    } else if (before < 0) {
      result = false; // Allow past dates
    }
  } else if (date > today) {
    // After (future dates)
    if (after > 0) {
      result = date > afterDate;
    } else if (after === 0) {
      return true; // Reject all future dates
    } else if (after < 0) {
      result = false; // Allow future dates
    }
  } else {
    // Today
    result = false; // Allow today
  }

  return result;
}
