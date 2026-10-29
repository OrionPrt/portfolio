"use server";

import type { ContentFormState } from "@/features/admin/content-form-state";
import { textList } from "@/features/admin/form-input";
import { saveContent } from "@/features/admin/save-content";

import { createBentoAdminRepository } from "./admin-repository";
import { CHECKED, LAYOUT_FIELDS } from "./layout";
import { EDITABLE_TILE_KINDS } from "./rules";
import { bentoLayoutSchema } from "./schema";

/** One more than the editor sends: a longer list is refused without reading it all. */
const MAX_ORDER = EDITABLE_TILE_KINDS.length + 1;

function layoutInput(formData: FormData) {
  return {
    order: textList(formData, LAYOUT_FIELDS.order).slice(0, MAX_ORDER),
    size: Object.fromEntries(
      EDITABLE_TILE_KINDS.map((kind) => [
        kind,
        formData.get(LAYOUT_FIELDS.size(kind)),
      ]),
    ),
    visible: Object.fromEntries(
      EDITABLE_TILE_KINDS.map((kind) => [
        kind,
        formData.get(LAYOUT_FIELDS.visible(kind)) === CHECKED,
      ]),
    ),
  };
}

/** The whole layout at once: the hub shows it at the next visit. */
export async function saveBentoLayoutAction(
  _previous: ContentFormState,
  formData: FormData,
): Promise<ContentFormState> {
  return saveContent({
    entity: "bento_tile",
    schema: bentoLayoutSchema,
    input: layoutInput(formData),
    save: (db, layout) => createBentoAdminRepository(db).save(layout),
  });
}
