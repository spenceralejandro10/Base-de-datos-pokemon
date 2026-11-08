import json,re,urllib.request
from pathlib import Path
from urllib.parse import quote
def fetch(q):
 req=urllib.request.Request("https://app.getcollectr.com/?query="+quote(q),headers={"User-Agent":"Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36"})
 with urllib.request.urlopen(req,timeout=35) as r:s=r.read().decode("utf-8","replace")
 products={}
 for m in re.finditer(r"<script>self\.__next_f\.push\((\[.*?\])\)</script>",s,re.S):
  try:v=json.loads(m.group(1))[1]
  except:continue
  if not isinstance(v,str):continue
  for x in re.finditer(r'\{"product_id":"\d+"',v):
   try:p,_=json.JSONDecoder().raw_decode(v[x.start():])
   except:continue
   if p.get("product_id"):products[p["product_id"]]=p
 return [{k:p.get(k) for k in ("product_id","product_name","catalog_group","catalog_group_id","card_number","latest_price","product_sub_type")} for p in products.values()]
q=["Squirtle 170/165","Mewtwo 183/165","Mr. Mime 179/165","Paldean Student 065/165","Lacey 142/131","Festival Grounds 108/131","Great Tusk ex 053/091","Sin número"]
out={}
for x in q:
 try:out[x]=fetch(x)[:15]
 except Exception as e:out[x]=str(e)
Path("collectr-retry-samples.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
