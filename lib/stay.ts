// Personal guest-guide link for one stay: /g/<guide token>?b=<booking id>&s=<signature>.
// The signature binds the booking to the guide and the company, so a guest can't open another stay's door code.
// Kept free of other imports so the public guide page can use it.
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function staySig(orgId: string, bookingId: string, guideToken: string) {
  return (await sha(`stay:${orgId}:${bookingId}:${guideToken}`)).slice(0, 24);
}
export async function stayGuideUrl(orgId: string, bookingId: string, guideToken: string) {
  if (!guideToken) return "";
  if (!bookingId) return `https://espace.md/g/${guideToken}`;
  return `https://espace.md/g/${guideToken}?b=${encodeURIComponent(bookingId)}&s=${await staySig(orgId, bookingId, guideToken)}`;
}
/** Today's date in Moldova (the door code opens on the arrival day, local time). */
export function localToday(tz = "Europe/Chisinau") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDaysIso(d: string, n: number) {
  const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10);
}
