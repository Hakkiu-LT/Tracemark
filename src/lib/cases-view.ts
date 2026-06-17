import type { DateRange } from "react-day-picker";

export type SortField = "brand" | "risk" | "action" | "status" | "date" | "confidence";
export type SortDir = "asc" | "desc";

/** The Cases list view, persisted for the session so it survives a case-detail round-trip. */
export type CasesView = {
  search: string;
  sortBy: SortField;
  sortDir: SortDir;
  page: number;
  riskFilter: string[];
  statusFilter: string[];
  dateRange: DateRange | undefined;
  minConfidence: number;
};

export const defaultCasesView: CasesView = {
  search: "",
  sortBy: "date",
  sortDir: "desc",
  page: 1,
  riskFilter: [],
  statusFilter: [],
  dateRange: undefined,
  minConfidence: 0,
};

let cachedView: CasesView = { ...defaultCasesView };

// Set by the case-detail "Back to cases" action so filters survive that round-trip only.
// Arriving at /cases from any other navigation leaves this false and the view resets.
let restoreFlag = false;

export function saveCasesView(view: CasesView) {
  cachedView = view;
}

export function markCasesViewForRestore() {
  restoreFlag = true;
}

/** Returns the view to start with, consuming the restore flag. Fresh unless returning from a case. */
export function consumeCasesView(): CasesView {
  const view = restoreFlag ? { ...cachedView } : { ...defaultCasesView };
  restoreFlag = false;
  return view;
}
