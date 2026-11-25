"use client";

import { useSyncExternalStore } from "react";

/** sessionStorage key for the Employee Management list URL, filters included. */
export const EMPLOYEE_LIST_URL_KEY = "employees:listUrl";

const BARE_LIST = "/employees";

function readListUrl(): string {
  try {
    const stored = sessionStorage.getItem(EMPLOYEE_LIST_URL_KEY);
    // Only ever navigate back to the list itself.
    return stored?.startsWith(BARE_LIST) ? stored : BARE_LIST;
  } catch {
    // Storage can be blocked; fall back to the bare list.
    return BARE_LIST;
  }
}

// The value is written by the list page before this page mounts, so there is
// nothing to subscribe to.
const subscribe = () => () => {};

/**
 * Where "back to Employee Management" should go: the list as the user last
 * left it (search, filters, page), or the bare list when nothing is stored.
 */
export function useEmployeeListUrl(): string {
  return useSyncExternalStore(subscribe, readListUrl, () => BARE_LIST);
}
