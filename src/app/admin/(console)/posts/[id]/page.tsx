import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { EntryMissing } from "@/components/admin/content/entry-pages";
import { DeleteEntry } from "@/components/admin/content/list-actions";
import { PostForm } from "@/components/admin/content/post-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { loadSkillOptions } from "@/features/catalog/skill-options";
import { loadMediaOptions } from "@/features/media/media-options";
import {
  deletePostAction,
  updatePostAction,
} from "@/features/posts/admin-actions";
import { createPostsAdminRepository } from "@/features/posts/admin-repository";

export const metadata: Metadata = { title: ADMIN_COPY.posts.editTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.posts;

export default async function EditPostPage({
  params,
}: PageProps<"/admin/posts/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [found, skills, media] = await Promise.all([
    withDatabase((db) => createPostsAdminRepository(db).find(id)),
    withDatabase(loadSkillOptions),
    withDatabase(loadMediaOptions),
  ]);
  const post = found.ok ? found.data : undefined;
  const isAvailable = found.ok && skills.ok && media.ok;
  const title =
    post === undefined
      ? ""
      : (post.translations.fr?.title ??
        post.translations.en?.title ??
        post.slug);

  return (
    <>
      <AdminPageHeader title={COPY.editTitle} />
      <BackLink href={ADMIN_PATHS.posts} label={COPY.back} />
      {post !== undefined && skills.ok && media.ok ? (
        <>
          {/* Keyed: another post's page keeps its own form state. */}
          <PostForm
            key={post.id}
            action={updatePostAction}
            post={post}
            skills={skills.data}
            media={media.data}
          />
          <div className="border-line border-t pt-6">
            <DeleteEntry
              action={deletePostAction}
              id={post.id}
              label={title}
              title={COPY.deleteTitle(title)}
              afterDelete={ADMIN_PATHS.posts}
              consequence={ADMIN_COPY.entries.deleteConsequence}
            />
          </div>
        </>
      ) : (
        <EntryMissing isAvailable={isAvailable} notFound={COPY.notFound} />
      )}
    </>
  );
}
