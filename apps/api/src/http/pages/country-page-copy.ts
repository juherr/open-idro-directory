import { DISCLAIMER } from "../../domain/constants.js";

/** Languages of the country page; `en` is the default and canonical one. */
export type PageLanguage = "en" | "fr";

/** The `?lang` query value as a page language: anything but `fr` is English. */
export function pageLanguage(value: string | null | undefined): PageLanguage {
  return value === "fr" ? "fr" : "en";
}

/** A noun or participle in the two plural categories the page needs. */
export interface Plural {
  one: string;
  other: string;
}

/** What the empty state of a country without identifiers explains. */
export interface EmptyState {
  /** The authorities named, already joined, or the generic holder. */
  holder: string;
  /** More than one authority is named: verbs and pronouns agree. */
  several: boolean;
  /** The country name, for the languages that can name it in a sentence. */
  name: string;
  /**
   * `unlisted`: no machine-readable list; `unretrieved`: none retrieved yet;
   * `partial`: some retrieved, others not; `retrieved`: all retrieved.
   */
  kind: "unlisted" | "unretrieved" | "partial" | "retrieved";
  /** Number of machine-readable lists. */
  lists: number;
}

const en = {
  eyebrow: "IDRO country",
  coverage: {
    unpublished: "A known IDRO, with no published identifiers.",
    identifier: { one: "identifier", other: "identifiers" },
    source: { one: "source", other: "sources" },
    published: { one: "published by", other: "published by" },
  },
  values: {
    none: "None",
    noneFeminine: "None",
    unknown: "Unknown",
    unknownFeminine: "Unknown",
    never: "Never",
    notPublished: "Not published",
    colon: ": ",
  },
  status: {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    RESERVED: "Reserved",
    REVOKED: "Revoked",
    UNKNOWN: "Unknown",
  },
  authorityLevel: {
    AUTHORITATIVE: "Authoritative",
    SUPRANATIONAL_DIRECTORY: "Supranational directory",
    SECONDARY: "Secondary",
    SELF_ASSERTED: "Self-asserted",
    UNVERIFIED: "Unverified",
  },
  observationType: {
    OFFICIAL_ASSIGNMENT: "Official assignment",
    OFFICIAL_DIRECTORY_ENTRY: "Official directory entry",
    LEGACY_ASSIGNMENT: "Legacy assignment",
    NETWORK_REGISTRATION: "Network registration",
    INFRASTRUCTURE_OBSERVATION: "Infrastructure observation",
    SELF_DECLARATION: "Self-declaration",
    COMMUNITY_OBSERVATION: "Community observation",
  },
  freshness: {
    current: "Current",
    stale: "Stale",
    disabled: "Disabled",
    unknown: "Unknown",
  },
  empty: {
    title: "No published identifiers",
    defaultHolder: "The national authority",
    explanation: (state: EmptyState) => {
      const manages = state.several ? "manage" : "manages";
      const publishes = state.several ? "publish" : "publishes";
      const { holder, name } = state;
      switch (state.kind) {
        case "unlisted":
          return (
            `${holder} ${manages} e-mobility identifiers for ${name}, ` +
            `but ${publishes} no machine-readable list of them, so this directory holds none.`
          );
        case "unretrieved":
          return state.lists === 1
            ? `${holder} ${manages} e-mobility identifiers for ${name} and ${publishes} a ` +
                "machine-readable list, but this directory has not retrieved it yet, so it holds none."
            : `${holder} ${manages} e-mobility identifiers for ${name} and ${publishes} ` +
                "machine-readable lists, but this directory has not retrieved them yet, so it holds none.";
        case "partial":
          return (
            `${holder} ${manages} e-mobility identifiers for ${name}. ` +
            `The lists retrieved so far hold no identifiers for ${name}, and others have not been ` +
            "retrieved yet, so this directory holds none."
          );
        case "retrieved": {
          const its = state.several ? "Their" : "Its";
          return (
            `${holder} ${manages} e-mobility identifiers for ${name}. ` +
            (state.lists === 1
              ? `${its} published list holds no identifiers for ${name} yet, so this directory holds none.`
              : `${its} published lists hold no identifiers for ${name} yet, so this directory holds none.`)
          );
        }
      }
    },
    ask: (several: boolean) =>
      `Ask the ${several ? "authorities" : "authority"} below to verify an identifier.`,
  },
  authorities: {
    title: "IDRO authorities",
    unnamed: "Unnamed authority",
    level: "Level",
    jurisdictions: "Jurisdictions",
    sources: "Sources",
    empty: "No IDRO authority is recorded for this country.",
  },
  coverageSection: {
    title: "Coverage",
    status: "Status",
    published: "Published",
    unpublished: "No published identifiers",
    declaredRoles: "Declared roles",
    publishedRoles: "Published roles",
    identifiers: "Identifiers",
    identifierRoles: "Identifier roles",
    observations: "Observations",
    conflicts: "Conflicts",
    byStatus: "By status",
  },
  sources: {
    title: "Sources",
    sourceId: "Source id",
    authority: "Authority",
    register: "Register",
    observationType: "Observation type",
    machineReadable: "Machine-readable list",
    freshness: "Freshness",
    lastSuccess: "Last successful retrieval",
    observationsIn: (code: string) => `Observations in ${code}`,
    empty: "No source covers this country.",
  },
  links: {
    title: "Data",
    explorer: (name: string) => `Search ${name} identifiers in the explorer`,
    json: "This summary as JSON",
    generated: (timestamp: string) => `Dataset generated ${timestamp}.`,
  },
  // The client replaces the `data-i18n` texts with the same keys of
  // EXPLORER_COPY in public/explorer.js, in the language of <html lang>.
  search: {
    title: "Search identifiers",
    scope: "Every search is limited to",
    placeholder: "Operator name or identifier",
    searchBtn: "Search",
    request: "API request",
    copy: "Copy",
    openJson: "Open JSON",
    showApiLabel: "Show API request",
    resolved: "Identifier resolved",
    viewProvenance: "View provenance",
    colId: "Identifier",
    colName: "Operator",
    colCountry: "Country",
    colStatus: "Status",
    colRoles: "Roles",
    loading: "Loading...",
    emptyTitle: "No results",
    emptyBody: "Adjust your search or filters.",
    more: "Load more",
    close: "Close",
    detailLabel: "Party details",
    conflict: "Conflict",
    legalName: "Legal name",
    authority: "Authority level",
    roles: "Roles",
    lastSeen: "Last seen",
    website: "Website",
    provenance: "Provenance",
    provenanceSub: "Where this identifier comes from, and which authority to verify it with.",
  },
  // <head> metadata and the language switch. The switch is written in the
  // language it links to.
  meta: {
    description: (name: string) =>
      `${name} in the Open IDRO Directory: IDRO authorities, coverage and sources of e-mobility identifiers.`,
    authorities: (names: string) => `Authorities: ${names}.`,
    home: "Home",
    otherLanguage: "Lire en français",
  },
  nav: {
    explorer: "Explorer",
    countries: "Countries",
    trust: "Trust",
    api: "API",
  },
  disclaimer: DISCLAIMER,
};

export type PageCopy = typeof en;

const fr: PageCopy = {
  eyebrow: "Pays IDRO",
  coverage: {
    unpublished: "Un IDRO connu, sans identifiant publié.",
    identifier: { one: "identifiant", other: "identifiants" },
    source: { one: "source", other: "sources" },
    published: { one: "publié par", other: "publiés par" },
  },
  values: {
    none: "Aucun",
    noneFeminine: "Aucune",
    unknown: "Inconnu",
    unknownFeminine: "Inconnue",
    never: "Jamais",
    notPublished: "Non publiée",
    colon: "\u00a0: ",
  },
  status: {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    RESERVED: "Réservé",
    REVOKED: "Révoqué",
    UNKNOWN: "Inconnu",
  },
  authorityLevel: {
    AUTHORITATIVE: "Faisant autorité",
    SUPRANATIONAL_DIRECTORY: "Annuaire supranational",
    SECONDARY: "Secondaire",
    SELF_ASSERTED: "Auto-déclaré",
    UNVERIFIED: "Non vérifié",
  },
  observationType: {
    OFFICIAL_ASSIGNMENT: "Attribution officielle",
    OFFICIAL_DIRECTORY_ENTRY: "Entrée d'annuaire officiel",
    LEGACY_ASSIGNMENT: "Attribution historique",
    NETWORK_REGISTRATION: "Enregistrement réseau",
    INFRASTRUCTURE_OBSERVATION: "Observation d'infrastructure",
    SELF_DECLARATION: "Auto-déclaration",
    COMMUNITY_OBSERVATION: "Observation communautaire",
  },
  freshness: {
    current: "À jour",
    stale: "Obsolète",
    disabled: "Désactivée",
    unknown: "Inconnue",
  },
  empty: {
    title: "Aucun identifiant publié",
    defaultHolder: "L'autorité nationale",
    // "ce pays" rather than the name: no article to agree with it.
    explanation: (state: EmptyState) => {
      const manages = state.several ? "gèrent" : "gère";
      const publishes = state.several ? "publient" : "publie";
      const { holder } = state;
      const lead = `${holder} ${manages} les identifiants de mobilité électrique de ce pays`;
      switch (state.kind) {
        case "unlisted":
          return (
            `${lead}, mais ne ${publishes} aucune liste lisible par machine : ` +
            "cet annuaire n'en contient donc aucun."
          );
        case "unretrieved":
          return state.lists === 1
            ? `${lead} et ${publishes} une liste lisible par machine, mais cet annuaire ` +
                "ne l'a pas encore récupérée : il n'en contient donc aucun."
            : `${lead} et ${publishes} des listes lisibles par machine, mais cet annuaire ` +
                "ne les a pas encore récupérées : il n'en contient donc aucun.";
        case "partial":
          return (
            `${lead}. Les listes récupérées jusqu'ici ne contiennent aucun identifiant de ce ` +
            "pays, et d'autres n'ont pas encore été récupérées : cet annuaire n'en contient donc aucun."
          );
        case "retrieved": {
          const one = state.lists === 1;
          const its = state.several ? (one ? "Leur" : "Leurs") : one ? "Sa" : "Ses";
          return (
            `${lead}. ` +
            (one
              ? `${its} liste publiée ne contient encore aucun identifiant de ce pays : `
              : `${its} listes publiées ne contiennent encore aucun identifiant de ce pays : `) +
            "cet annuaire n'en contient donc aucun."
          );
        }
      }
    },
    ask: (several: boolean) =>
      `Pour vérifier un identifiant, adressez-vous ${several ? "aux autorités" : "à l'autorité"} ci-dessous.`,
  },
  authorities: {
    title: "Autorités IDRO",
    unnamed: "Autorité sans nom",
    level: "Niveau",
    jurisdictions: "Juridictions",
    sources: "Sources",
    empty: "Aucune autorité IDRO n'est enregistrée pour ce pays.",
  },
  coverageSection: {
    title: "Couverture",
    status: "Statut",
    published: "Publié",
    unpublished: "Aucun identifiant publié",
    declaredRoles: "Rôles déclarés",
    publishedRoles: "Rôles publiés",
    identifiers: "Identifiants",
    identifierRoles: "Rôles d'identifiants",
    observations: "Observations",
    conflicts: "Conflits",
    byStatus: "Par statut",
  },
  sources: {
    title: "Sources",
    sourceId: "Identifiant de la source",
    authority: "Autorité",
    register: "Registre",
    observationType: "Type d'observation",
    machineReadable: "Liste lisible par machine",
    freshness: "Fraîcheur",
    lastSuccess: "Dernière récupération réussie",
    observationsIn: (code: string) => `Observations (${code})`,
    empty: "Aucune source ne couvre ce pays.",
  },
  links: {
    title: "Données",
    explorer: () => "Rechercher les identifiants de ce pays dans l'explorateur",
    json: "Ce résumé au format JSON",
    generated: (timestamp: string) => `Jeu de données généré le ${timestamp}.`,
  },
  search: {
    title: "Rechercher des identifiants",
    scope: "Chaque recherche est limitée à ce pays :",
    placeholder: "Nom d'opérateur ou identifiant",
    searchBtn: "Rechercher",
    request: "Requête API",
    copy: "Copier",
    openJson: "Ouvrir le JSON",
    showApiLabel: "Voir la requête API",
    resolved: "Identifiant résolu",
    viewProvenance: "Voir la provenance",
    colId: "Identifiant",
    colName: "Opérateur",
    colCountry: "Pays",
    colStatus: "Statut",
    colRoles: "Rôles",
    loading: "Chargement...",
    emptyTitle: "Aucun résultat",
    emptyBody: "Ajustez votre recherche ou vos filtres.",
    more: "Charger plus",
    close: "Fermer",
    detailLabel: "Détails de l'opérateur",
    conflict: "Conflit",
    legalName: "Raison sociale",
    authority: "Niveau d'autorité",
    roles: "Rôles",
    lastSeen: "Vu pour la dernière fois",
    website: "Site web",
    provenance: "Provenance",
    provenanceSub: "D'où provient cet identifiant, et chez quelle autorité le vérifier.",
  },
  meta: {
    description: (name: string) =>
      `${name} dans Open IDRO Directory : autorités IDRO, couverture et sources des identifiants de mobilité électrique.`,
    authorities: (names: string) => `Autorités : ${names}.`,
    home: "Accueil",
    otherLanguage: "Read in English",
  },
  nav: {
    explorer: "Explorer",
    countries: "Pays",
    trust: "Confiance",
    api: "API",
  },
  disclaimer:
    "Open IDRO Directory est un projet d'agrégation indépendant. Il n'émet pas d'identifiants " +
    "de mobilité électrique et n'est pas une source faisant autorité. Pour toute vérification " +
    "légale, contractuelle ou opérationnelle, référez-vous à l'IDRO d'origine.",
};

/** Every string of the country page, per language. */
export const COUNTRY_PAGE_COPY: Record<PageLanguage, PageCopy> = { en, fr };
