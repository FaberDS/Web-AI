export const langToRegion = {
  en: "GB",
  de: "DE",
  fr: "FR",
  es: "ES",
  it: "IT",
  pt: "PT",
  nl: "NL",
  sv: "SE",
  no: "NO",
  da: "DK",
  fi: "FI",
  pl: "PL",
  cs: "CZ",
  tr: "TR",
  uk: "UA",
  ru: "RU",
  ja: "JP",
  ko: "KR",
  zh: "CN",
};

// one source of truth for display names
export const langNames = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  sv: "Swedish",
  no: "Norwegian",
  da: "Danish",
  fi: "Finnish",
  pl: "Polish",
  cs: "Czech",
  tr: "Turkish",
  uk: "Ukrainian",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
};

export function normalizeLang(tag) {
  return (tag || "").toLowerCase().split("-")[0];
}

export function regionToFlagEmoji(region) {
  return region
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function languageToFlag(lang) {
  const base = normalizeLang(lang);
  const region = langToRegion[base];
  return region ? regionToFlagEmoji(region) : "🏳️";
}

export const languages = Object.keys(langToRegion)
  .sort((a, b) => (langNames[a] || a).localeCompare(langNames[b] || b))
  .map((code) => ({
    code,
    name: langNames[code] || code.toUpperCase(),
    flag: languageToFlag(code),
    region: langToRegion[code],
  }));
