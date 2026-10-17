// Minimal smoke tests (no network). Run: npm test
import { appLang } from "../lib/lang.ts";
import { roleAllows } from "../lib/access.ts";

let failed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error("FAIL:", msg); failed++; }
  else console.log("ok:", msg);
}
const req = (h: Record<string, string>) => new Request("https://x.espace.md/", { headers: h });

ok(appLang(req({})) === "ro", "default language is Romanian");
ok(appLang(req({ cookie: "es_lang=en" })) === "en", "cookie es_lang wins");
ok(appLang(req({ cookie: "es_lang=ru", "accept-language": "ro" })) === "ru", "cookie beats Accept-Language");
ok(appLang(req({ "accept-language": "ro-MD,ro;q=0.9" })) === "ro", "Accept-Language ro");
ok(appLang(req({ "accept-language": "mo" })) === "ro", "mo maps to ro");
ok(appLang(req({ "accept-language": "ru-RU,ru;q=0.9" })) === "ru", "Accept-Language ru");

ok(roleAllows("owner", "kv_save") === true, "owner can write");
ok(roleAllows("owner", "team_add") === true, "owner can manage team");
ok(roleAllows("manager", "kv_save") === true, "manager can write");
ok(roleAllows("manager", "team_add") === false, "manager cannot manage team");
ok(roleAllows("viewer", "kv_load") === true, "viewer can read");
ok(roleAllows("viewer", "kv_save") === false, "viewer cannot write");
ok(roleAllows("checker", "kv_verify") === true, "checker can verify");
ok(roleAllows("checker", "kv_save") === false, "checker cannot save bookings");
ok(roleAllows("prop", "kv_prop_load") === true, "prop can load own portal");
ok(roleAllows("prop", "kv_load") === false, "prop cannot load full ops");

if (failed) { console.error(failed + " failed"); process.exit(1); }
console.log("smoke: all passed");
