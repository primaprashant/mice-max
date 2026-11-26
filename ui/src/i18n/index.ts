import en from "./en.json";
import ja from "./ja.json";

export type Lang = "en" | "ja";

const dictionaries: Record<Lang, Record<string, unknown>> = { en: { ...en }, ja: { ...ja } };

// Feature strings live in features/<feature>.<lang>.json (top-level keys merged in),
// so parallel features never edit the same file.
const featureFiles = import.meta.glob<Record<string, unknown>>("./features/*.json", { eager: true, import: "default" });
for (const [path, dict] of Object.entries(featureFiles)) {
  const lang = path.match(/\.(en|ja)\.json$/)?.[1] as Lang | undefined;
  if (lang) Object.assign(dictionaries[lang], dict);
}

/** Look up a dotted key path in the dictionary, e.g. t(lang, "common.join"). */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let value: unknown = dictionaries[lang];
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value)) {
      throw new Error(`Missing i18n key: ${key} (${lang})`);
    }
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== "string") {
    throw new Error(`i18n key is not a string: ${key} (${lang})`);
  }
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}
