import { describe, expect, it } from "vitest";

import { ADMIN_COPY } from "./copy";

/** Every string of the copy, however deep. */
function stringsOf(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return typeof value === "object" && value !== null
    ? Object.values(value).flatMap(stringsOf)
    : [];
}

describe("ADMIN_COPY", () => {
  it("uses French spacing before high punctuation", () => {
    for (const text of stringsOf(ADMIN_COPY)) {
      expect(text).not.toMatch(/ [?!;:]/);
    }
  });
});

describe("ADMIN_COPY's computed wording", () => {
  const NB = " ";

  it.each([
    [
      ADMIN_COPY.dashboard.messages(undefined),
      "Le nombre de messages non lus n'a pas pu être chargé.",
    ],
    [ADMIN_COPY.dashboard.messages(0), "Aucun message non lu."],
    [ADMIN_COPY.dashboard.messages(1), "1 message non lu."],
    [ADMIN_COPY.dashboard.messages(3), "3 messages non lus."],
    [ADMIN_COPY.nav.unreadWord(1), "non lu"],
    [ADMIN_COPY.nav.unreadWord(2), "non lus"],
    [ADMIN_COPY.inbox.documentTitle("received", 1), "Messages reçus"],
    [
      ADMIN_COPY.inbox.documentTitle("archived", 2),
      "Messages archivés, page 2",
    ],
    [ADMIN_COPY.inbox.replySubject("Mission"), `Re${NB}: Mission`],
    [ADMIN_COPY.content.problems.tooLong(120), "120 caractères au plus."],
    [ADMIN_COPY.content.move.up("Rust"), "Monter Rust"],
    [ADMIN_COPY.content.move.down("Rust"), "Descendre Rust"],
    [ADMIN_COPY.skills.usage(0, 0), "Liée à rien"],
    [ADMIN_COPY.skills.usage(1, 0), "Liée à 1 projet"],
    [ADMIN_COPY.skills.usage(0, 2), "Liée à 2 expériences"],
    [ADMIN_COPY.skills.usage(2, 1), "Liée à 2 projets et 1 expérience"],
    [
      ADMIN_COPY.skills.deleteTitle("Rust"),
      `Supprimer la compétence «${NB}Rust${NB}»${NB}?`,
    ],
    [ADMIN_COPY.skills.deleteConsequence(0, 0), undefined],
    [ADMIN_COPY.links.deleteTitle("GitHub"), `Supprimer le lien GitHub${NB}?`],
    [
      ADMIN_COPY.projects.deleteTitle("Démo"),
      `Supprimer le projet «${NB}Démo${NB}»${NB}?`,
    ],
    [
      ADMIN_COPY.experiences.deleteTitle("Acme"),
      `Supprimer l'expérience «${NB}Acme${NB}»${NB}?`,
    ],
    [ADMIN_COPY.entries.label("Développeur", "Acme"), "Développeur, Acme"],
    [ADMIN_COPY.entries.label(undefined, "Acme"), "Acme"],
    [ADMIN_COPY.entries.label("Master", "INSA"), "Master, INSA"],
    [ADMIN_COPY.entries.label("", "INSA"), "INSA"],
    [
      ADMIN_COPY.education.deleteTitle("Master, INSA"),
      `Supprimer la formation «${NB}Master, INSA${NB}»${NB}?`,
    ],
    [
      ADMIN_COPY.certifications.deleteTitle("OSCP"),
      `Supprimer la certification «${NB}OSCP${NB}»${NB}?`,
    ],
    [ADMIN_COPY.certifications.label("OSCP", "2024-03-01"), "OSCP (2024)"],
    [ADMIN_COPY.certifications.issued("mars 2024"), "obtenue en mars 2024"],
    [
      ADMIN_COPY.certifications.expires("mai 2022", true),
      "a expiré en mai 2022",
    ],
    [
      ADMIN_COPY.certifications.expires("mai 2027", false),
      "expire en mai 2027",
    ],
    [
      ADMIN_COPY.entries.period("janvier 2024", undefined),
      "janvier 2024 – aujourd'hui",
    ],
    [
      ADMIN_COPY.entries.period("janvier 2024", "mars 2025"),
      "janvier 2024 – mars 2025",
    ],
  ])("reads %j", (text, expected) => {
    expect(text).toBe(expected);
    expect(text ?? "").not.toMatch(/ [?!;:]/);
  });

  it("says when a deleted skill's links go with it", () => {
    expect(ADMIN_COPY.skills.deleteConsequence(1, 0)).toMatch(/disparaissent/);
  });
});
