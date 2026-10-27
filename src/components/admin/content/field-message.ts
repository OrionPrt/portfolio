import type { FieldProblem } from "@/features/admin/form-input";

import { ADMIN_COPY } from "../copy";

const PROBLEMS = ADMIN_COPY.content.problems;

/**
 * The words for a field's problem: `invalid` names what the field expects,
 * `taken` what another entry already holds.
 */
export function messageOf(
  problem: FieldProblem | undefined,
  invalid: string = PROBLEMS.invalid,
  taken: string = PROBLEMS.taken,
): string | undefined {
  switch (problem?.problem) {
    case undefined:
      return undefined;
    case "required":
      return PROBLEMS.required;
    case "too_long":
      return PROBLEMS.tooLong(problem.max);
    case "invalid":
      return invalid;
    case "taken":
      return taken;
  }
}
