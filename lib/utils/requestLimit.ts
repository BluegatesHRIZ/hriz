/**
 * Request date limits – mirrors HRIS_API.Shared.Utils.RequestLimit.
 * Return true if the date should be DISABLED in the calendar.
 */

function toDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Leave: before (days in past), after (days in future), lead (days from today allowed as "lead").
 * Returns true if the date should be disabled.
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

  if (date < today) {
    if (before > 0) return date < beforeDate;
    if (before === 0) return true;
    return false;
  }

  if (date > today) {
    if (lead > 0) {
      const result = date <= leadDate;
      if (!result) {
        if (after > 0) return date > afterDate;
        if (after === 0) return true;
        return false;
      }
      return result;
    }
    if (after > 0) return date > afterDate;
    if (after < 0) return true;
  }

  return false;
}
