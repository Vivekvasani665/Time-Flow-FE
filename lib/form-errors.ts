import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/client";
import { notifyError } from "@/lib/notify";

const FIELD_CODES: Record<string, string> = {
  USER_EMAIL_EXISTS: "email",
  ROLE_NAME_EXISTS: "name",
};

/**
 * Maps server errors onto form fields. Validation details become inline errors;
 * known conflict codes target their field; anything else becomes a status-based toast.
 * Returns true when at least one field error was set.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): boolean {
  if (!isApiError(error)) {
    notifyError(error);
    return false;
  }

  let applied = false;
  const conflictField = FIELD_CODES[error.code];
  if (conflictField && fields.includes(conflictField)) {
    setError(conflictField as Path<T>, { type: "server", message: error.message }, { shouldFocus: true });
    applied = true;
  }

  if (error.code === "VALIDATION_ERROR") {
    for (const detail of error.details) {
      const field = detail.path.split(".")[0];
      if (field && fields.includes(field)) {
        setError(field as Path<T>, { type: "server", message: detail.message }, { shouldFocus: !applied });
        applied = true;
      }
    }
  }

  // Status-based title and a message that is safe by construction (see lib/api/errors.ts).
  if (!applied) notifyError(error);
  return applied;
}
