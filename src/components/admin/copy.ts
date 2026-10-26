// The admin speaks French only (decided on 2026-10-25): its text lives here
// rather than in the public site's message catalogs. A test checks the
// spacing before high punctuation, as for messages/fr.json.

/** Narrow no-break space is not used: the site's catalogs use U+00A0. */
const NB = " ";

const FAILURES = {
  locked: `Trop de tentatives${NB}: réessayez dans quelques minutes.`,
  unavailable: `Service momentanément indisponible${NB}: réessayez plus tard.`,
} as const;

export const ADMIN_COPY = {
  label: "administration",
  skipLink: "Aller au contenu",
  nav: {
    label: "Administration",
    dashboard: "Tableau de bord",
    security: "Sécurité",
    signOut: "Se déconnecter",
    site: "Voir le site",
    brand: "Orion, administration",
  },
  login: {
    title: "Connexion",
    lead: "Espace réservé à l'administration du site.",
    email: "E-mail",
    password: "Mot de passe",
    submit: "Continuer",
    disabled: "L'administration n'est pas configurée sur ce déploiement.",
    failures: { refused: "Identifiants incorrects.", ...FAILURES },
  },
  codeFailures: {
    refused:
      "Code incorrect ou déjà utilisé. Les codes de l'application changent toutes les 30 secondes et ne servent qu'une fois.",
    ...FAILURES,
  },
  pending: "Vérification…",
  unavailable: "Ces informations ne peuvent pas être chargées pour le moment.",
  secondFactor: {
    title: "Vérification en deux étapes",
    lead: "Saisissez le code à 6 chiffres affiché par votre application d'authentification.",
    code: "Code à 6 chiffres",
    recoveryLead:
      "Saisissez l'un de vos codes de récupération. Chaque code ne sert qu'une fois.",
    recoveryCode: "Code de récupération",
    useRecovery: "Utiliser un code de récupération",
    useTotp: "Utiliser l'application d'authentification",
    submit: "Vérifier",
    restart: "Recommencer la connexion",
  },
  recoveryCodes: {
    title: "Codes de récupération",
    newTitle: "Nouveaux codes de récupération",
    lead: "Conservez ces codes en lieu sûr, par exemple dans un gestionnaire de mots de passe. Chacun permet une connexion sans téléphone, une seule fois. Ils ne seront plus affichés.",
    copy: "Copier les codes",
    copied: "Codes copiés dans le presse-papiers.",
    copyFailed: `Copie impossible${NB}: sélectionnez les codes à la main.`,
  },
  dashboard: {
    title: "Tableau de bord",
    lead: "La gestion du contenu arrive avec la prochaine version du site.",
    security:
      "Sessions, codes de récupération, mot de passe et journal d'audit",
  },
  security: {
    title: "Sécurité",
    sessions: {
      title: "Sessions actives",
      current: "(cette session)",
      started: "ouverte le",
      lastSeen: "dernière activité",
      unknownDevice: "Appareil inconnu",
      legend: "Sessions à révoquer",
      lead: "Révoquer une session demande un code de l'application.",
      code: "Code à 6 chiffres",
      revokeSelected: "Révoquer la sélection",
      revokeOthers: "Révoquer toutes les autres sessions",
      nothingSelected:
        "Sélectionnez au moins une session, ou révoquez toutes les autres.",
      codeContext: "pour révoquer des sessions",
      done: (revoked: number) =>
        revoked === 0
          ? "Aucune session révoquée."
          : `${String(revoked)} session${revoked > 1 ? "s" : ""} révoquée${revoked > 1 ? "s" : ""}.`,
    },
    recovery: {
      title: "Codes de récupération",
      remaining: (count: number) =>
        count === 0
          ? "Aucun code de récupération disponible."
          : `${String(count)} code${count > 1 ? "s" : ""} de récupération disponible${count > 1 ? "s" : ""}.`,
      lead: "En générer de nouveaux rend les anciens inutilisables. Votre mot de passe et un code de l'application sont demandés.",
      password: "Votre mot de passe",
      code: "Code à 6 chiffres",
      codeContext: "pour de nouveaux codes de récupération",
      submit: "Générer de nouveaux codes",
    },
    password: {
      title: "Mot de passe",
      current: "Mot de passe actuel",
      next: "Nouveau mot de passe",
      hint: "Au moins 15 caractères. Une phrase de passe convient très bien.",
      code: "Code à 6 chiffres",
      codeContext: "pour changer le mot de passe",
      submit: "Changer le mot de passe",
      done: (revoked: number) =>
        revoked === 0
          ? "Mot de passe changé."
          : `Mot de passe changé. ${String(revoked)} autre${revoked > 1 ? "s" : ""} session${revoked > 1 ? "s" : ""} déconnectée${revoked > 1 ? "s" : ""}.`,
      problems: {
        too_short:
          "Le nouveau mot de passe doit contenir au moins 15 caractères.",
        too_long:
          "Le nouveau mot de passe ne peut pas dépasser 128 caractères.",
        contains_context_word:
          "Le nouveau mot de passe ne doit contenir ni l'adresse e-mail, ni le nom du site ou de son propriétaire.",
        breached: `Ce mot de passe figure dans des fuites de données connues${NB}: choisissez-en un autre.`,
      },
    },
    audit: {
      title: "Journal d'audit",
      empty: "Aucun événement enregistré.",
      actions: {
        "auth.login_succeeded": "Connexion réussie",
        "auth.login_failed": "Échec de connexion",
        "auth.account_locked": "Compte verrouillé",
        "auth.totp_enabled": "Double authentification activée (CLI)",
        "auth.recovery_code_used": "Code de récupération utilisé",
        "auth.recovery_codes_regenerated": "Codes de récupération régénérés",
        "auth.password_changed": "Mot de passe changé",
        "auth.session_revoked": "Session révoquée",
        "auth.signed_out": "Déconnexion",
        "auth.totp_reset": "Double authentification réinitialisée (CLI)",
      },
      /** The diff's keys and values, in words; anything else is shown as stored. */
      details: {
        method: "méthode",
        step: "étape",
        revokedCount: "sessions révoquées",
        scope: "portée",
        totp: "code TOTP",
        recovery_code: "code de récupération",
        password: "mot de passe",
        cli: "CLI",
        others: "toutes les autres",
        selected: "sélection",
      } as Readonly<Record<string, string>>,
    },
  },
} as const;
