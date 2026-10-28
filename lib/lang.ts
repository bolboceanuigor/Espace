// Company-app language: cookie es_lang wins, else Accept-Language, else Romanian.

export type Lang = "ro" | "ru" | "en";

export function appLang(req: Request): Lang {
  const c = /(?:^|;\s*)es_lang=(ro|ru|en)/.exec(req.headers.get("cookie") || "");
  if (c) return c[1] as Lang;
  for (const part of (req.headers.get("accept-language") || "").toLowerCase().split(",")) {
    const code = part.trim().slice(0, 2);
    if (code === "ro" || code === "mo") return "ro";
    if (code === "ru") return "ru";
    if (code === "en") return "en";
  }
  return "ro";
}

export const APP_PAGE: Record<Lang, string> = { ro: "/app-ro", ru: "/app", en: "/app-en" };
