from sqlalchemy import func


def normalize_text(value: str | None) -> str:
    text = (value or "").strip().lower()
    replacements = {
        "ي": "ی",
        "ك": "ک",
        "ة": "ه",
        "ۀ": "ه",
        "ؤ": "و",
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "‌": "",
        " ": "",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text


def normalize_sql_expr(column):
    expr = func.lower(func.coalesce(column, ""))
    for src, dst in [
        ("ي", "ی"),
        ("ك", "ک"),
        ("ة", "ه"),
        ("ۀ", "ه"),
        ("ؤ", "و"),
        ("أ", "ا"),
        ("إ", "ا"),
        ("آ", "ا"),
        ("‌", ""),
        (" ", ""),
    ]:
        expr = func.replace(expr, src, dst)
    return expr
