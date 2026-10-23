// Upper bounds shared by the queries, the seed and the input schemas. Plain
// constants with no server dependency, so scripts and the browser can import them.

/** Rows in one page of a public list. */
export const MAX_PAGE_SIZE = 50;

/** The furthest a page may start: keeps any offset far from bigint overflow. */
export const MAX_OFFSET = 10_000;

/** Slug listings (sitemap, 404 check): far above any portfolio. */
export const MAX_SLUGS = 1000;

export const MAX_SKILLS = 200;

/** Skills linked to one project or experience. */
export const MAX_LINKED_SKILLS = 30;
