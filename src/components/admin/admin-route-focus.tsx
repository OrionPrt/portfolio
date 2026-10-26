"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { focusNewPage } from "@/components/layout/route-focus";

interface AdminRouteFocusProps {
  readonly targetId: string;
}

/**
 * The admin's RouteFocus: after a client navigation, focus moves to the new
 * page's main region. The query counts too: a page of the inbox replaces the
 * link that had focus. (The public site keeps focus on a filter change.)
 */
export function AdminRouteFocus({ targetId }: AdminRouteFocusProps) {
  const route = `${usePathname()}?${useSearchParams().toString()}`;
  const previous = useRef(route);

  useEffect(() => {
    if (previous.current === route) {
      return;
    }
    previous.current = route;
    focusNewPage(targetId);
  }, [route, targetId]);

  return null;
}
