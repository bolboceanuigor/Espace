#!/usr/bin/env python3
"""Builds public/app-ro.html (Romanian UI) from public/app.html (Russian UI).

Every Russian text run found by i18n_common.runs() is replaced with its translation from tools/ro/*.json.
Values stored in the database (i18n_common.DATA) stay Russian in the code, so both builds share the same data;
in the Romanian build a small script translates them only on screen.
Run: python3 tools/build_ro.py      (fails if a string has no translation)
"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from i18n_common import runs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "public/app.html"), os.path.join(ROOT, "public/app-ro.html")

# on-screen names for the stored values
DISPLAY = [("Бельё и химия", "Lenjerie și detergenți"), ("Интернет и ТВ", "Internet și TV"), ("доплата к авансу", "rest de plată la avans"),
           ("Коммунальные", "Utilități"), ("Счёт+Кэш", "Cont+Numerar"), ("Повторный", "Revenit"), ("Квартира", "Apartament"),
           ("из смены", "din tură"), ("Комиссии", "Comisioane"), ("Прямой", "Direct"), ("Налоги", "Impozite"), ("Прочее", "Altele"),
           ("Уборка", "Curățenie"), ("Ремонт", "Reparație"), ("Счёт", "Cont"), ("Кэш", "Numerar")]

MAPPER = """<script>
// Romanian build: values stored in Russian (payment ways, sources, expense categories) are translated on screen only.
(function(){
const M=%s.map(([a,b])=>[new RegExp("(^|[^А-Яа-яЁё])"+a.replace(/[+]/g,"\\\\+")+"(?![А-Яа-яЁё])","g"),b]);
const CY=/[А-Яа-яЁё]/,SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1};
function tr(v){for(const [r,b] of M)v=v.replace(r,(m,p)=>p+b);return v}
function fix(n){
  if(n.nodeType===3){if(CY.test(n.nodeValue)){const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v}return}
  if(n.nodeType!==1||SKIP[n.tagName]||n.isContentEditable)return;
  for(const c of n.childNodes)fix(c);
}
fix(document.body);
new MutationObserver(ms=>{for(const m of ms){if(m.type==="characterData")fix(m.target);else m.addedNodes.forEach(fix)}})
  .observe(document.body,{childList:true,subtree:true,characterData:true});
})();
</script>
"""

def main():
    s = open(SRC, encoding="utf-8").read()
    d = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "tools/ro/*.json"))):
        d.update(json.load(open(f, encoding="utf-8")))
    bad = [k for k, v in d.items() if any(q in v for q in "\"'`\\")]
    if bad: sys.exit("translations must not contain quotes or backslashes: %r" % bad[:5])
    found = list(runs(s))
    missing = sorted({t for _, _, t in found if t not in d}, key=len, reverse=True)
    if missing: sys.exit("no Romanian for %d strings, add them to tools/ro/*.json:\n%s" % (len(missing), "\n".join(missing[:60])))
    out, last = [], 0
    for a, b, t in found:
        # one-letter object keys like {"О":"Оксана"} are data, keep them
        if len(t) == 1 and s[b:b + 2] == '":':
            continue
        out.append(s[last:a]); out.append(d[t]); last = b
    out.append(s[last:])
    r = "".join(out)
    # language switches and the few spots where code inspects already-translated text
    reps = [('<html lang="ru">', '<html lang="ro">'), ('const LANG="ru";', 'const LANG="ro";'),
            ('/просмотр/.test(t)', '/просмотр|vizualizare/.test(t)'),
            ('/Не (сохранил|удал|получил)/.test(t)', '/Не (сохранил|удал|получил)|Nu s-a (salvat|putut|încasat)/.test(t)'),
            ('gLang="ru", gTxtLang="ru"', 'gLang="ro", gTxtLang="ro"')]
    for a, b in reps:
        if a not in r: sys.exit("build_ro: pattern not found: " + a)
        r = r.replace(a, b, 1)
    r = r.replace("</body>", MAPPER % json.dumps(DISPLAY, ensure_ascii=False) + "</body>", 1)
    left = sorted({t for _, _, t in runs(r)} - {k for k, _ in DISPLAY} - {"О", "И"})
    open(OUT, "w", encoding="utf-8").write(r)
    print("app-ro.html: %d strings translated, %d bytes%s" % (len(found), len(r), (", Cyrillic left: %s" % left[:10]) if left else ""))

if __name__ == "__main__":
    main()
