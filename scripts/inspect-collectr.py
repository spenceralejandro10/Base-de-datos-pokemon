#!/usr/bin/env python3
"""Segunda pasada para traducciones y sets japoneses; solo rama temporal."""
import concurrent.futures,datetime,json,re,time,unicodedata,urllib.parse,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
resfile=ROOT/"collectr-results.json"
sumfile=ROOT/"collectr-valuation.json"
rows=json.loads(resfile.read_text())
s=json.loads(sumfile.read_text())
rate=float(s["fx_cop_per_usd"])
aliases={
 55:"Paldean Student",
 119:"Raifort",
 212:"Festival Grounds",
 231:"Double Turbo Energy",
 259:"Awakening Drum",
 260:"Great Tusk ex",
 280:"Maximum Belt",
 286:"Earthen Vessel",
 291:"Counter Catcher",
 295:"Shadow Rider Calyrex VMAX",
 299:"Iron Valiant ex",
 301:"Lacey",
}
def norm(v):
 v=unicodedata.normalize("NFD",str(v or "").lower())
 v="".join(ch for ch in v if unicodedata.category(ch)!="Mn")
 return re.sub("[^a-z0-9]+"," ",v).strip()
def num(v):
 return "/".join(re.sub(r"(^|[A-Z])0+(?=\d)",r"\1",x) for x in str(v).upper().replace(" ","").split("/"))
def fetch(q):
 url="https://app.getcollectr.com/?query="+urllib.parse.quote(q)
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"})
 for i in range(2):
  try:
   with urllib.request.urlopen(req,timeout=35) as r:html=r.read().decode("utf-8","replace")
   break
  except Exception:
   if i:raise
   time.sleep(2)
 products={}
 for m in re.finditer(r"<script>self\.__next_f\.push\((\[.*?\])\)</script>",html,re.S):
  try:payload=json.loads(m.group(1))
  except:continue
  if len(payload)<2 or not isinstance(payload[1],str):continue
  for z in re.finditer(r'\{"product_id":"\d+"',payload[1]):
   try:p,_=json.JSONDecoder().raw_decode(payload[1][z.start():])
   except:continue
   if p.get("product_id") and p.get("latest_price") is not None:products[str(p["product_id"])]=p
 return list(products.values())
def match(r,products,alias):
 setnorm=norm(r["set"]);targetnum=num(r["number"])
 if targetnum in ("SINNUMERO",""):return None
 nametarget=norm(alias)
 matches=[]
 for p in products:
  if not p.get("is_card",True):continue
  try:usd=float(p.get("latest_price"))
  except:continue
  if usd<=0 or num(p.get("card_number"))!=targetnum:continue
  pn=norm(p.get("product_name"))
  pn=re.sub(r"\b(jp|japanese|english)\b","",pn).strip()
  if not (pn==nametarget or pn.startswith(nametarget+" ")):continue
  gn=norm(p.get("catalog_group"))
  group_ok=(
      setnorm==gn or
      (setnorm=="pokemon card 151" and gn=="pokemon 151") or
      (setnorm=="151" and gn in ("sv 151","151")) or
      (setnorm=="astral radiance trainer gallery" and "astral radiance" in gn) or
      (setnorm in gn or gn in setnorm) or
      (str(p.get("catalog_group_id"))=="1000142" and setnorm=="pokemon card 151")
  )
  if not group_ok:continue
  matches.append((usd,p))
 if not matches:return None
 usd,p=min(matches,key=lambda pair:pair[0])
 return {"usd":usd,"product_id":str(p["product_id"]),"set":p.get("catalog_group"),"number":p.get("card_number"),"finish":p.get("product_sub_type"),"source_url":"https://app.getcollectr.com/explore/product/"+str(p["product_id"]),"match_score":24,"match_note":"JP group alias" if setnorm=="pokemon card 151" else ("Traducción al inglés verificada por número" if norm(alias)!=norm(r["name"]) else "Exacta")}
def retry(r):
 names=[aliases.get(r["id"],r["name"])]
 if r["id"]==55:names+=["Friends in Paldea"]
 if r["id"]==119:names+=["Lacey"]
 if r["id"]==270:return r,[]
 matched=[]
 for name in names:
  query=name+" "+str(r["number"])
  try:products=fetch(query)
  except Exception as e:
   matched.append({"q":query,"error":str(e)});continue
  matched.append({"q":query,"found":len(products),"candidates":[{"name":x.get("product_name"),"set":x.get("catalog_group"),"number":x.get("card_number"),"usd":x.get("latest_price")} for x in products[:8]]})
  col=match(r,products,name)
  if col:
   r["collectr"]=col
   r["resolved_query"]=query
   break
 return r,matched
missing=[r for r in rows if not r.get("collectr")]
found=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 futures={pool.submit(retry,r):r["id"] for r in missing}
 for f in concurrent.futures.as_completed(futures):
  try:r,trace=f.result();found.append({"id":r["id"],"name":r["name"],"matched":bool(r.get("collectr")),"tests":trace})
  except Exception as e:found.append({"id":futures[f],"error":str(e)})
coll=[r for r in rows if r.get("collectr")]
miss=[r for r in rows if not r.get("collectr")]
both=[r for r in coll if r.get("tcgplayer_usd") is not None]
collusd=sum(r["collectr"]["usd"]*r["quantity"] for r in coll)
same_c=sum(r["collectr"]["usd"]*r["quantity"] for r in both)
same_t=sum(r["tcgplayer_usd"]*r["quantity"] for r in both)
fallback=sum(r["tcgplayer_usd"]*r["quantity"] for r in miss if r.get("tcgplayer_usd") is not None)
s.update({
 "generated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "collectr_references":len(coll),
 "collectr_units":sum(r["quantity"] for r in coll),
 "collectr_only_subtotal_usd":round(collusd,2),
 "collectr_only_subtotal_cop":round(collusd*rate),
 "missing_references":len(miss),
 "missing_units":sum(r.get("quantity",0) for r in miss),
 "same_refs_collectr_cop":round(same_c*rate),
 "same_refs_tcgplayer_cop":round(same_t*rate),
 "same_refs_difference_cop":round((same_c-same_t)*rate),
 "same_refs_count":len(both),
 "tcgplayer_fallback_references":sum(r.get("tcgplayer_usd") is not None for r in miss),
 "tcgplayer_fallback_units":sum(r.get("quantity",0) for r in miss if r.get("tcgplayer_usd") is not None),
 "estimated_mixed_total_cop":round((collusd+fallback)*rate),
 "unvalued_references":sum(r.get("tcgplayer_usd") is None for r in miss),
 "unvalued_units":sum(r.get("quantity",0) for r in miss if r.get("tcgplayer_usd") is None),
 "top_valued_collectr":[{"name":r["name"],"number":r["number"],"set":r["set"],"quantity":r["quantity"],"collectr_unit_usd":r["collectr"]["usd"],"total_cop":round(r["collectr"]["usd"]*r["quantity"]*rate)} for r in sorted(coll,key=lambda r:-r["collectr"]["usd"]*r["quantity"])[:15]],
 "missing_examples":[{"id":r["id"],"name":r["name"],"number":r["number"],"set":r["set"],"quantity":r.get("quantity",0)} for r in miss]
})
resfile.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+"\n")
sumfile.write_text(json.dumps(s,ensure_ascii=False,indent=2)+"\n")
(ROOT/"collectr-retry-samples.json").write_text(json.dumps(found,ensure_ascii=False,indent=2))
print("RESULT",json.dumps({k:v for k,v in s.items() if k not in ("top_valued_collectr","missing_examples")},ensure_ascii=False))
