export type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

const RLS_PATTERN = /row-level security|permission denied|violates row-level/i;

/**
 * Converts a PostgREST/Postgres error into a message safe to show to the user.
 * Our RPCs raise deliberate, user-facing messages; infrastructure errors are
 * replaced with a generic explanation.
 */
export function describeDbError(
  error: DatabaseError | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;

  switch (error.code) {
    case "42501":
      if (error.message && !RLS_PATTERN.test(error.message)) {
        return error.message;
      }
      return "You do not have permission to do that.";
    case "22023":
    case "23514":
      return error.message ?? "Some values are invalid.";
    case "23505":
      return "That name is already in use. Try a different one.";
    case "23503":
      return "That record is no longer available.";
    case "23502":
      return "Some required information is missing.";
    case "22P02":
      return "Some values are invalid.";
    case "P0002":
      return "The requested record was not found.";
    default:
      return fallback;
  }
}
