import json,re,urllib.request
from pathlib import Path
from urllib.parse import quote
def fetch(url):
 req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"})
 with urllib.request.urlopen(req,timeout=35) as resp: return resp.read().decode("utf-8","replace")
def extract(s):
 products=[]
 for mat in re.finditer(r'<script>self\.__next_f\.push\((\[.*?\])\)</script>',s,re.S):
  try: payload=json.loads(mat.group(1))
  except: continue
  if len(payload)<2 or not isinstance(payload[1],str):continue
  val=payload[1]
  for m in re.finditer(r'\{"product_id":"\d+"',val):
   try: product,end=json.JSONDecoder().raw_decode(val[m.start():])
   except Exception: continue
   if product.get("product_id"): products.append(product)
 return products
out={}
for q in ["Mewtwo 157/128","Lugia 149/147","Vaporeon ex 149/131","Hydrapple ex 167/142","Blastoise ex 016/049"]:
 try:
  u="https://app.getcollectr.com/?query="+quote(q)
  html=fetch(u)
  data=extract(html)
  out[q]={"n":len(data),"sample":[{k:p.get(k) for k in ["product_id","product_name","catalog_group","catalog_group_id","card_number","product_sub_type","latest_price","older_market_price","market_price_diff","grade_id"]} for p in data[:10]]}
 except Exception as e:out[q]={"error":str(e)}
Path("collectr-debug.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
print([(q,o.get("n"),o.get("error")) for q,o in out.items()])
