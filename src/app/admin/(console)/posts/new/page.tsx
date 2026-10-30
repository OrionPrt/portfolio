import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BackLink } from "@/components/admin/content/back-link";
import { PostForm } from "@/components/admin/content/post-form";
import { ADMIN_COPY } from "@/components/admin/copy";
import { withDatabase } from "@/db/client";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { requireAdmin } from "@/features/auth/dal";
import { loadSkillOptions } from "@/features/catalog/skill-options";
import { loadMediaOptions } from "@/features/media/media-options";
import { createPostAction } from "@/features/posts/admin-actions";

export const metadata: Metadata = { title: ADMIN_COPY.posts.newTitle };

// Blocking render: the session is checked before anything shows (ADR-0006).
export const instant = false;

const COPY = ADMIN_COPY.posts;

export default async function NewPostPage() {
  await requireAdmin();
  const [skills, media] = await Promise.all([
    withDatabase(loadSkillOptions),
    withDatabase(loadMediaOptions),
  ]);

  return (
    <>
      <AdminPageHeader title={COPY.newTitle} />
      <BackLink href={ADMIN_PATHS.posts} label={COPY.back} />
      {skills.ok && media.ok ? (
        <PostForm
          action={createPostAction}
          skills={skills.data}
          media={media.data}
        />
      ) : (
        <p className="text-danger">{ADMIN_COPY.unavailable}</p>
      )}
    </>
  );
}
