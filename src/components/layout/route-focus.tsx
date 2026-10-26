"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** The element a URL fragment names, if any; a malformed fragment names none. */
function fragmentTarget(): HTMLElement | null {
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return id === "" ? null : document.getElementById(id);
  } catch {
    return null;
  }
}

/**
 * Moves focus to a page just navigated to: to the element the URL fragment
 * names, else to the main region (`targetId`, focusable with tabIndex -1).
 */
export function focusNewPage(targetId: string): void {
  const main = document.getElementById(targetId);
  const target = fragmentTarget() ?? main;
  // The router already scrolled to the right place.
  target?.focus({ preventScroll: true });
  // A fragment target that cannot take focus leaves it on the main region.
  if (document.activeElement !== target) {
    main?.focus({ preventScroll: true });
  }
}

interface RouteFocusProps {
  /** The focusable (tabIndex -1) element that holds each page's content. */
  readonly targetId: string;
}

/**
 * After a client navigation, moves focus to the new page: to the element the
 * URL fragment names, else to the main region. Next.js leaves focus alone, and
 * the link that had it now sits in a hidden tree (Cache Components), so
 * keyboard and screen-reader users would otherwise restart from nowhere.
 */
export function RouteFocus({ targetId }: RouteFocusProps) {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) {
      return;
    }
    previous.current = pathname;
    focusNewPage(targetId);
  }, [pathname, targetId]);

  return null;
}
