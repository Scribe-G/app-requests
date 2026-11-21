/** A message a person can read, from a server function's error. */
export function messageOf(error: unknown): string {
  if (!(error instanceof Error)) return "That didn't work. Try again.";
  try {
    const issues = JSON.parse(error.message) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    // Not a validation error: the message is already plain.
  }
  return error.message || "That didn't work. Try again.";
}
