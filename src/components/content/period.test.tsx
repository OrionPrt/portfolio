import { describe, expect, it } from "vitest";

import { renderWithIntl } from "../../../test/render";
import { Period } from "./period";

describe("Period", () => {
  it("names months, and the present while it goes on", () => {
    const { container } = renderWithIntl(
      <Period startedOn="2023-03-01" endedOn={null} />,
    );

    expect(container).toHaveTextContent("mars 2023 — aujourd'hui");
  });

  it("names years alone where months would not fit", () => {
    const { container } = renderWithIntl(
      <Period startedOn="2021-09-01" endedOn="2024-06-30" isYearOnly />,
    );

    expect(container).toHaveTextContent("2021 — 2024");
  });

  it("says a single year once", () => {
    const { container } = renderWithIntl(
      <Period startedOn="2023-01-15" endedOn="2023-06-30" isYearOnly />,
    );

    expect(container).toHaveTextContent(/^2023$/);
    expect(container.querySelector("time")).toHaveAttribute(
      "dateTime",
      "2023-01-15",
    );
  });

  it("shows nothing without a start", () => {
    const { container } = renderWithIntl(
      <Period startedOn={null} endedOn={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
