import type { OutgoingMail } from "@/lib/mail";

import type { LockoutAlert } from "./auth-dependencies";

const PARIS_TIME = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/**
 * The alert sent when failures lock the admin account from one network. It
 * names no address: the network is only kept as a keyed hash.
 */
export function lockoutMail({ at, until }: LockoutAlert): OutgoingMail {
  return {
    subject: "[Portfolio] Compte admin verrouillé",
    text: [
      `Des échecs de connexion répétés ont verrouillé le compte admin le ${PARIS_TIME.format(at)}, depuis un même réseau, jusqu'à ${PARIS_TIME.format(until)} (heure de Paris).`,
      "",
      "Les autres réseaux ne sont pas bloqués. Si ces tentatives ne viennent pas de vous, le journal d'audit (/admin/security) les détaille.",
      "",
      "Pour lever le verrouillage avant son terme\u00a0: pnpm admin:unlock",
    ].join("\n"),
  };
}
