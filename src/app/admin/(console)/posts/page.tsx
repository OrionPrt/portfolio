import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ListIntro } from "@/components/admin/content/entry-pages";
import { PostList } from "@/components/admin/content/post-list";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { createPostsAdminRepository } from "@/features/posts/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.posts.title };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.posts;

export default async function PostsPage() {
  await requireAdmin();
  const loaded = await withDatabase((db) =>
    createPostsAdminRepository(db).list(),
  );

  return (
    <>
      <AdminPageHeader title={COPY.title} />
      <ListIntro
        lead={COPY.lead}
        addHref={ADMIN_PATHS.newPost}
        addLabel={COPY.add}
      />
      {loaded.ok ? (
        <PostList posts={loaded.data} />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
