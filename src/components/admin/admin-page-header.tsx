import { Eyebrow } from "@/components/ui/eyebrow";

import { ADMIN_COPY } from "./copy";

interface AdminPageHeaderProps {
  readonly title: string;
}

/** Each admin page's title: its only h1. */
export function AdminPageHeader({ title }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>{ADMIN_COPY.label}</Eyebrow>
      <h1 className="text-[clamp(32px,4vw,48px)] leading-tight font-semibold tracking-[-0.03em]">
        {title}
      </h1>
    </div>
  );
}
