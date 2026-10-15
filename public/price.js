/* espace.md — one price engine for the app (app.html), the guest booking page (book.html) and the server (lib/core.ts).
   Change it here only: the three places load this same file.

   u  = a unit's settings (cfg.units[name]):
        price, dow {0..6: price for that weekday, overrides price + weekend %}, minn (min nights),
        xg (extra per guest per night) above xgFrom guests, xc (per child per night), los [{n, pct}] (discount from n nights),
        cfee (cleaning, once), bufB / bufA (free days kept before / after each stay), arr [weekdays a stay may start on],
        lead (book at least this many days ahead), maxn (longest stay)
   P  = company pricing: { weekend: % for Friday/Saturday nights, seasons: [{from:"MM-DD", to:"MM-DD", pct, min}] }
   R  = this unit's day rules: { "YYYY-MM-DD": { p: price, min: nights, cta: no arrival, ctd: no departure, x: closed } }  */
(function (root, make) { var api = make(); if (typeof module === "object" && module.exports) module.exports = api; else root.EsPrice = api; })(
  typeof self !== "undefined" ? self : this, function () {
  var DAY = 864e5;
  function toT(d) { return Date.parse(d + "T00:00:00Z"); }
  function fromT(x) { return new Date(x).toISOString().slice(0, 10); }
  function add(d, n) { return fromT(toT(d) + n * DAY); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function wd(d) { return new Date(d + "T00:00:00Z").getUTCDay(); }
  function numOr(v, f) { var x = +v; return v === "" || v == null || isNaN(x) ? f : x; }

  function seasonOf(P, d) {
    var md = d.slice(5), S = (P && P.seasons) || [];
    for (var i = 0; i < S.length; i++) { var x = S[i]; if (x.from && x.to && (x.from <= x.to ? md >= x.from && md <= x.to : md >= x.from || md <= x.to)) return x; }
    return null;
  }
  // the price of one night (the night that starts on d)
  function night(u, d, P, R) {
    var o = R && R[d];
    if (o && o.p != null && o.p !== "" && +o.p >= 0) return r2(+o.p);
    var w = wd(d), dw = u && u.dow ? +u.dow[w] : 0, p = dw > 0 ? dw : (+(u && u.price) || 0);
    var s = seasonOf(P, d); if (s) p *= 1 + (+s.pct || 0) / 100;
    if (!(dw > 0) && (w === 5 || w === 6) && P && +P.weekend) p *= 1 + (+P.weekend) / 100;
    return r2(p);
  }
  // shortest stay that may start on d
  function minStay(u, d, P, R, dirMin) {
    var s = seasonOf(P, d), o = R && R[d];
    return Math.max(1, Math.round(+(s && s.min) || +dirMin || 1), Math.round(+(u && u.minn) || 1), Math.round(+(o && o.min) || 1));
  }
  // days that must stay free between two stays in this unit (cleaning, airing)
  function gap(u) { return Math.max(0, Math.round(+(u && u.bufB) || 0), Math.round(+(u && u.bufA) || 0)); }
  // busy = [[date, nights], …] of the other stays in this unit
  function free(busy, din, n, g) {
    g = g || 0; var dout = add(din, n);
    for (var i = 0; i < (busy || []).length; i++) { var b = busy[i], bin = b[0], bout = add(b[0], b[1]);
      if (din < add(bout, g) && add(dout, g) > bin) return false; }
    return true;
  }
  /* can a stay din + n nights be taken? o = { P, R, dirMin, today, busy, pax, kids }
     why: closed | no_arrival | no_departure | arrival_day | lead | min | max | taken | guests */
  function check(u, din, n, o) {
    o = o || {}; var R = o.R || {}, dout = add(din, n);
    var min = minStay(u, din, o.P, R, o.dirMin);
    if (!(n > 0)) return { ok: false, why: "min", min: min };
    for (var i = 0; i < n; i++) { var r = R[add(din, i)]; if (r && r.x) return { ok: false, why: "closed", min: min, day: add(din, i) }; }
    if (R[din] && R[din].cta) return { ok: false, why: "no_arrival", min: min };
    if (R[dout] && R[dout].ctd) return { ok: false, why: "no_departure", min: min };
    if (u && u.arr && u.arr.length && u.arr.indexOf(wd(din)) < 0) return { ok: false, why: "arrival_day", min: min, days: u.arr };
    if (o.today && +(u && u.lead) > 0 && (toT(din) - toT(o.today)) / DAY < +u.lead) return { ok: false, why: "lead", min: min, lead: +u.lead };
    if (n < min) return { ok: false, why: "min", min: min };
    if (+(u && u.maxn) > 0 && n > +u.maxn) return { ok: false, why: "max", min: min, max: +u.maxn };
    var cap = +(u && u.guests) || 0, people = (+o.pax || 0) + (+o.kids || 0);
    if (cap && people > cap) return { ok: false, why: "guests", min: min, cap: cap };
    if (o.busy && !free(o.busy, din, n, gap(u))) return { ok: false, why: "taken", min: min };
    return { ok: true, min: min };
  }
  // the price of a stay, piece by piece: nights + extra guests + children − long-stay discount + cleaning
  function quote(u, din, n, o) {
    o = o || {}; var nights = [], base = 0;
    for (var i = 0; i < n; i++) { var d = add(din, i), p = night(u, d, o.P, o.R); nights.push({ d: d, p: p }); base += p; }
    base = r2(base);
    var pax = Math.max(0, Math.round(+o.pax || 0)), kids = Math.max(0, Math.round(+o.kids || 0));
    var incl = Math.round(numOr(u && u.xgFrom, 0)), xgN = +(u && u.xg) > 0 && incl > 0 ? Math.max(0, pax - incl) : 0;
    var xg = r2(xgN * (+(u && u.xg) || 0) * n), xc = r2(kids * (+(u && u.xc) || 0) * n);
    var sub = r2(base + xg + xc), losPct = 0;
    var L = (u && u.los) || []; for (var j = 0; j < L.length; j++) if (n >= +L[j].n && +L[j].pct > losPct) losPct = +L[j].pct;
    losPct = Math.min(90, losPct);
    var los = r2(sub * losPct / 100), cfee = n > 0 && +(u && u.cfee) > 0 ? r2(+u.cfee) : 0;
    var total = r2(sub - los + cfee);
    var flat = n > 0 && nights.every(function (x) { return x.p === nights[0].p; });
    return { nights: nights, base: base, avg: n ? r2(base / n) : 0, flat: flat, xgN: xgN, xg: xg, kids: kids, xc: xc, sub: sub, losPct: losPct, los: los, cfee: cfee, total: total };
  }
  // the old simple form, for places that only know a base price
  function stay(base, d, n, P) { var t = 0; for (var i = 0; i < n; i++) t += night({ price: base }, add(d, i), P); return r2(t); }
  return { seasonOf: seasonOf, night: night, minStay: minStay, gap: gap, free: free, check: check, quote: quote, stay: stay, add: add };
});
