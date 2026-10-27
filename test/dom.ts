import { waitFor, type screen } from "@testing-library/react";
import { expect } from "vitest";

type Queries = Pick<typeof screen, "getByRole">;

/**
 * A live region (alert, status) is in the page from the start, empty: wait
 * for its words, not for the element, or the check runs before the outcome.
 */
export function regionWith(
  queries: Queries,
  role: "alert" | "status",
  text: string | RegExp,
): Promise<HTMLElement> {
  return waitFor(() => {
    const region = queries.getByRole(role);
    expect(region).toHaveTextContent(text);
    return region;
  });
}
