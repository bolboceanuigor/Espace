// Role → API allowlists. Kept free of D1/Workers types so smoke tests can import this file.

export const ROLES = ["owner", "manager", "checker", "viewer", "prop"];
// prop: apartment owner — only /proprietar data
export const PROP_FNS = ["kv_prop_load"];
export const READ_FNS = [
  "kv_load", "rates_get", "kv_photos", "kv_guides", "kv_task_photo", "kv_push_key", "kv_push_sub",
  "excel", "excel_handovers", "billing", "kv_ical_list", "kv_tg_status", "kv_tg_link", "kv_tg_unlink",
  "kv_owner_reports", "kv_owner_payouts", "kv_audit", "kv_contract_get", "kv_contract_preview",
];
export const CHECKER_FNS = ["kv_verify", "kv_month_close", "kv_month_open"];

export function roleAllows(role: string, fn: string) {
  if (role === "owner") return true;
  if (role === "prop") return PROP_FNS.includes(fn);
  if (fn.startsWith("team_")) return false;
  if (role === "manager") return true;
  if (READ_FNS.includes(fn)) return true;
  return role === "checker" && CHECKER_FNS.includes(fn);
}
