"use client";

import { useEffect } from "react";

import { ADMIN_COPY } from "../copy";

/**
 * A link that leaves the page for another of the site: not a new tab, a
 * download or a fragment of this very page (the skip link).
 */
function followedLink(event: MouseEvent): HTMLAnchorElement | undefined {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return undefined;
  }
  const link =
    event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.target === "_blank" ||
    link.hasAttribute("download")
  ) {
    return undefined;
  }
  const { location } = window;
  const isSamePage =
    link.pathname === location.pathname && link.search === location.search;
  return link.origin === location.origin && !(isSamePage && link.hash !== "")
    ? link
    : undefined;
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  event.preventDefault();
}

/** Caught before the router sees the click; one question, however many forms. */
function onClick(event: MouseEvent): void {
  const link = followedLink(event);
  if (link !== undefined && !window.confirm(ADMIN_COPY.content.leave)) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/** The forms of the page holding unsaved changes: the listeners stay while one does. */
const dirtyForms = new Set<symbol>();

function markDirty(form: symbol): void {
  if (dirtyForms.size === 0) {
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, { capture: true });
  }
  dirtyForms.add(form);
}

function markClean(form: symbol): void {
  dirtyForms.delete(form);
  if (dirtyForms.size === 0) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("click", onClick, { capture: true });
  }
}

/**
 * While a form holds unsaved changes, leaving asks first: the browser's own
 * prompt on reload or close, a confirmation before following a link.
 */
export function useUnsavedGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }
    const form = Symbol("unsaved form");
    markDirty(form);
    return () => {
      markClean(form);
    };
  }, [isDirty]);
}
