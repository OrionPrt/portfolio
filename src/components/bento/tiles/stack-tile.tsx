import { useLocale, useTranslations } from "next-intl";
import { ViewTransition } from "react";

import { ArrowIcon } from "@/components/ui/arrow-icon";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { SkillView } from "@/features/catalog/repository";
import {
  groupSkillsByDomain,
  highlightSkills,
} from "@/features/content/skill-groups";
import { VIEW_TRANSITIONS } from "@/features/content/view-names";
import type { TileSize } from "@/features/content/vocabulary";

import { Tile, TileLink } from "../tile";

/** Skills shown per domain; the skills page lists them all. */
const SKILLS_PER_DOMAIN = 3;

interface StackTileProps {
  readonly size: TileSize;
  readonly skills: readonly SkillView[];
}

/** The skills at a glance, by domain. Morphs into the skills page. */
export function StackTile({ size, skills }: StackTileProps) {
  const t = useTranslations("Home");
  const tDomains = useTranslations("Domains");
  const locale = useLocale();
  const titleId = `stack-title-${locale}`;

  return (
    <ViewTransition name={VIEW_TRANSITIONS.stack} share="morph" default="none">
      <Tile size={size} labelledBy={titleId} isInteractive>
        <div className="text-fg-muted flex items-center justify-between">
          <Eyebrow as="h2" id={titleId}>
            <TileLink href="/skills">{t("stack")}</TileLink>
          </Eyebrow>
          <ArrowIcon />
        </div>
        <dl className="grid flex-1 content-end gap-x-6 gap-y-3 sm:grid-cols-2">
          {groupSkillsByDomain(skills).map(({ domain, skills: inDomain }) => {
            const { shown, hidden } = highlightSkills(
              inDomain,
              SKILLS_PER_DOMAIN,
            );
            return (
              <div key={domain} className="flex flex-col gap-1">
                <dt className="text-accent font-mono text-xs">
                  {tDomains(domain)}
                </dt>
                <dd className="text-sm leading-snug">
                  {shown.map((skill) => skill.name).join(", ")}
                  {hidden > 0 && (
                    <span className="text-fg-muted">
                      {" "}
                      <span aria-hidden="true">
                        {t("moreSkills", { count: hidden })}
                      </span>
                      <span className="sr-only">
                        {t("moreSkillsLabel", { count: hidden })}
                      </span>
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </Tile>
    </ViewTransition>
  );
}
