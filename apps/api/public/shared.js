/* eslint-disable no-unused-vars */

const API_BASE = window.OPEN_IDRO_API_BASE || window.location.origin;

const COUNTRY_NAMES = {
  fr: {
    AT: "Autriche",
    BE: "Belgique",
    CH: "Suisse",
    CY: "Chypre",
    DE: "Allemagne",
    DK: "Danemark",
    ES: "Espagne",
    FI: "Finlande",
    FR: "France",
    GB: "Royaume-Uni",
    GR: "Grèce",
    HR: "Croatie",
    HU: "Hongrie",
    IE: "Irlande",
    LT: "Lituanie",
    LU: "Luxembourg",
    LV: "Lettonie",
    NL: "Pays-Bas",
    PL: "Pologne",
    PT: "Portugal",
    SE: "Suède",
    SI: "Slovénie",
  },
  en: {
    AT: "Austria",
    BE: "Belgium",
    CH: "Switzerland",
    CY: "Cyprus",
    DE: "Germany",
    DK: "Denmark",
    ES: "Spain",
    FI: "Finland",
    FR: "France",
    GB: "United Kingdom",
    GR: "Greece",
    HR: "Croatia",
    HU: "Hungary",
    IE: "Ireland",
    LT: "Lithuania",
    LU: "Luxembourg",
    LV: "Latvia",
    NL: "Netherlands",
    PL: "Poland",
    PT: "Portugal",
    SE: "Sweden",
    SI: "Slovenia",
  },
};

const FALLBACK_COUNTRIES = [
  "DE",
  "ES",
  "AT",
  "PL",
  "FR",
  "NL",
  "BE",
  "LU",
  "GR",
  "CH",
  "PT",
  "DK",
  "SE",
  "SI",
  "FI",
  "IE",
  "LV",
  "LT",
  "HU",
];

function getLanguage() {
  return localStorage.getItem("oid-lang") || preferredBrowserLanguage();
}

function setLanguage(lang) {
  localStorage.setItem("oid-lang", lang);
  document.documentElement.lang = lang;
}

function preferredBrowserLanguage() {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language?.toLowerCase().startsWith("fr")) ? "fr" : "en";
}

function countryName(code, lang = getLanguage()) {
  return COUNTRY_NAMES[lang]?.[code] || code;
}

function formatNumber(value, lang = getLanguage()) {
  return Math.round(Number(value) || 0).toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
}

function relativeTime(iso, lang = getLanguage()) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return lang === "fr" ? "à l'instant" : "just now";
  if (minutes < 60) return lang === "fr" ? `il y a ${minutes} min` : `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "fr" ? `il y a ${hours} h` : `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return lang === "fr" ? `il y a ${days} j` : `${days} d ago`;
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US");
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return response.json();
}

function isIdentifierLike(value) {
  return normalizeIdentifierInput(value) !== null;
}

function normalizeIdentifierInput(value) {
  const input = value.trim().toUpperCase();
  const separated = /^([A-Z]{2})[-*]([A-Z0-9]{3})$/.exec(input);
  const compact = separated || /^([A-Z]{2})([A-Z0-9*]{3})$/.exec(input);
  if (!compact) return null;
  return {
    countryCode: compact[1],
    partyId: compact[2],
    emobilityId: `${compact[1]}${compact[2]}`,
  };
}

function formatIdentifier(countryCode, partyId) {
  return countryCode && partyId != null ? `${countryCode}-${partyId}` : countryCode || "";
}

function statusLabel(status, lang = getLanguage()) {
  const fr = {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    RESERVED: "Réservé",
    UNKNOWN: "Inconnu",
  };
  if (lang === "fr") return fr[status] || status || "—";
  if (!status) return "—";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusBadge(status, lang = getLanguage()) {
  const map = {
    ACTIVE: ["#1f7a45", "#e7f6ee"],
    INACTIVE: ["#6b7886", "#eef1f4"],
    RESERVED: ["#0e76c0", "#e6f1fb"],
    UNKNOWN: ["#9a6a16", "#fbf1e0"],
  };
  const [color, background] = map[status] || ["#6b7886", "#eef1f4"];
  return `<span class="status-badge" style="color:${color};background:${background};">${escapeHtml(statusLabel(status, lang))}</span>`;
}

function roleBadge(role) {
  const cls = role === "CPO" ? "cpo" : role === "EMSP" ? "emsp" : "other";
  return `<span class="role-badge ${cls}">${escapeHtml(role || "—")}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

function setHtml(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.innerHTML = value;
}

function setHref(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) element.setAttribute("href", value);
}

function bindLanguageButtons(render) {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang);
      render();
    });
  });
}

function updateLanguageButtons(lang) {
  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
}
