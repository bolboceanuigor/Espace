# Shared by extract and build: which Russian text in public/app.html gets translated.
import re
RUN = re.compile(r'[А-Яа-яЁё][А-Яа-яЁё0-9 ,.:;!?«»()\-–—/+%№]*[А-Яа-яЁё.!?»)]|[А-Яа-яЁё]')
# values stored in the database: they stay Russian in code (both builds read and write the same data);
# the translated builds only show them translated on screen (DISPLAY_* in build_i18n.py)
DATA = {"Кэш", "Счёт", "Счёт+Кэш", "Прямой", "Повторный", "Коммунальные", "Уборка", "Ремонт", "Бельё и химия",
        "Комиссии", "Прочее", "Интернет и ТВ", "Налоги", "Квартира 1", "из смены", "доплата к авансу"}
REGEX_LIT = re.compile(r'/((?:[^/\n\\*]|\\.)(?:[^/\n\\]|\\.)*)/[gimsuy]*(?=[.,;)}\s])')

def protected_spans(s):
    spans = []
    for m in REGEX_LIT.finditer(s):
        head = s[max(0, m.start() - 12):m.start()].rstrip()
        before = head[-1:]
        if before and before not in "(,=:!&|?;{}[>" and not head.endswith("return"):
            continue  # a "/" inside text, not a regex
        if re.search(r'[А-Яа-яЁё]', m.group(1)) and len(m.group(1)) < 400 and not m.group(1).startswith('*'):
            spans.append((m.start(), m.end()))
    return spans

def runs(s):
    spans = protected_spans(s)
    def inside(i): return any(a <= i < b for a, b in spans)
    for m in RUN.finditer(s):
        t = m.group(0)
        # keep trailing ")" only when the run opened a "("
        if t.endswith(")") and t.count("(") < t.count(")"):
            t = t[:-1].rstrip()
        if inside(m.start()) or t.strip() in DATA:
            continue
        yield m.start(), m.start() + len(t), t
