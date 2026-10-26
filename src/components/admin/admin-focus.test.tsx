import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/admin", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

import { RouteFocus } from "@/components/layout/route-focus";

import { AdminPageHeader } from "./admin-page-header";
import { AdminRouteFocus } from "./admin-route-focus";

interface FrameProps {
  readonly children: ReactNode;
}

/** A page with a link that had focus, a main region and a section. */
function Page({ children }: FrameProps) {
  return (
    <>
      <button type="button">Lien cliqué</button>
      <main id="main" tabIndex={-1}>
        <h2 id="section" tabIndex={-1}>
          Section
        </h2>
      </main>
      {children}
    </>
  );
}

describe("focus after a client navigation", () => {
  beforeEach(() => {
    navigation.pathname = "/admin";
    navigation.search = "";
    window.location.hash = "";
  });

  it("leaves focus alone on the first render, then moves it to the new page", () => {
    const { rerender } = render(
      <Page>
        <RouteFocus targetId="main" />
      </Page>,
    );
    screen.getByRole("button").focus();
    expect(screen.getByRole("button")).toHaveFocus();

    navigation.pathname = "/admin/messages";
    rerender(
      <Page>
        <RouteFocus targetId="main" />
      </Page>,
    );

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("goes to the element the fragment names, when it can take focus", () => {
    const { rerender } = render(
      <Page>
        <RouteFocus targetId="main" />
      </Page>,
    );
    window.location.hash = "#section";
    navigation.pathname = "/admin/security";
    rerender(
      <Page>
        <RouteFocus targetId="main" />
      </Page>,
    );

    expect(screen.getByRole("heading", { name: "Section" })).toHaveFocus();
  });

  it("in the admin, follows a change of query too (a page of the inbox)", () => {
    navigation.pathname = "/admin/messages";
    const { rerender } = render(
      <Page>
        <AdminRouteFocus targetId="main" />
      </Page>,
    );
    screen.getByRole("button").focus();
    rerender(
      <Page>
        <AdminRouteFocus targetId="main" />
      </Page>,
    );
    expect(screen.getByRole("button")).toHaveFocus();

    navigation.search = "page=2";
    rerender(
      <Page>
        <AdminRouteFocus targetId="main" />
      </Page>,
    );

    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("AdminPageHeader", () => {
  it("gives the page its only h1", () => {
    render(<AdminPageHeader title="Messages" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Messages",
    );
  });
});
