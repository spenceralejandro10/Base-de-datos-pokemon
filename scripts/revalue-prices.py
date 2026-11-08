#!/usr/bin/env python3
"""Actualiza TCGplayer y compara inventario fijo con el respaldo anterior."""
import datetime
import json
import pathlib
import re
import subprocess
import sys
import unicodedata
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = (ROOT / "market-prices.js").read_text(encoding="utf-8")
SNAP = ROOT / "market-snapshot.js"
REPORT = ROOT / "market-valuation.json"
BASE = "https://cnivcnexsqobipvqxero.supabase.co"
KEY = "sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU"

def load_js(path, var):
    src = path.read_text(encoding="utf-8")
    return json.loads(src.split(var + "=", 1)[1].strip().rstrip(";"))

def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

def cardno(s):
    out = []
    for part in str(s or "").upper().replace(" ", "").split("/"):
        out.append(re.sub(r"(^|[A-Z])0+(?=\d)", r"\1", part))
    return "/".join(out)

def base_name(s):
    s = re.sub(r"\s*[-–]\s*[A-Z]*\d+(?:\s*/\s*[A-Z]*\d+)?", "", str(s or ""), count=1, flags=re.I)
    return norm(s)

GROUPS = {norm(n): f"{cat}-{gid}" for n, cat, gid in
          re.findall(r'"([^"]+)":\[(\d+),(\d+)\]', SOURCE)}
NAMES = {
    "energia fuego basica": "basic fire energy",
    "arbol colosal": "grand tree",
    "ondulagua ex": "walking wake ex",
    "estudiante de paldea": "paldean student",
    "cloe": "lacey", "e nigma": "iono",
    "ferrocuello": "iron jugulis", "furioseta": "brute bonnet",
    "calyrex jinete glacial vmax": "ice rider calyrex vmax"
}

def group_for(c):
    key = norm(c["set"])
    group = GROUPS.get(key)
    if norm(c["language"]) == "japones":
        if key == "151":
            group = GROUPS.get("pokemon card 151")
        if not group or not group.startswith("85-"):
            return None
    elif group and group.startswith("85-"):
        return None
    if key == "astral radiance" and str(c["number"]).upper().startswith("TG"):
        group = "3-3068"
    return group

def quote(c, snapshot):
    group = group_for(c)
    group_data = snapshot.get("groups", {}).get(group, {})
    wanted = cardno(c["number"])
    name = NAMES.get(norm(c["name"]), norm(c["name"]))
    candidates = []
    for product in group_data.get("products", []):
        n = base_name(product["name"])
        num = cardno(product["number"])
        number_ok = num == wanted or ("/" not in wanted and num.split("/")[0] == wanted)
        name_ok = n == name or n.startswith(name + " ")
        forbidden = re.search(r"\b(metal|jumbo|oversized|stamped|world championship)\b", n)
        if number_ok and name_ok and not forbidden:
            candidates.append(product)
    exact = [p for p in candidates if base_name(p["name"]) == name]
    matches = exact if exact else candidates
    if len(matches) != 1:
        return None
    p = matches[0]
    values = [v["usd"] for v in p["prices"] if isinstance(v.get("usd"), (int, float)) and v["usd"] > 0]
    if not values:
        return None
    return {"usd": min(values), "product_id": p["id"], "variants": len(values)}

def public_table(table, select):
    u = f"{BASE}/rest/v1/{table}?select={select}"
    req = urllib.request.Request(u, headers={"apikey": KEY, "Accept": "application/json", "User-Agent": "Boveda-TCG/2026"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        rows = json.load(resp)
    if not isinstance(rows, list):
        raise ValueError(table + ": response not an array")
    return rows

def inventory():
    # La página carga catálogo, correcciones y existencias desde estas mismas tablas.
    catalog = public_table("pokemon_catalog", "id,ordinal,name,card_number,set_name,release_year,language,quantity")
    overrides = {int(r["card_id"]): r for r in public_table("pokemon_card_overrides", "card_id,set_name,language,validation_note")}
    stocks = {int(r["card_id"]): r for r in public_table("pokemon_stock_overrides", "card_id,quantity_available,is_listed")}
    if len(catalog) < 300:
        raise ValueError("El catalogo remoto esta incompleto: " + str(len(catalog)))
    cards = []
    for r in catalog:
        id_ = int(r["id"])
        o = overrides.get(id_, {})
        st = stocks.get(id_, {})
        cards.append({"id": id_, "name": r["name"], "number": r["card_number"],
                      "set": o.get("set_name") or r["set_name"],
                      "language": o.get("language") or r["language"],
                      "quantity": int(st.get("quantity_available") if st.get("quantity_available") is not None else r["quantity"]),
                      "is_listed": st.get("is_listed", True)})
    return cards

def main():
    previous = load_js(SNAP, "window.MARKET_SNAPSHOT")
    cards = inventory()
    # Genera una instantanea nueva solo si todas las consultas terminan bien.
    subprocess.run([sys.executable, str(ROOT / "scripts/update-prices.py")], check=True)
    current = load_js(SNAP, "window.MARKET_SNAPSHOT")
    old_fx = float(previous["fx"]["cop"])
    new_fx = float(current["fx"]["cop"])
    old_total = new_total = common_old = common_new = 0.0
    old_usd = new_usd = 0.0
    old_count = new_count = common_count = 0
    old_units = new_units = common_units = 0
    changes = []
    for c in cards:
        qty = c["quantity"]
        if qty <= 0:
            continue
        a = quote(c, previous)
        b = quote(c, current)
        if a:
            old_total += a["usd"] * old_fx * qty
            old_count += 1
            old_units += qty
        if b:
            new_total += b["usd"] * new_fx * qty
            new_count += 1
            new_units += qty
        if a and b:
            common_old += a["usd"] * old_fx * qty
            common_new += b["usd"] * new_fx * qty
            old_usd += a["usd"] * qty
            new_usd += b["usd"] * qty
            common_count += 1
            common_units += qty
            delta = (b["usd"] * new_fx - a["usd"] * old_fx) * qty
            changes.append({"id": c["id"], "name": c["name"], "number": c["number"],
                            "set": c["set"], "quantity": qty,
                            "before_usd_each": round(a["usd"], 2),
                            "now_usd_each": round(b["usd"], 2),
                            "change_cop": round(delta),
                            "now_cop": round(b["usd"] * new_fx * qty)})
    total_units = sum(max(0, c["quantity"]) for c in cards)
    comparable_change = common_new - common_old
    report = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "baseline_snapshot_at": min((v["updatedAt"] for v in previous["groups"].values()), default=None),
        "current_snapshot_at": min((v["updatedAt"] for v in current["groups"].values()), default=None),
        "baseline_fx_cop": old_fx, "current_fx_cop": new_fx,
        "references_total": len(cards), "units_total": total_units,
        "references_with_stock": sum(c["quantity"] > 0 for c in cards),
        "old_priced_references": old_count, "old_priced_units": old_units,
        "new_priced_references": new_count, "new_priced_units": new_units,
        "common_priced_references": common_count, "common_priced_units": common_units,
        "previous_total_priced_cop": round(old_total),
        "current_total_priced_cop": round(new_total),
        "previous_comparable_cop": round(common_old),
        "current_comparable_cop": round(common_new),
        "comparable_change_cop": round(comparable_change),
        "comparable_change_pct": round(100 * comparable_change / common_old, 2) if common_old else None,
        "market_price_change_usd": round(new_usd - old_usd, 2),
        "market_price_effect_cop": round((new_usd - old_usd) * old_fx),
        "exchange_effect_cop": round((new_fx - old_fx) * new_usd),
        "loss_if_negative_cop": round(max(0, -comparable_change)),
        "top_declines": sorted(changes, key=lambda r: r["change_cop"])[:20],
        "top_gains": sorted(changes, key=lambda r: r["change_cop"], reverse=True)[:10],
        "unpriced_references": [dict(id=c["id"], name=c["name"], number=c["number"], set=c["set"], quantity=c["quantity"]) for c in cards if c["quantity"] > 0 and not quote(c, current)]
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Obliga al navegador a cargar la nueva instantanea sin alterar otra cosa.
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    html, replaced = re.subn(r'(market-snapshot\.js\?v=)(\d+)', lambda m: m[1] + str(int(m[2]) + 1), html, count=1)
    if replaced != 1:
        raise ValueError("No se encontro el script market-snapshot para invalidar cache")
    index.write_text(html, encoding="utf-8")
    print("VALUATION_RESULT=" + json.dumps({k: v for k, v in report.items() if k not in ("top_declines", "top_gains", "unpriced_references")}, ensure_ascii=False))
    print("TOP_DECLINES=" + json.dumps(report["top_declines"][:10], ensure_ascii=False))
    print("UNPRICED=" + str(len(report["unpriced_references"])))

if __name__ == "__main__":
    main()
