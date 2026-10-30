import { postPath } from "@/features/auth/admin-paths";
import { deletePostAction } from "@/features/posts/admin-actions";
import type { PostListEntry } from "@/features/posts/admin-repository";
import { siteToday } from "@/lib/dates";

import { ADMIN_COPY } from "../copy";
import { formatDay } from "../format";
import { EntryGroup, EntryRow, type Badge } from "./entry-list";

const COPY = ADMIN_COPY.posts;

const GROUPS = ["draft", "published"] as const;

/** Its kind, its languages, and a day still to come. */
function badgesOf(post: PostListEntry, today: string): readonly Badge[] {
  return [
    { label: COPY.kinds[post.kind], tone: "muted" },
    ...post.locales.map((locale) => ({
      label: locale.toUpperCase(),
      tone: "muted" as const,
    })),
    ...(post.status === "published" &&
    post.showsOn !== null &&
    post.showsOn > today
      ? [
          {
            label: COPY.scheduled(formatDay(post.showsOn)),
            tone: "signal" as const,
          },
        ]
      : []),
  ];
}

interface PostListProps {
  readonly posts: readonly PostListEntry[];
}

/** The drafts, then the published posts from the latest. */
export function PostList({ posts }: PostListProps) {
  const today = siteToday();
  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((status) => (
        <EntryGroup
          key={status}
          headingId={`posts-${status}`}
          title={COPY.groups[status]}
          empty={COPY.empty[status]}
          entries={posts.filter((post) => post.status === status)}
          row={(post) => (
            <EntryRow
              id={post.id}
              label={post.title}
              badges={badgesOf(post, today)}
              details={
                <>
                  <span className="font-mono">{post.slug}</span>
                  {post.publishedOn !== null && (
                    <>
                      {" · "}
                      <time dateTime={post.publishedOn}>
                        {formatDay(post.publishedOn)}
                      </time>
                    </>
                  )}
                </>
              }
              editHref={postPath(post.id)}
              deleteAction={deletePostAction}
              deleteTitle={COPY.deleteTitle(post.title)}
              deleteConsequence={ADMIN_COPY.entries.deleteConsequence}
            />
          )}
        />
      ))}
    </div>
  );
}
