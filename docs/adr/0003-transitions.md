# ADR-0003 — Bento hub transitions

- **Status:** Accepted
- **Date:** 2026-10-23
- **Phase:** P1 — time-boxed spike

## Context

The home page is a one-screen bento hub. Clicking a tile must expand it into a full-screen view that has a real URL (sharing, back button, SEO, works without JavaScript), in both locales with translated pathnames (`/fr/projets/x`, `/en/projects/x`).

The plan considered two building blocks: a modal over the hub through intercepting routes (`@modal/(.)projects/[slug]`), animated either with Motion (`layoutId`) or with React's `<ViewTransition>`.

## What the spike established

1. **React 19.3 `<ViewTransition>` works with App Router navigations out of the box.** Navigations are transitions, so named elements animate between the old and new page with no configuration and no JavaScript library. The browser does the animation (View Transitions API) and degrades to an instant swap where unsupported.
2. **A shared-element morph needs the source to leave while the target enters, in the same commit.** An intercepted modal keeps the tile mounted under the dialog, so no pair forms and the tile cannot grow into the view. A modal would only fade in, while bringing a parallel slot, `default.tsx`, a null catch-all, a duplicated page and dialog focus handling under Cache Components' `<Activity>`.
3. **A full-screen view as a regular page morphs as intended.** The tile and the page share one `view-transition-name`. The E2E suite records `::view-transition-group(project-demo)` being animated on the way in and through the page's back link.
4. **The browser's back and forward buttons do not animate.** Next.js does not wrap popstate navigations in a view transition: the hub comes back instantly. The in-page back link still morphs.
5. **Motion was not needed.** `layoutId` needs client components on both sides, ships tens of kilobytes of JavaScript, and fights App Router unmounting for exit animations. It was assessed on these known constraints rather than prototyped, and removed from the dependencies.
6. **Translated pathnames require the proxy on prefetches.** Skipping `next-router-prefetch` requests in the proxy made a prefetched `/fr/projets/x` resolve to the catch-all 404, which the click then reused. The proxy now runs on prefetches (ADR-0002 updated).
7. **Unknown URLs are soft 404s for now.** Under Cache Components the response starts streaming before `notFound()` runs: the status stays `200`, and Next.js adds `noindex`. Real `404`s need a proxy-level check before rendering (known routes in P3, known slugs once they live in the database).
8. **Accessible tiles use the stretched-link pattern.** Only the title is a link; its `::after` covers the tile. The link's name then matches its visible text (WCAG 2.5.3), which a whole-card link did not.

## Decision

- Full-screen views are **regular pages**. Each tile and its view share a name from `projectTransitionName(slug)` (`src/features/projects/transition-names.ts`), wrapped in `<ViewTransition share="morph" default="none">`.
- Tiles link with `prefetch`, so the destination is ready and renders in the same commit as the navigation, which the morph requires.
- The morph lasts 450 ms with `--ease-out-expo` (`::view-transition-group(.morph)` in `globals.css`). Under `prefers-reduced-motion: reduce`, every view-transition animation is cut to 0.01 ms.
- No intercepting routes and no Motion.

## Consequences

- Routing stays simple: one page per view, rendered on the server, crawlable and usable without JavaScript.
- P3 builds every tile/view pair on this pattern, adds a back link to each view, and adds the proxy-level route check that returns real `404`s.
- The browser back button returns without animation, an accepted trade-off.
- The morph only plays when the destination is prefetched: keep `prefetch` on tile links.

## Lesson learned after the spike

Cache Components keeps previously visited routes mounted but hidden (`<Activity>`), and each locale is its own copy of the root layout. A theme provider holding state per copy (next-themes) re-applied a stale theme when the visitor came back to the other language. State shared across pages and locales must therefore live outside component state: the theme now lives in localStorage and on `<html>`, behind a single store read with `useSyncExternalStore` (`src/features/theme/theme-store.ts`), which also re-syncs on back-forward cache restores and changes made in another tab. next-themes was removed.

The same mounted copies share one DOM, so anything identified by name must be unique per copy: element ids are scoped by locale (and slug), e.g. `main-fr` for the skip link target, and radio groups get a `useId()` name. With fixed values, the skip link jumped to the hidden copy and the visible theme switcher lost its checked state.
