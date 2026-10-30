// Directives in stored Markdown (ADR-0008): `:::note`, `:::warning` and
// `:::details` become an aside of their kind; anything else reads as the text
// it was written as. A directive's attributes (`{.class #id style=…}`) are
// never kept, so no author-given attribute reaches the page.

import type {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from "mdast-util-directive";
import type { Parent, PhrasingContent, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export const CALLOUT_KINDS = ["note", "warning", "details"] as const;

export type CalloutKind = (typeof CALLOUT_KINDS)[number];

type Directive = ContainerDirective | LeafDirective | TextDirective;

function isCallout(name: string): name is CalloutKind {
  return CALLOUT_KINDS.some((kind) => kind === name);
}

function isDirective(node: { readonly type: string }): node is Directive {
  return (
    node.type === "containerDirective" ||
    node.type === "leafDirective" ||
    node.type === "textDirective"
  );
}

/** A container's `[label]`: its first paragraph, marked as such by the parser. */
function labelOf(
  directive: ContainerDirective,
): ContainerDirective["children"][number] | undefined {
  const [first] = directive.children;
  return first?.type === "paragraph" && first.data?.directiveLabel === true
    ? first
    : undefined;
}

/** `:::note[Title]` → `<div data-callout="note"><p data-callout-title>Title</p>…`. */
function markCallout(directive: ContainerDirective, kind: CalloutKind): void {
  const label = labelOf(directive);
  directive.data = {
    hName: kind === "details" ? "details" : "div",
    hProperties: kind === "details" ? {} : { dataCallout: kind },
  };
  if (label !== undefined) {
    label.data = {
      hName: kind === "details" ? "summary" : "p",
      hProperties: kind === "details" ? {} : { dataCalloutTitle: "" },
    };
  }
}

/** What an unknown inline or leaf directive was written as: `:name[label]`. */
function asWritten(
  directive: LeafDirective | TextDirective,
): readonly PhrasingContent[] {
  const marker = directive.type === "leafDirective" ? "::" : ":";
  const label: readonly PhrasingContent[] =
    directive.children.length === 0
      ? []
      : [
          { type: "text", value: "[" },
          ...directive.children,
          { type: "text", value: "]" },
        ];
  return [{ type: "text", value: `${marker}${directive.name}` }, ...label];
}

/**
 * The callouts, and every other directive back to its text: "Raison:valeur"
 * stays as written. Unified plugins rewrite the tree they are handed.
 */
export const remarkCallouts: Plugin<[], Root> = () => (tree) => {
  visit(tree, (node, index, parent: Parent | undefined) => {
    if (!isDirective(node)) {
      return undefined;
    }
    if (node.type === "containerDirective") {
      if (isCallout(node.name)) {
        markCallout(node, node.name);
      } else {
        // Its content stays; nothing marks it.
        node.data = { hName: "div", hProperties: {} };
      }
      return undefined;
    }
    if (parent === undefined || index === undefined) {
      return undefined;
    }
    const written = asWritten(node);
    parent.children.splice(
      index,
      1,
      ...(node.type === "leafDirective"
        ? [{ type: "paragraph" as const, children: [...written] }]
        : written),
    );
    // Visited again from the first node put back: a directive in its label
    // (`:a[:b[c]]`) is restored too. Text never matches, so this ends.
    return index;
  });
};
