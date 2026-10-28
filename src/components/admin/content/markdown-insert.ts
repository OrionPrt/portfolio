/** The line breaks that set a block apart on this side of it. */
function breaksBefore(before: string): string {
  if (before === "" || before.endsWith("\n\n")) {
    return "";
  }
  return before.endsWith("\n") ? "\n" : "\n\n";
}

function breaksAfter(after: string): string {
  if (after === "") {
    return "\n";
  }
  if (after.startsWith("\n\n")) {
    return "";
  }
  return after.startsWith("\n") ? "\n" : "\n\n";
}

/**
 * A Markdown block (an image) put where the caret is, over any selection, on
 * lines of its own: the paragraphs around stay paragraphs. The caret goes
 * right after it.
 */
export function insertBlock(
  text: string,
  start: number,
  end: number,
  block: string,
): { readonly text: string; readonly caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const inserted = `${breaksBefore(before)}${block}${breaksAfter(after)}`;
  return {
    text: `${before}${inserted}${after}`,
    caret: before.length + inserted.length,
  };
}
