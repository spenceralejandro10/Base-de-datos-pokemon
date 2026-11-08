#!/usr/bin/env python3
"""Lectura de precios Collectr para la colección sin cambiar el sitio en main."""
import concurrent.futures
import datetime
import json
import pathlib
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parent.parent
FXDATA=json.loads((ROOT/"market-snapshot.js").read_text().split("window.MARKET_SNAPSHOT=",1)[1].strip().rstrip(";"))
RATE=float(FXDATA["fx"]["cop"])
SOURCE=(ROOT/"market-prices.js").read_text()
GROUPS={}

def norm(s):
    s=unicodedata.normalize("NFD",str(s or "")).lower()
    s="".join(ch for ch in s if unicodedata.category(ch)!="Mn")
    return re.sub("[^a-z0-9]+"," ",s).strip()

for n,cat,gid in re.findall(r'"([^"]+)":\[(\d+),(\d+)\]',SOURCE):
    GROUPS[norm(n)]=f"{cat}-{gid}"
NAMES={"energia fuego basica":"basic fire energy","arbol colosal":"grand tree","ondulagua ex":"walking wake ex","estudiante de paldea":"paldean student","cloe":"lacey","e nigma":"iono","ferrocuello":"iron jugulis","furioseta":"brute bonnet","calyrex jinete glacial vmax":"ice rider calyrex vmax"}

def cn(s):
    out=[]
    for part in str(s or "").upper().replace(" ","").split("/"):
        out.append(re.sub(r"(^|[A-Z])0+(?=\d)",r"\1",part))
    return "/".join(out)

def group_for(c):
    s=norm(c["set"])
    group=GROUPS.get(s)
    if norm(c["language"])=="japones":
        if s=="151":group=GROUPS.get("pokemon card 151")
        if group and not group.startswith("85-"):group=None
    elif group and group.startswith("85-"):group=None
    if s=="astral radiance" and str(c["number"]).upper().startswith("TG"):group="3-3068"
    return group

def base_name(s):
    s=re.sub(r"\s*[-–]\s*[A-Z]*\d+(?:\s*/\s*[A-Z]*\d+)?","",str(s or ""),count=1,flags=re.I)
    return norm(s)

def tcg_quote(c):
    key=group_for(c)
    wanted=cn(c["number"])
    name=NAMES.get(norm(c["name"]),norm(c["name"]))
    vals=[]
    for p in FXDATA.get("groups",{}).get(key,{}).get("products",[]):
        n=base_name(p["name"])
        num=cn(p["number"])
        exact_number=num==wanted or ("/" not in wanted and num.split("/")[0]==wanted)
        if exact_number and (n==name or n.startswith(name+" ")) and not re.search(r"\b(metal|jumbo|oversized|stamped|world championship)\b",n):
            vals.append(p)
    exact=[p for p in vals if base_name(p["name"])==name]
    arr=exact if exact else vals
    if len(arr)!=1:return None
    p=arr[0]
    usd=[float(v["usd"]) for v in p["prices"] if isinstance(v.get("usd"),(int,float)) and v["usd"]>0]
    return {"id":str(p["id"]),"usd":min(usd)} if usd else None

BASE="https://cnivcnexsqobipvqxero.supabase.co"
KEY="sb_publishable_6UjwLuM-op0-OBKWlbusTw_qmLNZVfU"
def fetch_json(url):
    req=urllib.request.Request(url,headers={"apikey":KEY,"Accept":"application/json","User-Agent":"BovedaTCG-Collectr-Audit/1.0"})
    with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)
def inv():
    rows=fetch_json(BASE+"/rest/v1/pokemon_catalog?select=id,ordinal,name,card_number,set_name,release_year,language,quantity&order=id.asc")
    overrides={int(x["card_id"]):x for x in fetch_json(BASE+"/rest/v1/pokemon_card_overrides?select=card_id,set_name,language")}
    stocks={int(x["card_id"]):x for x in fetch_json(BASE+"/rest/v1/pokemon_stock_overrides?select=card_id,quantity_available,is_listed")}
    if len(rows)<300:raise ValueError("Catálogo incompleto: "+str(len(rows)))
    cards=[]
    for r in rows:
        id_=int(r["id"]);o=overrides.get(id_,{});st=stocks.get(id_,{})
        cards.append({"id":id_,"name":r["name"],"number":r["card_number"],"set":o.get("set_name") or r["set_name"],"language":o.get("language") or r["language"],"quantity":int(st["quantity_available"] if st.get("quantity_available") is not None else r["quantity"])})
    return cards

def fetch_collectr(q):
    url="https://app.getcollectr.com/?query="+urllib.parse.quote(q)
    req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req,timeout=35) as r:return r.read().decode("utf-8","replace"),url
        except Exception as e:
            if attempt==2:raise
            time.sleep(1.5*(attempt+1))
    raise RuntimeError("Sin respuesta Collectr")

def extract(html):
    products={}
    decoder=json.JSONDecoder()
    for m in re.finditer(r"<script>self\.__next_f\.push\((\[.*?\])\)</script>",html,re.S):
        try:payload=json.loads(m.group(1))
        except:continue
        if len(payload)<2 or not isinstance(payload[1],str):continue
        text=payload[1]
        for v in re.finditer(r'\{"product_id":"\d+"',text):
            try:p,stop=decoder.raw_decode(text[v.start():])
            except:continue
            if p.get("product_id") and p.get("latest_price") is not None:
                k=(str(p["product_id"]),str(p.get("product_sub_type","")))
                products[k]=p
    return list(products.values())

def best(c,products,tcg):
    target=cn(c["number"])
    targetname=NAMES.get(norm(c["name"]),norm(c["name"]))
    expected=group_for(c)
    candidates=[]
    for p in products:
        try:price=float(p["latest_price"])
        except (ValueError,TypeError):continue
        if price<=0 or p.get("is_card") is False:continue
        num=cn(p.get("card_number"))
        if not (num==target or ("/" not in target and num.split("/")[0]==target)):continue
        name=norm(p.get("product_name",""))
        name=re.sub(r"\b(jp|english|japanese)\b","",name).strip()
        name_score=0
        if name==targetname:name_score=12
        elif name.startswith(targetname+" "):name_score=9
        elif targetname.startswith(name+" "):name_score=6
        elif tcg and str(p["product_id"])==tcg["id"]:name_score=12
        else:continue
        group_name=norm(p.get("catalog_group",""))
        set_name=norm(c["set"])
        gid=str(p.get("catalog_group_id",""))
        group_score=0
        if tcg and str(p["product_id"])==tcg["id"]:group_score=50
        elif expected and expected.split("-")[1]==gid:group_score=30
        elif group_name==set_name:group_score=25
        elif set_name=="151" and ("151" in group_name):group_score=18
        elif "special deck set ex" in set_name and "special deck set ex" in group_name:group_score=18
        elif set_name in group_name or group_name in set_name:group_score=12
        if group_score<=0:continue
        candidates.append((group_score+name_score,price,p))
    if not candidates:return None
    high=max(x[0] for x in candidates)
    equal=[x for x in candidates if x[0]==high]
    score,price,p=min(equal,key=lambda x:x[1])
    return {"usd":price,"product_id":str(p["product_id"]),"set":p.get("catalog_group"),"number":p.get("card_number"),"finish":p.get("product_sub_type"),"source_url":"https://app.getcollectr.com/explore/product/"+str(p["product_id"]),"match_score":score}

cards=inv()
cards=[c for c in cards if c["quantity"]>0]
def work(c):
    tcg=tcg_quote(c)
    name=NAMES.get(norm(c["name"]),c["name"])
    query=name+" "+str(c["number"])
    row={**c,"query":query,"tcgplayer_usd":tcg["usd"] if tcg else None}
    try:
        html,url=fetch_collectr(query)
        data=extract(html)
        col=best(c,data,tcg)
        if not col:
            # Reconsultar solo el número cuando los nombres difieren por traducción o formato.
            try:
                html,url=fetch_collectr(str(c["number"]))
                col=best(c,extract(html),tcg)
            except Exception as e:row["fallback_error"]=str(e)
        row["collectr"]=col
        row["found_products"]=len(data)
    except Exception as e:row["error"]=str(e)
    return row

print("Searching",len(cards),"references",flush=True)
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
    futures={pool.submit(work,c):c["id"] for c in cards}
    for i,f in enumerate(concurrent.futures.as_completed(futures),1):
        try:results.append(f.result())
        except Exception as e:results.append({"id":futures[f],"error":str(e)})
        if i%25==0:print("PROGRESS",i,len(cards),flush=True)
results.sort(key=lambda x:x["id"])
units=sum(r.get("quantity",0) for r in results)
coll=[r for r in results if r.get("collectr")]
matches_with_tcg=[r for r in coll if r.get("tcgplayer_usd") is not None]
miss=[r for r in results if not r.get("collectr")]
collectr_usd=sum(r["collectr"]["usd"]*r["quantity"] for r in coll)
tcg_same_usd=sum(r["tcgplayer_usd"]*r["quantity"] for r in matches_with_tcg)
collectr_same_usd=sum(r["collectr"]["usd"]*r["quantity"] for r in matches_with_tcg)
fallback_tcg_usd=sum(r["tcgplayer_usd"]*r["quantity"] for r in miss if r.get("tcgplayer_usd") is not None)
summary={
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "source":"Collectr public catalog / raw ungraded price",
 "fx_cop_per_usd":RATE,"fx_date":FXDATA["fx"].get("updatedAt"),
 "all_references_in_stock":len(cards),"all_units_in_stock":units,
 "collectr_references":len(coll),"collectr_units":sum(r["quantity"] for r in coll),
 "collectr_only_subtotal_usd":round(collectr_usd,2),"collectr_only_subtotal_cop":round(collectr_usd*RATE),
 "missing_references":len(miss),"missing_units":sum(r.get("quantity",0) for r in miss),
 "same_refs_collectr_cop":round(collectr_same_usd*RATE),
 "same_refs_tcgplayer_cop":round(tcg_same_usd*RATE),
 "same_refs_difference_cop":round((collectr_same_usd-tcg_same_usd)*RATE),
 "same_refs_count":len(matches_with_tcg),
 "tcgplayer_fallback_references":sum(r.get("tcgplayer_usd") is not None for r in miss),
 "tcgplayer_fallback_units":sum(r.get("quantity",0) for r in miss if r.get("tcgplayer_usd") is not None),
 "estimated_mixed_total_cop":round((collectr_usd+fallback_tcg_usd)*RATE),
 "unvalued_references":sum(r.get("tcgplayer_usd") is None for r in miss),
 "unvalued_units":sum(r.get("quantity",0) for r in miss if r.get("tcgplayer_usd") is None),
 "top_valued_collectr":[{"name":r["name"],"number":r["number"],"set":r["set"],"quantity":r["quantity"],"collectr_unit_usd":r["collectr"]["usd"],"total_cop":round(r["collectr"]["usd"]*r["quantity"]*RATE)} for r in sorted(coll,key=lambda r:-r["collectr"]["usd"]*r["quantity"])[:15]],
 "missing_examples":[{"id":r["id"],"name":r["name"],"number":r["number"],"set":r["set"],"quantity":r.get("quantity",0),"error":r.get("error")} for r in miss[:35]]
}
(ROOT/"collectr-results.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n")
(ROOT/"collectr-valuation.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n")
print("COLLECTR_SUMMARY="+json.dumps({k:v for k,v in summary.items() if k not in ("top_valued_collectr","missing_examples")},ensure_ascii=False))
