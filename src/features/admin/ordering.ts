export type Direction = "up" | "down";

/** The order once `id` moved one step; undefined when it cannot move that way. */
export function moveItem(
  ids: readonly string[],
  id: string,
  direction: Direction,
): readonly string[] | undefined {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) {
    return undefined;
  }
  return ids.map((current, index) => {
    if (index === from) {
      return ids[to] ?? current;
    }
    return index === to ? id : current;
  });
}
