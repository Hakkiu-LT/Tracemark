// Turn a FastAPI error body into a human-readable string.
//
// FastAPI returns `detail` two different ways:
//   • our own HTTPException  → a plain string  ("tier must be …")
//   • Pydantic validation    → an array of { loc, msg, type } objects
// Passing the array straight into `new Error(...)` renders "[object Object]",
// so we normalise both shapes here.
export function apiErrorMessage(data: unknown, status: number): string {
  const detail = (data as { detail?: unknown })?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return first?.msg || "Please check the form and try again.";
  }

  return `Something went wrong (error ${status}). Please try again.`;
}
