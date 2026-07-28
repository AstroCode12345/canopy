// Translation data for the printable allergen card (ROADMAP.md).
//
// SCOPE NOTE, and it matters: this list is much wider than the six languages
// the scan pipeline verifies, and that is deliberate. Reading a label and
// handing a card to a waiter are different jobs. Scanning has to survive OCR,
// mistranslation traps, and adversarial labels, so it is only claimed for
// languages measured against the redteam suite. A card just has to say a
// short, plain sentence to a person who reads that language, which is a much
// lower bar to clear honestly.
//
// Allergen terms are taken from standard food-allergen labeling vocabulary
// rather than casual translation: EU FIC Annex II for the European languages
// (those fourteen allergens are legally named in every EU language), Japan's
// specified raw materials, and China's GB 7718. Terms that overlap the
// redteam fixtures (T7 French, T14 Japanese, T22 Spanish, T23 German, T24
// Chinese) reuse those exact verified words.
//
// Everything here is a careful best effort, NOT a verified claim. There is no
// automated way to grade whether a translation reads clearly to a real person
// in a real restaurant, so nothing in this file has been through the redteam
// suite the way the scan vocabulary has. If a native speaker corrects one of
// these, take the correction.
//
// Only the nine PRESET allergen labels (AllergenEditor's COMMON list) are
// translated. A custom allergen someone typed in ("Mustard") has no reliable
// translation without a human check or the AI-alias feature on the roadmap.
// Guessing one could put a wrong word on a card a stranger relies on, which
// is worse than no translation at all, so custom allergens render in English
// everywhere with a visible EN mark.

export type CardLanguage =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "sv"
  | "cs"
  | "el"
  | "ru"
  | "tr"
  | "ar"
  | "he"
  | "hi"
  | "zh"
  | "ja"
  | "ko"
  | "th"
  | "vi"
  | "id";

export const CARD_LANGUAGES: ReadonlyArray<{
  code: CardLanguage;
  /** How the language names itself, which is what a reader recognizes. */
  nativeName: string;
  /** For the picker, so the cardholder can find a language they don't read. */
  englishName: string;
  /** Right-to-left scripts need dir="rtl" or the punctuation lands wrong. */
  rtl?: true;
}> = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
  { code: "fr", nativeName: "Français", englishName: "French" },
  { code: "de", nativeName: "Deutsch", englishName: "German" },
  { code: "it", nativeName: "Italiano", englishName: "Italian" },
  { code: "pt", nativeName: "Português", englishName: "Portuguese" },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch" },
  { code: "pl", nativeName: "Polski", englishName: "Polish" },
  { code: "sv", nativeName: "Svenska", englishName: "Swedish" },
  { code: "cs", nativeName: "Čeština", englishName: "Czech" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", rtl: true },
  { code: "he", nativeName: "עברית", englishName: "Hebrew", rtl: true },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { code: "zh", nativeName: "中文", englishName: "Chinese" },
  { code: "ja", nativeName: "日本語", englishName: "Japanese" },
  { code: "ko", nativeName: "한국어", englishName: "Korean" },
  { code: "th", nativeName: "ไทย", englishName: "Thai" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
];

type Localized = Record<CardLanguage, string>;

/** Preset allergen label (exact AllergenEditor COMMON text) -> translation. */
const PRESET_TRANSLATIONS: Record<string, Localized> = {
  Peanuts: {
    en: "Peanuts",
    es: "Cacahuetes",
    fr: "Arachides",
    de: "Erdnüsse",
    it: "Arachidi",
    pt: "Amendoim",
    nl: "Pinda's",
    pl: "Orzeszki ziemne",
    sv: "Jordnötter",
    cs: "Arašídy",
    // "Φιστίκια" alone is ambiguous (it also reads as pistachio), so the
    // official labeling term leads and the common word follows in brackets.
    el: "Αραχίδες (φιστίκια)",
    ru: "Арахис",
    tr: "Yer fıstığı",
    ar: "الفول السوداني",
    he: "בוטנים",
    hi: "मूंगफली",
    zh: "花生",
    ja: "ピーナッツ（落花生）",
    ko: "땅콩",
    th: "ถั่วลิสง",
    vi: "Đậu phộng (lạc)",
    id: "Kacang tanah",
  },
  "Tree nuts": {
    en: "Tree nuts",
    es: "Frutos de cáscara",
    fr: "Fruits à coque",
    de: "Schalenfrüchte (Nüsse)",
    it: "Frutta a guscio",
    pt: "Frutos de casca rija (nozes)",
    nl: "Noten (schaalvruchten)",
    pl: "Orzechy",
    sv: "Nötter",
    cs: "Ořechy",
    el: "Ξηροί καρποί",
    ru: "Орехи (древесные)",
    tr: "Sert kabuklu yemişler (fındık, ceviz)",
    ar: "المكسرات",
    he: "אגוזים",
    hi: "मेवे (बादाम, अखरोट)",
    zh: "坚果",
    ja: "ナッツ類（木の実）",
    ko: "견과류",
    th: "ถั่วเปลือกแข็ง",
    vi: "Các loại hạt cây (óc chó, hạnh nhân)",
    id: "Kacang pohon (almond, kenari)",
  },
  Dairy: {
    en: "Dairy",
    es: "Lácteos",
    fr: "Lait / Produits laitiers",
    de: "Milch",
    it: "Latte e derivati",
    pt: "Leite e derivados",
    nl: "Melk (zuivel)",
    pl: "Mleko i nabiał",
    sv: "Mjölk (mjölkprodukter)",
    cs: "Mléko a mléčné výrobky",
    el: "Γάλα (γαλακτοκομικά)",
    ru: "Молоко (молочные продукты)",
    tr: "Süt ve süt ürünleri",
    ar: "الحليب ومنتجات الألبان",
    he: "חלב ומוצרי חלב",
    hi: "दूध और डेयरी उत्पाद",
    zh: "乳制品（牛奶）",
    ja: "乳製品（乳成分）",
    ko: "우유 (유제품)",
    th: "นม (ผลิตภัณฑ์จากนม)",
    vi: "Sữa và sản phẩm từ sữa",
    id: "Susu dan produk susu",
  },
  Eggs: {
    en: "Eggs",
    es: "Huevo",
    fr: "Œufs",
    de: "Eier",
    it: "Uova",
    pt: "Ovos",
    nl: "Eieren",
    pl: "Jaja",
    sv: "Ägg",
    cs: "Vejce",
    el: "Αυγά",
    ru: "Яйца",
    tr: "Yumurta",
    ar: "البيض",
    he: "ביצים",
    hi: "अंडे",
    zh: "鸡蛋",
    ja: "卵（鶏卵）",
    ko: "달걀",
    th: "ไข่",
    vi: "Trứng",
    id: "Telur",
  },
  "Gluten / Wheat": {
    en: "Gluten / Wheat",
    es: "Gluten / Trigo",
    fr: "Gluten / Blé",
    de: "Gluten / Weizen",
    it: "Glutine / Grano",
    pt: "Glúten / Trigo",
    nl: "Gluten / Tarwe",
    pl: "Gluten / Pszenica",
    sv: "Gluten / Vete",
    cs: "Lepek / Pšenice",
    el: "Γλουτένη / Σιτάρι",
    ru: "Глютен / Пшеница",
    tr: "Gluten / Buğday",
    ar: "الغلوتين / القمح",
    he: "גלוטן / חיטה",
    hi: "ग्लूटेन / गेहूँ",
    zh: "麸质（小麦）",
    ja: "小麦（グルテン）",
    ko: "글루텐 / 밀",
    th: "กลูเตน / ข้าวสาลี",
    vi: "Gluten / Lúa mì",
    id: "Gluten / Gandum",
  },
  Soy: {
    en: "Soy",
    es: "Soja",
    fr: "Soja",
    de: "Soja",
    it: "Soia",
    pt: "Soja",
    nl: "Soja",
    pl: "Soja",
    sv: "Soja",
    cs: "Sója",
    el: "Σόγια",
    ru: "Соя",
    tr: "Soya",
    ar: "فول الصويا",
    he: "סויה",
    hi: "सोया",
    zh: "大豆",
    ja: "大豆",
    ko: "대두 (콩)",
    th: "ถั่วเหลือง",
    vi: "Đậu nành",
    id: "Kedelai",
  },
  Shellfish: {
    en: "Shellfish",
    es: "Mariscos",
    fr: "Crustacés et mollusques",
    de: "Krebs- und Weichtiere",
    it: "Crostacei e molluschi",
    pt: "Crustáceos e moluscos",
    nl: "Schaal- en weekdieren",
    pl: "Skorupiaki i mięczaki",
    sv: "Kräftdjur och blötdjur",
    cs: "Korýši a měkkýši",
    el: "Οστρακοειδή και μαλάκια",
    ru: "Ракообразные и моллюски",
    tr: "Kabuklu deniz ürünleri",
    ar: "القشريات والرخويات",
    he: "סרטנים ורכיכות",
    hi: "शंख मछली (झींगा, केकड़ा)",
    zh: "甲壳类（虾、蟹、贝类）",
    ja: "えび・かに・貝類",
    ko: "갑각류 및 조개류",
    th: "กุ้ง ปู หอย",
    vi: "Giáp xác và nhuyễn thể (tôm, cua, sò)",
    id: "Kerang dan udang",
  },
  Fish: {
    en: "Fish",
    es: "Pescado",
    fr: "Poisson",
    de: "Fisch",
    it: "Pesce",
    pt: "Peixe",
    nl: "Vis",
    pl: "Ryby",
    sv: "Fisk",
    cs: "Ryby",
    el: "Ψάρια",
    ru: "Рыба",
    tr: "Balık",
    ar: "السمك",
    he: "דגים",
    hi: "मछली",
    zh: "鱼类",
    ja: "魚",
    ko: "생선",
    th: "ปลา",
    vi: "Cá",
    id: "Ikan",
  },
  Sesame: {
    en: "Sesame",
    es: "Sésamo",
    fr: "Sésame",
    de: "Sesam",
    it: "Sesamo",
    pt: "Sésamo (gergelim)",
    nl: "Sesam",
    pl: "Sezam",
    sv: "Sesam",
    cs: "Sezam",
    el: "Σουσάμι",
    ru: "Кунжут",
    tr: "Susam",
    ar: "السمسم",
    he: "שומשום",
    hi: "तिल",
    zh: "芝麻",
    ja: "ごま",
    ko: "참깨",
    th: "งา",
    vi: "Vừng (mè)",
    id: "Wijen",
  },
};

/** True for the nine preset labels, the ones this file can translate. */
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

/**
 * The sentences that make a card work.
 *
 * A list of allergen words alone does not communicate urgency, and urgency is
 * the point: "peanuts" reads as a preference, "I have a serious food allergy,
 * I cannot eat peanuts" reads as a medical fact. Kept to two short lines per
 * language so the card stays scannable when several languages are stacked.
 */
export const CARD_COPY: Record<
  CardLanguage,
  { severeLead: string; mildLead: string; customNote: string }
> = {
  en: {
    severeLead: "I have a serious food allergy. I cannot eat:",
    mildLead: "I also try to avoid:",
    customNote: "Items marked EN are in English only.",
  },
  es: {
    severeLead: "Tengo una alergia alimentaria grave. No puedo comer:",
    mildLead: "También intento evitar:",
    customNote: "Los elementos marcados EN están solo en inglés.",
  },
  fr: {
    severeLead: "J'ai une allergie alimentaire grave. Je ne peux pas manger :",
    mildLead: "J'essaie aussi d'éviter :",
    customNote: "Les éléments marqués EN sont en anglais uniquement.",
  },
  de: {
    severeLead:
      "Ich habe eine schwere Lebensmittelallergie. Ich darf nicht essen:",
    mildLead: "Ich versuche außerdem zu vermeiden:",
    customNote: "Mit EN markierte Einträge sind nur auf Englisch.",
  },
  it: {
    severeLead: "Ho una grave allergia alimentare. Non posso mangiare:",
    mildLead: "Cerco anche di evitare:",
    customNote: "Gli elementi contrassegnati EN sono solo in inglese.",
  },
  pt: {
    severeLead: "Tenho uma alergia alimentar grave. Não posso comer:",
    mildLead: "Também tento evitar:",
    customNote: "Os itens marcados EN estão apenas em inglês.",
  },
  nl: {
    severeLead: "Ik heb een ernstige voedselallergie. Ik kan niet eten:",
    mildLead: "Ik probeer ook te vermijden:",
    customNote: "Items met EN zijn alleen in het Engels.",
  },
  pl: {
    severeLead: "Mam poważną alergię pokarmową. Nie mogę jeść:",
    mildLead: "Staram się również unikać:",
    customNote: "Pozycje oznaczone EN są tylko po angielsku.",
  },
  sv: {
    severeLead: "Jag har en allvarlig matallergi. Jag kan inte äta:",
    mildLead: "Jag försöker också undvika:",
    customNote: "Poster märkta EN visas endast på engelska.",
  },
  cs: {
    severeLead: "Mám vážnou potravinovou alergii. Nemohu jíst:",
    mildLead: "Také se snažím vyhnout:",
    customNote: "Položky označené EN jsou pouze v angličtině.",
  },
  el: {
    severeLead: "Έχω σοβαρή τροφική αλλεργία. Δεν μπορώ να φάω:",
    mildLead: "Προσπαθώ επίσης να αποφεύγω:",
    customNote: "Τα στοιχεία με την ένδειξη EN είναι μόνο στα αγγλικά.",
  },
  ru: {
    severeLead: "У меня серьёзная пищевая аллергия. Мне нельзя есть:",
    mildLead: "Я также стараюсь избегать:",
    customNote: "Пункты с пометкой EN указаны только на английском.",
  },
  tr: {
    severeLead: "Ciddi bir gıda alerjim var. Şunları yiyemem:",
    mildLead: "Ayrıca şunlardan kaçınmaya çalışıyorum:",
    customNote: "EN işaretli maddeler yalnızca İngilizcedir.",
  },
  ar: {
    severeLead: "لدي حساسية غذائية شديدة. لا أستطيع تناول:",
    mildLead: "أحاول أيضًا تجنب:",
    customNote: "العناصر المعلَّمة EN بالإنجليزية فقط.",
  },
  he: {
    severeLead: "יש לי אלרגיה חמורה למזון. אני לא יכול לאכול:",
    mildLead: "אני גם משתדל להימנע מ:",
    customNote: "פריטים המסומנים EN באנגלית בלבד.",
  },
  hi: {
    severeLead: "मुझे गंभीर खाद्य एलर्जी है। मैं ये नहीं खा सकता:",
    mildLead: "मैं इनसे भी बचने की कोशिश करता हूँ:",
    customNote: "EN चिह्नित आइटम केवल अंग्रेज़ी में हैं।",
  },
  zh: {
    severeLead: "我有严重的食物过敏。我不能吃：",
    mildLead: "我也尽量避免：",
    customNote: "标有 EN 的项目仅为英文。",
  },
  ja: {
    severeLead: "重度の食物アレルギーがあります。以下は食べられません：",
    mildLead: "以下も避けています：",
    customNote: "EN の項目は英語のみです。",
  },
  ko: {
    severeLead: "심각한 식품 알레르기가 있습니다. 다음은 먹을 수 없습니다:",
    mildLead: "다음도 피하려고 합니다:",
    customNote: "EN 표시 항목은 영어로만 표시됩니다.",
  },
  th: {
    severeLead: "ฉันแพ้อาหารอย่างรุนแรง ฉันกินสิ่งเหล่านี้ไม่ได้:",
    mildLead: "ฉันพยายามหลีกเลี่ยงสิ่งเหล่านี้ด้วย:",
    customNote: "รายการที่มีเครื่องหมาย EN เป็นภาษาอังกฤษเท่านั้น",
  },
  vi: {
    severeLead: "Tôi bị dị ứng thực phẩm nghiêm trọng. Tôi không thể ăn:",
    mildLead: "Tôi cũng cố gắng tránh:",
    customNote: "Các mục đánh dấu EN chỉ có tiếng Anh.",
  },
  id: {
    severeLead: "Saya memiliki alergi makanan yang parah. Saya tidak bisa makan:",
    mildLead: "Saya juga berusaha menghindari:",
    customNote: "Item bertanda EN hanya dalam bahasa Inggris.",
  },
};
