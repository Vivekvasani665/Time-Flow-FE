import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { isApiError } from "@/lib/api/client";

const FIELD_CODES: Record<string, string> = {
  USER_EMAIL_EXISTS: "email",
  ROLE_NAME_EXISTS: "name",
};

/**
 * Maps server errors onto form fields. Validation details become inline errors;
 * known conflict codes target their field; anything else becomes a toast.
 * Returns true when at least one field error was set.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): boolean {
  if (!isApiError(error)) {
    toast.error("Unexpected error", { description: "Something went wrong. Please try again." });
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

  if (!applied) {
    toast.error(error.code === "FORBIDDEN" ? "Access denied" : "Request failed", { description: error.message });
  }
  return applied;
}
