import { updateMediaAltAction } from "@/features/media/admin-actions";
import type { MediaForEdit } from "@/features/media/admin-repository";

import { ContentForm } from "./content-form";
import { MediaAltFields } from "./media-fields";

interface MediaAltFormProps {
  readonly image: MediaForEdit;
}

/** An image's texts, both at once: every page showing it follows. */
export function MediaAltForm({ image }: MediaAltFormProps) {
  return (
    <ContentForm action={updateMediaAltAction} hidden={{ id: image.id }}>
      <MediaAltFields initial={image.alt} />
    </ContentForm>
  );
}
