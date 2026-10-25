import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonLd } from "./json-ld";

describe("JsonLd", () => {
  it("writes a data block that stored text cannot break out of", () => {
    const { container } = render(
      <JsonLd data={{ name: "</script><img src=x onerror=alert(1)>" }} />,
    );
    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );

    expect(container.querySelector("img")).toBeNull();
    expect(script?.innerHTML).not.toContain("</script>");
    expect(JSON.parse(script?.textContent ?? "")).toEqual({
      name: "</script><img src=x onerror=alert(1)>",
    });
  });
});
