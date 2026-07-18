// Translation data for the printable/shareable allergen card (ROADMAP.md).
// Scoped to the six languages Canopy's scan pipeline verifies against
// (see supported-languages verification, src/app/api/scan/route.ts) — the
// same language set, so "Canopy checks this language" and "Canopy can hand
// you a card in this language" mean the same thing.
//
// Only the nine PRESET allergen labels (AllergenEditor's COMMON list) have
// real translations here. A custom allergen someone typed in ("Mustard")
// has no reliable translation without either a human check or the AI-alias
// feature on the roadmap — guessing one could put a wrong word on a card a
// stranger relies on, which is worse than no translation at all. Custom
// allergens render in English on every language card, with a visible note,
// rather than a silently-invented translation.
//
// Terms overlapping the scan-language redteam fixtures (T7 French, T14
// Japanese, T22 Spanish, T23 German, T24 Chinese) use those exact verified
// words. The rest draw on standard international food-allergen labeling
// vocabulary (EU FIC Annex II, Japan's specified raw materials, China's GB
// 7718) rather than casual translation, but — unlike the scan pipeline —
// these haven't been run through the redteam suite, since there's no
// automated way to grade a translation's real-world clarity. Treat this as
// a careful best effort, not a verified claim.

export type CardLanguage = "en" | "es" | "fr" | "de" | "ja" | "zh";

export const CARD_LANGUAGES: ReadonlyArray<{
  code: CardLanguage;
  nativeName: string;
}> = [
  { code: "en", nativeName: "English" },
  { code: "es", nativeName: "Español" },
  { code: "fr", nativeName: "Français" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ja", nativeName: "日本語" },
  { code: "zh", nativeName: "中文" },
];

type Localized = Record<CardLanguage, string>;

/** Preset allergen label (exact AllergenEditor COMMON text) -> translation. */
const PRESET_TRANSLATIONS: Record<string, Localized> = {
  Peanuts: {
    en: "Peanuts",
    es: "Cacahuetes",
    fr: "Arachides",
    de: "Erdnüsse",
    ja: "ピーナッツ（落花生）",
    zh: "花生",
  },
  "Tree nuts": {
    en: "Tree nuts",
    es: "Frutos de cáscara",
    fr: "Fruits à coque",
    de: "Schalenfrüchte (Nüsse)",
    ja: "ナッツ類（木の実）",
    zh: "坚果",
  },
  Dairy: {
    en: "Dairy",
    es: "Lácteos",
    fr: "Lait / Produits laitiers",
    de: "Milch",
    ja: "乳製品（乳成分）",
    zh: "乳制品（牛奶）",
  },
  Eggs: {
    en: "Eggs",
    es: "Huevo",
    fr: "Œufs",
    de: "Eier",
    ja: "卵（鶏卵）",
    zh: "鸡蛋",
  },
  "Gluten / Wheat": {
    en: "Gluten / Wheat",
    es: "Gluten / Trigo",
    fr: "Gluten / Blé",
    de: "Gluten / Weizen",
    ja: "小麦（グルテン）",
    zh: "麸质（小麦）",
  },
  Soy: {
    en: "Soy",
    es: "Soja",
    fr: "Soja",
    de: "Soja",
    ja: "大豆",
    zh: "大豆",
  },
  Shellfish: {
    en: "Shellfish",
    es: "Mariscos",
    fr: "Crustacés et mollusques",
    de: "Krebs- und Weichtiere",
    ja: "えび・かに・貝類",
    zh: "甲壳类（虾、蟹、贝类）",
  },
  Fish: {
    en: "Fish",
    es: "Pescado",
    fr: "Poisson",
    de: "Fisch",
    ja: "魚",
    zh: "鱼类",
  },
  Sesame: {
    en: "Sesame",
    es: "Sésamo",
    fr: "Sésame",
    de: "Sesam",
    ja: "ごま",
    zh: "芝麻",
  },
};

/** True for the nine preset labels — the ones this file can translate. */
export function isTranslatablePreset(label: string): boolean {
  return label in PRESET_TRANSLATIONS;
}

/** Translated allergen name, or the original English label if untranslatable. */
export function translateAllergenLabel(
  label: string,
  lang: CardLanguage,
): string {
  return PRESET_TRANSLATIONS[label]?.[lang] ?? label;
}

export const CARD_COPY: Record<
  CardLanguage,
  {
    title: string;
    intro: string;
    severeHeading: string;
    mildHeading: string;
    /** Shown once, only when the profile has a non-preset allergen, since
     * those render in English on every card regardless of selected
     * language (see file header — no invented translations). */
    customLegend: string;
    disclaimer: string;
  }
> = {
  en: {
    title: "Allergen Information",
    intro:
      "Please avoid the following ingredients when preparing or serving food.",
    severeHeading: "Severe: avoid completely",
    mildHeading: "Mild: be aware",
    customLegend: "Items marked EN are shown in English only.",
    disclaimer:
      "Made with Canopy. Please confirm directly if anything is unclear.",
  },
  es: {
    title: "Información sobre alergias",
    intro: "Evite los siguientes ingredientes al preparar o servir comida.",
    severeHeading: "Grave: evitar por completo",
    mildHeading: "Leve: tener precaución",
    customLegend: "Los elementos marcados EN se muestran solo en inglés.",
    disclaimer: "Hecho con Canopy. Confirme directamente si algo no está claro.",
  },
  fr: {
    title: "Informations sur les allergies",
    intro:
      "Merci d'éviter les ingrédients suivants lors de la préparation des repas.",
    severeHeading: "Sévère : à éviter complètement",
    mildHeading: "Légère : soyez prudent",
    customLegend: "Les éléments marqués EN sont indiqués en anglais uniquement.",
    disclaimer: "Fait avec Canopy. Merci de vérifier directement en cas de doute.",
  },
  de: {
    title: "Allergie-Informationen",
    intro:
      "Bitte vermeiden Sie die folgenden Zutaten bei der Zubereitung von Speisen.",
    severeHeading: "Schwer: unbedingt vermeiden",
    mildHeading: "Mild: bitte vorsichtig sein",
    customLegend: "Mit EN markierte Einträge werden nur auf Englisch angezeigt.",
    disclaimer:
      "Erstellt mit Canopy. Bei Unklarheiten bitte direkt nachfragen.",
  },
  ja: {
    title: "アレルギー情報",
    intro: "食事の準備の際は、以下の成分を避けてください。",
    severeHeading: "重度：完全に避けてください",
    mildHeading: "軽度：注意してください",
    customLegend: "ENの表示は英語のみの項目です。",
    disclaimer: "Canopyで作成。不明な点があれば直接ご確認ください。",
  },
  zh: {
    title: "过敏原信息",
    intro: "准备或提供食物时，请避免以下成分。",
    severeHeading: "严重：请完全避免",
    mildHeading: "轻度：请谨慎",
    customLegend: "标有 EN 的项目仅以英文显示。",
    disclaimer: "由 Canopy 生成。如有疑问，请直接确认。",
  },
};
