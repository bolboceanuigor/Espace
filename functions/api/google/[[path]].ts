// GET /api/google/start | /api/google/callback — Google OpenID Connect.
// Redirect URI is fixed to espace.md / admin.espace.md (or localhost in dev) so company subdomains need no extra Google Console entries.
import {
  type Env, json, sleep, nowIso, uuid, str, one, run, all,
  starterConfig, newSession, loadSession, TRIAL_DAYS, today, sha256hex,
} from "../../../lib/core";
import { hostOf, siteOf, slugOk, isSlug } from "../../../lib/host";
import { logEvent } from "../../../lib/admin";
import {
  googleOk, googleRedirectUri, googleAuthUrl, saveOAuthState, takeOAuthState,
  exchangeCode, verifyIdToken, type OAuthState,
} from "../../../lib/google";

const addDays = (d: string, n: number) => {
  const t = Date.parse(d + "T00:00:00Z");
  return new Date(t + n * 86400000).toISOString().slice(0, 10);
};

async function slugFree(db: D1Database, slug: string) {
  return slugOk(slug) && !(await one(db, "SELECT 1 AS x FROM orgs WHERE code = ?", slug));
}

function orgLanding(request: Request, slug: string, token: string, err?: string) {
  const h = hostOf(request), site = siteOf(h), origin = new URL(request.url).origin;
  const hash = err ? "#google_err=" + encodeURIComponent(err) : "#t=" + token;
  if (site.kind === "dev") {
    return Response.redirect(origin + "/app?c=" + encodeURIComponent(slug) + hash, 302);
  }
  return Response.redirect(`https://${slug}.espace.md/${hash}`, 302);
}

function adminLanding(request: Request, token: string, err?: string) {
  const h = hostOf(request), site = siteOf(h), origin = new URL(request.url).origin;
  const hash = err ? "#google_err=" + encodeURIComponent(err) : "#t=" + token;
  if (site.kind === "dev") return Response.redirect(origin + "/admin" + hash, 302);
  return Response.redirect("https://admin.espace.md/" + hash, 302);
}

function siteLanding(request: Request, err: string) {
  const h = hostOf(request), site = siteOf(h), origin = new URL(request.url).origin;
  const q = "?google_err=" + encodeURIComponent(err);
  if (site.kind === "dev") return Response.redirect(origin + "/" + q, 302);
  return Response.redirect("https://espace.md/" + q, 302);
}

async function myOrgs(db: D1Database, userId: string) {
  return all(db, "SELECT o.id, o.name, o.code, m.role FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.created_at", userId);
}

async function findOrLinkUser(db: D1Database, profile: { sub: string; email: string; name: string }) {
  let u = await one(db, "SELECT * FROM users WHERE google_sub = ?", profile.sub);
  if (u) return u;
  u = await one(db, "SELECT * FROM users WHERE email = ?", profile.email);
  if (u) {
    if (u.google_sub && u.google_sub !== profile.sub) return { conflict: true as const };
    await run(db, "UPDATE users SET google_sub = ?, name = CASE WHEN name = '' OR name = email THEN ? ELSE name END WHERE id = ?",
      profile.sub, profile.name, u.id);
    return await one(db, "SELECT * FROM users WHERE id = ?", u.id);
  }
  return null;
}

async function createUserOrg(db: D1Database, profile: { sub: string; email: string; name: string }, orgName: string, slug: string) {
  const uid = uuid(), oid = uuid();
  await db.batch([
    db.prepare("INSERT INTO users(id, email, name, pw_hash, google_sub, terms_at) VALUES (?,?,?,'',?,?)").bind(uid, profile.email, profile.name, profile.sub, nowIso()),
    db.prepare("INSERT INTO orgs(id, name, code, trial_ends) VALUES (?,?,?,?)").bind(oid, orgName, slug, addDays(today(), TRIAL_DAYS)),
    db.prepare("INSERT INTO members(org_id, user_id, role) VALUES (?,?, 'owner')").bind(oid, uid),
    db.prepare("INSERT INTO app_config(org_id, data) VALUES (?,?)").bind(oid, JSON.stringify(starterConfig(profile.name))),
  ]);
  await logEvent(db, "signup", oid, profile.email, `Companie nouă (Google): ${orgName} (${slug}.espace.md)`);
  return { uid, oid, slug };
}

async function start(request: Request, env: Env) {
  if (!googleOk(env)) return json({ message: "google_off" }, 503);
  const url = new URL(request.url);
  const mode = (url.searchParams.get("mode") || "login") as OAuthState["mode"];
  if (mode !== "login" && mode !== "signup" && mode !== "link") return json({ message: "bad_mode" }, 400);

  const site = siteOf(hostOf(request));
  const data: OAuthState = { mode };

  if (mode === "link") {
    const tok = str(url.searchParams.get("s"), 64);
    if (!/^[0-9a-f]{64}$/.test(tok)) return json({ message: "bad_session" }, 401);
    const c = await loadSession(env.DB, env, tok);
    if (!c) return json({ message: "bad_session" }, 401);
    data.user_id = c.user.id;
    data.slug = c.org?.code || "";
    data.next = site.kind === "admin" || url.searchParams.get("next") === "admin" ? "admin" : "";
  } else if (mode === "signup") {
    const orgName = str(url.searchParams.get("org_name"), 80);
    const slug = str(url.searchParams.get("slug"), 40).toLowerCase();
    const name = str(url.searchParams.get("name"), 60);
    const terms = url.searchParams.get("terms") === "1";
    if (!orgName || !terms) return json({ message: "need_names" }, 400);
    if (!slugOk(slug)) return json({ message: "bad_slug" }, 400);
    if (!(await slugFree(env.DB, slug))) return json({ message: "slug_taken" }, 409);
    data.org_name = orgName;
    data.slug = slug;
    data.name = name;
    data.terms = true;
  } else {
    // login: company slug from query, tenant host, or admin
    const qSlug = str(url.searchParams.get("slug"), 40).toLowerCase();
    if (site.kind === "admin" || url.searchParams.get("next") === "admin") {
      data.next = "admin";
    } else if (site.kind === "tenant") {
      data.slug = site.slug;
    } else if (isSlug(qSlug)) {
      data.slug = qSlug;
    } else if (site.kind === "dev") {
      data.slug = isSlug(qSlug) ? qSlug : str(url.searchParams.get("c"), 40).toLowerCase();
    }
  }

  const state = await saveOAuthState(env.DB, data);
  // redirect_uri is always espace.md / admin.espace.md (or localhost) — not the company subdomain
  return Response.redirect(googleAuthUrl(env, googleRedirectUri(request), state), 302);
}

async function callback(request: Request, env: Env) {
  const url = new URL(request.url);
  const errQ = url.searchParams.get("error");
  const code = str(url.searchParams.get("code"), 2048);
  const stateRaw = str(url.searchParams.get("state"), 64);
  const st = await takeOAuthState(env.DB, stateRaw);
  if (!st) return siteLanding(request, "bad_state");
  if (errQ || !code) {
    if (st.next === "admin") return adminLanding(request, "", "denied");
    if (st.slug) return orgLanding(request, st.slug, "", "denied");
    return siteLanding(request, "denied");
  }
  if (!googleOk(env)) return siteLanding(request, "google_off");

  let profile;
  try {
    const idToken = await exchangeCode(env, code, googleRedirectUri(request));
    profile = await verifyIdToken(env, idToken);
  } catch {
    if (st.next === "admin") return adminLanding(request, "", "verify");
    if (st.slug) return orgLanding(request, st.slug, "", "verify");
    return siteLanding(request, "verify");
  }
  if (st.name) profile = { ...profile, name: st.name || profile.name };

  const db = env.DB;

  if (st.mode === "link") {
    if (!st.user_id) return siteLanding(request, "bad_session");
    const taken = await one(db, "SELECT id FROM users WHERE google_sub = ? AND id != ?", profile.sub, st.user_id);
    if (taken) {
      if (st.next === "admin") return adminLanding(request, "", "google_taken");
      if (st.slug) return orgLanding(request, st.slug, "", "google_taken");
      return siteLanding(request, "google_taken");
    }
    const me = await one(db, "SELECT id, email FROM users WHERE id = ?", st.user_id);
    if (!me) return siteLanding(request, "bad_session");
    // only link if Google email matches the account email (avoids attaching someone else's Google)
    if (me.email !== profile.email) {
      if (st.next === "admin") return adminLanding(request, "", "email_mismatch");
      if (st.slug) return orgLanding(request, st.slug, "", "email_mismatch");
      return siteLanding(request, "email_mismatch");
    }
    await run(db, "UPDATE users SET google_sub = ? WHERE id = ?", profile.sub, me.id);
    const token = await newSession(db, me.id, "");
    // restore org session if we know the slug
    if (st.slug) {
      const m = await one(db, "SELECT o.id FROM members m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? AND o.code = ?", me.id, st.slug);
      if (m) await run(db, "UPDATE sessions SET org_id = ? WHERE token_hash = ?", m.id, await sha256hex(token));
      return orgLanding(request, st.slug, token);
    }
    if (st.next === "admin") return adminLanding(request, token);
    return siteLanding(request, "linked");
  }

  if (st.mode === "signup") {
    const found = await findOrLinkUser(db, profile);
    if (found && (found as any).conflict) return siteLanding(request, "google_taken");
    if (found) {
      const u = found as any;
      if (u.disabled) return siteLanding(request, "disabled");
      await run(db, "UPDATE users SET last_login = ? WHERE id = ?", nowIso(), u.id).catch(() => {});
      const orgs = await myOrgs(db, u.id);
      const want = orgs[0];
      const token = await newSession(db, u.id, want ? want.id : "");
      if (want) return orgLanding(request, want.code, token);
      return siteLanding(request, "no_org");
    }
    const orgName = str(st.org_name, 80), slug = str(st.slug, 40).toLowerCase();
    if (!orgName || !slugOk(slug) || !(await slugFree(db, slug))) return siteLanding(request, "slug_taken");
    const created = await createUserOrg(db, profile, orgName, slug);
    const token = await newSession(db, created.uid, created.oid);
    return orgLanding(request, created.slug, token);
  }

  // login
  const found = await findOrLinkUser(db, profile);
  if (found && (found as any).conflict) {
    if (st.next === "admin") return adminLanding(request, "", "google_taken");
    if (st.slug) return orgLanding(request, st.slug, "", "google_taken");
    return siteLanding(request, "google_taken");
  }
  if (!found) {
    // no account yet — on signup path only; login asks them to create a company
    if (st.next === "admin") return adminLanding(request, "", "no_account");
    if (st.slug) return orgLanding(request, st.slug, "", "no_account");
    return siteLanding(request, "no_account");
  }
  const u = found as any;
  if (u.disabled) {
    if (st.next === "admin") return adminLanding(request, "", "disabled");
    if (st.slug) return orgLanding(request, st.slug, "", "disabled");
    return siteLanding(request, "disabled");
  }
  await run(db, "UPDATE users SET last_login = ? WHERE id = ?", nowIso(), u.id).catch(() => {});

  if (st.next === "admin") {
    const isSuper = !!env.SUPERADMIN_EMAIL && u.email === env.SUPERADMIN_EMAIL.trim().toLowerCase();
    if (!isSuper) return adminLanding(request, "", "not_admin");
    const token = await newSession(db, u.id, "");
    return adminLanding(request, token);
  }

  const orgs = await myOrgs(db, u.id);
  const want = st.slug ? orgs.find((o: any) => o.code === st.slug) : orgs[0];
  if (st.slug && !want) return orgLanding(request, st.slug, "", "not_member");
  if (!want) return siteLanding(request, "no_org");
  const token = await newSession(db, u.id, want.id);
  return orgLanding(request, want.code, token);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const fn = String(([] as string[]).concat((params as any).path || []).pop() || "");
  try {
    if (fn === "start") return await start(request, env);
    if (fn === "callback") return await callback(request, env);
    return json({ message: "not_found" }, 404);
  } catch {
    await sleep(200);
    return json({ message: "error" }, 500);
  }
};

// POST /api/google/start with JSON body (signup from site) — same as GET query
export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const fn = String(([] as string[]).concat((params as any).path || []).pop() || "");
  if (fn !== "start") return json({ message: "method_not_allowed" }, 405);
  if (!googleOk(env)) return json({ message: "google_off" }, 503);
  let body: any = {};
  try { body = await request.json(); } catch { return json({ message: "bad_json" }, 400); }
  const u = new URL(request.url);
  u.searchParams.set("mode", str(body.mode, 20) || "login");
  if (body.slug) u.searchParams.set("slug", str(body.slug, 40));
  if (body.org_name) u.searchParams.set("org_name", str(body.org_name, 80));
  if (body.name) u.searchParams.set("name", str(body.name, 60));
  if (body.terms === true) u.searchParams.set("terms", "1");
  if (body.next) u.searchParams.set("next", str(body.next, 20));
  if (body.s) u.searchParams.set("s", str(body.s, 64));
  return start(new Request(u.toString(), { method: "GET", headers: request.headers }), env);
};
