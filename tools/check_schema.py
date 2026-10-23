"""Stops the deploy when the code uses a database table that schema.sql + migrations.sql never create.
(23.10.2026: seven tables were lost in a branch merge and the app failed with 500s for five days.)"""
import glob, re, sqlite3, sys
db = sqlite3.connect(":memory:")
db.executescript(open("schema.sql", encoding="utf-8").read())
for line in open("migrations.sql", encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("--"):
        try: db.execute(line)
        except sqlite3.Error: pass
have = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
skip = {"excluded", "sqlite_master"}
missing = {}
for f in glob.glob("functions/**/*.ts", recursive=True) + glob.glob("lib/**/*.ts", recursive=True):
    src = open(f, encoding="utf-8").read()
    for m in re.finditer(r"\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)\b", src):
        t = m.group(1)
        if t not in have and t not in skip: missing.setdefault(t, set()).add(f)
if missing:
    for t, fs in sorted(missing.items()): print(f"::error::table '{t}' is used in {', '.join(sorted(fs))} but schema.sql does not create it")
    sys.exit(1)
print(f"schema ok: {len(have)} tables")
