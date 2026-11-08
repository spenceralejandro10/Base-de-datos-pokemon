import json,urllib.request,datetime
from pathlib import Path
from urllib.parse import quote
out={}
for term in ["https://app.getcollectr.com/?query=Mewtwo%20157%2F128","https://app.getcollectr.com/sets/category/3/30th-celebration?groupId=24722&cardType=cards"]:
 try:
  req=urllib.request.Request(term,headers={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"})
  with urllib.request.urlopen(req,timeout=40) as r:
   s=r.read().decode("utf-8","replace")
  pieces=[]
  for word in ["__NEXT_DATA__","__next_f.push","dehydratedState","productId","Mewtwo ex","157/128","30th Celebration","currentPrice","marketPrice","Holofoil"]:
   start=s.find(word)
   pieces.append({"term":word,"index":start,"excerpt":s[max(0,start-450):start+1050] if start>=0 else ""})
  out[term]={"length":len(s),"start":s[:1000],"terms":pieces,"last":s[-1000:]}
 except Exception as e:out[term]={"error":str(e)}
Path("collectr-debug.json").write_text(json.dumps(out,ensure_ascii=False,indent=2))
print([(u,v.get("length"),v.get("error")) for u,v in out.items()])
