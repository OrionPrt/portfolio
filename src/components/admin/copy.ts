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
    messages: "Messages",
    profile: "Profil",
    links: "Liens",
    skills: "Compétences",
    projects: "Projets",
    experiences: "Expériences",
    education: "Formation",
    certifications: "Certifications",
    media: "Médiathèque",
    unreadWord: (count: number) => (count > 1 ? "non lus" : "non lu"),
    security: "Sécurité",
    groups: {
      overview: "Vue d'ensemble",
      content: "Contenu",
      account: "Compte",
    },
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
    messages: (unread: number | undefined) =>
      unread === undefined
        ? "Le nombre de messages non lus n'a pas pu être chargé."
        : unread === 0
          ? "Aucun message non lu."
          : `${String(unread)} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`,
  },
  inbox: {
    title: "Messages",
    /** The tab's title: it changes with the folder and the page, for the route announcer. */
    documentTitle: (view: "received" | "archived", page: number) =>
      `Messages ${view === "received" ? "reçus" : "archivés"}${page > 1 ? `, page ${String(page)}` : ""}`,
    messageTitle: "Message",
    views: { received: "Reçus", archived: "Archivés" },
    viewsLabel: "Dossiers",
    empty: {
      received: "Aucun message reçu.",
      archived: "Aucun message archivé.",
    },
    from: "De",
    received: "Reçu le",
    language: "Langue",
    languages: { fr: "français", en: "anglais" },
    device: "Appareil",
    pagination: "Pagination",
    previous: "Plus récents",
    next: "Plus anciens",
    pageOf: (page: number, pages: number) =>
      `Page ${String(page)} sur ${String(pages)}`,
    back: "Retour aux messages",
    notFound: "Ce message n'existe pas, ou a été supprimé.",
    reply: "Répondre par e-mail",
    replySubject: (subject: string) => `Re${NB}: ${subject}`,
    saving: "Enregistrement…",
    markRead: "Marquer comme lu",
    markUnread: "Marquer comme non lu",
    archive: "Archiver",
    unarchive: "Remettre dans les reçus",
    changed: {
      read: "Message marqué comme lu.",
      unread: "Message marqué comme non lu.",
      archived: "Message archivé.",
    },
    statuses: { unread: "Non lu", read: "Lu", archived: "Archivé" },
    delete: {
      trigger: "Supprimer",
      title: `Supprimer ce message${NB}?`,
      description:
        "Il sera effacé définitivement. Le journal d'audit ne gardera que la trace de la suppression, sans son contenu.",
      confirm: "Supprimer définitivement",
      pending: "Suppression…",
    },
    failures: {
      not_found: "Ce message n'existe plus.",
      unavailable: FAILURES.unavailable,
    },
  },
  content: {
    edit: "Modifier",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Modifications enregistrées.",
    invalid: "Vérifiez les champs signalés.",
    notFound: "Cette entrée n'existe plus.",
    full: `Le nombre maximal d'entrées est atteint${NB}: supprimez-en une avant d'en ajouter.`,
    unavailable: FAILURES.unavailable,
    leave: `Des modifications ne sont pas enregistrées. Quitter la page${NB}?`,
    problems: {
      required: "Obligatoire.",
      tooLong: (max: number) => `${String(max)} caractères au plus.`,
      invalid: "Valeur invalide.",
      taken: "Déjà pris par une autre entrée.",
    },
    locales: { fr: "Français", en: "Anglais" },
    toTranslate: "À traduire",
    markdown: {
      write: "Rédiger",
      preview: "Aperçu",
      empty: "Rien à afficher pour l'instant.",
      hint: `Markdown${NB}: titres, listes, liens, code, tableaux.`,
    },
    move: {
      up: (label: string) => `Monter ${label}`,
      down: (label: string) => `Descendre ${label}`,
      done: "Ordre enregistré.",
    },
    delete: {
      trigger: "Supprimer",
      confirm: "Supprimer définitivement",
      pending: "Suppression…",
      done: (label: string) => `${label}${NB}: supprimé.`,
      inUse: `Une entrée l'affiche encore${NB}: retirez-la d'abord.`,
      snapshot:
        "La suppression est définitive. Le journal d'audit garde un instantané de l'entrée, pour la recréer à la main si besoin.",
    },
  },
  skillPicker: {
    legend: "Compétences liées",
    hint: `Dans l'ordre des badges${NB}: la première est la plus visible.`,
    empty: "Aucune compétence liée.",
    choose: "Compétence à ajouter",
    add: "Ajouter",
    remove: (name: string) => `Retirer ${name}`,
    full: (max: number) =>
      `${String(max)} compétences au plus${NB}: retirez-en une pour en ajouter une autre.`,
    noneLeft: "Toutes les compétences sont déjà liées.",
    invalid: (max: number) =>
      `Liste refusée${NB}: ${String(max)} compétences au plus, chacune une fois, prises dans le catalogue.`,
    added: (name: string, position: number, total: number) =>
      `${name} ajoutée, en position ${String(position)} sur ${String(total)}.`,
    moved: (name: string, position: number, total: number) =>
      `${name} déplacée en position ${String(position)} sur ${String(total)}.`,
    removed: (name: string) => `${name} retirée.`,
  },
  profile: {
    title: "Profil",
    lead: `Ce que présentent la tuile d'identité et la page À propos. Le français est obligatoire${NB}; laissé vide, l'anglais reprend le texte français.`,
    displayName: "Nom affiché",
    location: "Ville",
    optional: "Facultatif.",
    headline: "Titre",
    headlineHint: `Une ligne, sous le nom${NB}: votre métier.`,
    availability: "Disponibilité",
    pitch: "Présentation courte",
    lookingFor: "Ce que je recherche",
    aboutMd: "À propos",
  },
  links: {
    title: "Liens",
    lead: "Les liens du site, dans l'ordre où il les montre. L'e-mail public est le lien de type E-mail.",
    kinds: {
      github: "GitHub",
      linkedin: "LinkedIn",
      email: "E-mail",
      hackthebox: "Hack The Box",
      rootme: "Root-Me",
      tryhackme: "TryHackMe",
      website: "Site web",
    },
    url: "Adresse",
    urlHint: `Un lien https://${NB}; pour l'e-mail, mailto:nom@domaine.`,
    urlInvalid:
      "Un lien https:// complet, ou mailto:nom@domaine pour le lien E-mail.",
    visible: "Visible sur le site",
    hiddenBadge: "Masqué",
    empty: "Aucun lien pour l'instant.",
    add: "Ajouter un lien",
    kind: "Type",
    kindTaken: "Ce type de lien existe déjà.",
    allUsed: "Chaque type de lien existe déjà.",
    deleteTitle: (kind: string) => `Supprimer le lien ${kind}${NB}?`,
  },
  skills: {
    title: "Compétences",
    lead: "Les technologies et pratiques, rangées par domaine, dans l'ordre où le site les montre. Leurs noms ne se traduisent pas.",
    add: "Nouvelle compétence",
    newTitle: "Nouvelle compétence",
    editTitle: "Modifier une compétence",
    back: "Retour aux compétences",
    empty: "Aucune compétence dans ce domaine.",
    domains: {
      web: "Web",
      low_level: "Bas niveau",
      devops: "DevOps",
      cyber: "Cybersécurité",
    },
    name: "Nom",
    slug: "Slug",
    slugHint: `Identifiant dans les adresses${NB}: lettres minuscules, chiffres et tirets.`,
    slugInvalid:
      "Lettres minuscules et chiffres, séparés par des tirets simples.",
    slugTaken: "Ce slug est déjà pris par une autre compétence.",
    domain: "Domaine",
    featured: "Mise en avant",
    featuredHint: "Montrée en premier sur la tuile des compétences.",
    featuredBadge: "En avant",
    usage: (projects: number, experiences: number) => {
      const parts = [
        projects === 0
          ? undefined
          : `${String(projects)} projet${projects > 1 ? "s" : ""}`,
        experiences === 0
          ? undefined
          : `${String(experiences)} expérience${experiences > 1 ? "s" : ""}`,
      ].filter((part) => part !== undefined);
      return parts.length === 0
        ? "Liée à rien"
        : `Liée à ${parts.join(" et ")}`;
    },
    deleteTitle: (name: string) =>
      `Supprimer la compétence «${NB}${name}${NB}»${NB}?`,
    deleteConsequence: (projects: number, experiences: number) =>
      projects + experiences === 0
        ? undefined
        : "Ses liens avec les projets et expériences qui l'utilisent disparaissent aussi.",
    notFound: "Cette compétence n'existe pas, ou a été supprimée.",
  },
  /** What projects and experiences share: entries with a page of their own. */
  entries: {
    publication: "Publication",
    status: "Statut",
    statuses: { draft: "Brouillon", published: "Publié" },
    statusHint: "Un brouillon n'apparaît pas sur le site.",
    slug: "Slug",
    slugHint: `Fin de l'adresse de sa page${NB}: lettres minuscules, chiffres et tirets. Changé une fois publié, l'ancienne adresse mène à la nouvelle.`,
    slugInvalid:
      "Lettres minuscules et chiffres, séparés par des tirets simples.",
    domain: "Domaine",
    startedOn: "Début",
    endedOn: "Fin",
    optional: "Facultatif.",
    urlHint: "Facultatif. Un lien https:// complet.",
    urlInvalid: "Un lien https:// complet.",
    english: { missing: "Anglais à traduire", partial: "Anglais incomplet" },
    summary: "Résumé",
    summaryContext: "Contexte",
    summaryAction: "Ce que j'ai fait",
    summaryResult: "Résultat",
    technicalMd: "Partie technique",
    technicalHint: `Pour les ingénieurs, sous le résumé. Markdown${NB}: titres, listes, liens, code, tableaux.`,
    deleteConsequence:
      "Ses traductions et ses liens aux compétences disparaissent aussi, et son adresse ne mènera plus nulle part.",
    /** "janvier 2024 – aujourd'hui" while under way. */
    period: (start: string, end: string | undefined) =>
      `${start} – ${end ?? "aujourd'hui"}`,
    /** "Développeur, Acme": two entries at one place stay apart. */
    label: (title: string | undefined, place: string) =>
      title === undefined || title === "" ? place : `${title}, ${place}`,
    publicOnSave: "Enregistrée, l'entrée est aussitôt visible sur le site.",
  },
  projects: {
    title: "Projets",
    lead: `Les projets du site, ceux mis en avant d'abord, chaque groupe dans son ordre. Le français est obligatoire${NB}; laissé vide, l'anglais reprend le texte français.`,
    add: "Nouveau projet",
    newTitle: "Nouveau projet",
    editTitle: "Modifier un projet",
    back: "Retour aux projets",
    groups: { featured: "Mis en avant", others: "Autres projets" },
    empty: {
      featured: "Aucun projet mis en avant.",
      others: "Aucun autre projet.",
    },
    slugTaken: "Ce slug est déjà pris par un autre projet.",
    featured: "Mise en avant",
    featuredHint:
      "Montré en tête de liste. Le premier projet publié mis en avant figure sur l'accueil.",
    presentation: "Présentation",
    name: "Titre",
    tagline: "Accroche",
    taglineHint: "Une ligne, sous le titre.",
    seoDescription: "Description pour les moteurs de recherche",
    seoHint: "Facultatif. À défaut, l'accroche.",
    linksAndDates: "Liens et dates",
    cover: "Couverture",
    repoUrl: "Dépôt de code",
    demoUrl: "Démo en ligne",
    endedOnInvalid: "La fin ne peut ni précéder le début, ni venir sans lui.",
    deleteTitle: (title: string) =>
      `Supprimer le projet «${NB}${title}${NB}»${NB}?`,
    notFound: "Ce projet n'existe pas, ou a été supprimé.",
  },
  experiences: {
    title: "Expériences",
    lead: `Les postes occupés, rangés par dates comme sur le site${NB}: le poste actuel d'abord. Le français est obligatoire${NB}; laissé vide, l'anglais reprend le texte français.`,
    add: "Nouvelle expérience",
    newTitle: "Nouvelle expérience",
    editTitle: "Modifier une expérience",
    back: "Retour aux expériences",
    empty: "Aucune expérience pour l'instant.",
    slugTaken: "Ce slug est déjà pris par une autre expérience.",
    company: "Entreprise",
    companyUrl: "Site de l'entreprise",
    logo: "Logo de l'entreprise",
    location: "Lieu",
    employmentType: "Type de contrat",
    employmentTypes: {
      full_time: "Temps plein",
      part_time: "Temps partiel",
      internship: "Stage",
      apprenticeship: "Alternance",
      freelance: "Freelance",
    },
    position: "Le poste",
    role: "Intitulé du poste",
    endedOnHint: "Vide tant que le poste est le vôtre.",
    endedOnInvalid: "La fin ne peut précéder le début.",
    deleteTitle: (label: string) =>
      `Supprimer l'expérience «${NB}${label}${NB}»${NB}?`,
    notFound: "Cette expérience n'existe pas, ou a été supprimée.",
  },
  education: {
    title: "Formation",
    lead: `Les diplômes et formations, rangés par dates comme sur le site${NB}: le plus récent d'abord. Une entrée enregistrée est aussitôt publique. Le français est obligatoire${NB}; laissé vide, l'anglais reprend le texte français.`,
    add: "Nouvelle formation",
    newTitle: "Nouvelle formation",
    editTitle: "Modifier une formation",
    back: "Retour à la formation",
    empty: "Aucune formation pour l'instant.",
    school: "Établissement",
    logo: "Logo de l'établissement",
    location: "Lieu",
    studies: "Les études",
    degree: "Diplôme",
    degreeHint: "Son intitulé, tel qu'il figure sur le diplôme.",
    description: "Description",
    descriptionHint: "Facultatif. Spécialité, mention, projets marquants.",
    endedOnHint: "Vide tant que la formation est en cours.",
    endedOnInvalid: "La fin ne peut précéder le début.",
    deleteTitle: (label: string) =>
      `Supprimer la formation «${NB}${label}${NB}»${NB}?`,
    deleteConsequence: "Ses traductions disparaissent aussi.",
    notFound: "Cette formation n'existe pas, ou a été supprimée.",
  },
  certifications: {
    title: "Certifications",
    lead: "Les certifications, la plus récente d'abord, comme sur la tuile de l'accueil. Une certification enregistrée est aussitôt publique.",
    add: "Nouvelle certification",
    newTitle: "Nouvelle certification",
    editTitle: "Modifier une certification",
    back: "Retour aux certifications",
    empty: "Aucune certification pour l'instant.",
    credential: "La certification",
    name: "Nom",
    issuer: "Organisme",
    issuedOn: "Obtenue le",
    expiresOn: "Expire le",
    expiresOnHint: "Vide si elle n'expire pas.",
    expiresOnInvalid: "L'expiration ne peut précéder l'obtention.",
    credentialId: "Identifiant du certificat",
    badge: "Badge",
    verifyUrl: "Lien de vérification",
    description: "Description",
    descriptionHint: "Facultatif. Ce qu'elle atteste, en une ou deux phrases.",
    expiredBadge: "Expirée",
    /** "OSCP (2024)": a renewal stays apart from the first. */
    label: (name: string, issuedOn: string) =>
      `${name} (${issuedOn.slice(0, 4)})`,
    issued: (date: string) => `obtenue en ${date}`,
    expires: (date: string, isExpired: boolean) =>
      isExpired ? `a expiré en ${date}` : `expire en ${date}`,
    deleteTitle: (name: string) =>
      `Supprimer la certification «${NB}${name}${NB}»${NB}?`,
    deleteConsequence: "Ses traductions disparaissent aussi.",
    notFound: "Cette certification n'existe pas, ou a été supprimée.",
  },
  mediaField: {
    none: "Aucune",
    hint: "Choisie dans la médiathèque, où l'on ajoute les images.",
  },
  media: {
    title: "Médiathèque",
    lead: `Les images du site${NB}: couvertures de projets, logos, badges. Chacune est ré-encodée en WebP à trois largeurs, sans ses métadonnées, et décrite en français comme en anglais.`,
    add: "Ajouter une image",
    images: "Les images",
    send: "Ajouter",
    adding: "Envoi…",
    added: "Image ajoutée à la médiathèque.",
    file: "Image",
    fileHint: "JPEG, PNG ou WebP, 4 Mo au plus.",
    fileMissing: "Choisissez une image.",
    fileInvalid: "Une image JPEG, PNG ou WebP lisible, de 4 Mo au plus.",
    fileTaken: "Cette image est déjà dans la médiathèque.",
    alt: "Texte alternatif",
    altHint: `Ce que l'image montre, pour qui ne la voit pas${NB}: une phrase, sans «${NB}image de${NB}».`,
    empty: "La médiathèque est vide.",
    editTitle: "Modifier une image",
    back: "Retour à la médiathèque",
    preview: "Aperçu",
    size: (width: number, height: number) =>
      `${String(width)} × ${String(height)} px`,
    variants: (widths: readonly number[]) =>
      `Largeurs stockées${NB}: ${widths.join(", ")} px.`,
    usage: (count: number) =>
      count === 0
        ? "Affichée nulle part"
        : `Affichée par ${String(count)} entrée${count > 1 ? "s" : ""}`,
    usedBy: "Affichée par",
    unused: "Aucune entrée ne l'affiche.",
    inUse:
      "Retirez-la d'abord des entrées qui l'affichent pour pouvoir la supprimer.",
    usageKinds: {
      project: "Projet",
      experience: "Expérience",
      education: "Formation",
      certification: "Certification",
    },
    deleteTitle: `Supprimer cette image${NB}?`,
    deleteConsequence:
      "Ses fichiers sont effacés du stockage, et ses textes alternatifs avec elle.",
    notFound: "Cette image n'existe pas, ou a été supprimée.",
  },
  cancel: "Annuler",
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
        "contact.message_deleted": "Message supprimé",
        "content.created": "Contenu créé",
        "content.updated": "Contenu modifié",
        "content.deleted": "Contenu supprimé",
        "content.reordered": "Ordre modifié",
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
