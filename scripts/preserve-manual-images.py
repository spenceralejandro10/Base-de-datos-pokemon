#!/usr/bin/env python3
"""Copy existing manual image bytes to public storage. Never delete or renumber."""
import concurrent.futures,datetime,hashlib,io,json,pathlib,re,urllib.request,urllib.parse,urllib.error
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent.parent
source=(ROOT/'shared-images.js').read_text()
BASE=re.search(r'URL_BASE="([^"]+)"',source)[1]
KEY=re.search(r'KEY="([^"]+)"',source)[1]
BUCKET='pokemon-gallery-overrides'
BACKUP=ROOT/'manual-image-backup.json'
def request(url,method='GET',data=None,headers=None):
    return urllib.request.urlopen(urllib.request.Request(url,method=method,data=data,headers={'apikey':KEY,'User-Agent':'BovedaTCG/1.0',**(headers or {})}),timeout=30)
def preserve(row):
    old=row['image_url'];card_id=int(row['card_key'].split('|')[0])
    try:
        if old.startswith(BASE+'/storage/v1/object/public/'+BUCKET+'/'):return {'id':card_id,'status':'already-public'}
        with urllib.request.urlopen(urllib.request.Request(old,headers={'User-Agent':'BovedaTCG/1.0'}),timeout=25) as response: data=response.read(6291457)
        if len(data)>6291456:raise ValueError('Image exceeds 6 MB')
        image=Image.open(io.BytesIO(data));image.verify()
        kind={'JPEG':('jpg','image/jpeg'),'PNG':('png','image/png'),'WEBP':('webp','image/webp')}.get(image.format)
        if not kind:raise ValueError('Unsupported image')
        ext,mime=kind;path=f'cards/manual-{card_id}-{hashlib.sha256(data).hexdigest()[:24]}.{ext}'
        public=BASE+'/storage/v1/object/public/'+BUCKET+'/'+path
        try:
            with request(BASE+'/storage/v1/object/'+BUCKET+'/'+path,'POST',data,{'Content-Type':mime,'x-upsert':'false','cache-control':'31536000'}) as response: response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (400,409):raise
            # An existing object is accepted only after verifying all its bytes below.
        with urllib.request.urlopen(public,timeout=25) as response:copied=response.read()
        if hashlib.sha256(copied).digest()!=hashlib.sha256(data).digest():raise ValueError('Public image differs from original')
        # Compare the original URL to avoid replacing concurrent manual changes.
        filters=urllib.parse.urlencode({'card_key':'eq.'+row['card_key'],'image_url':'eq.'+old})
        payload=json.dumps({'image_url':public,'updated_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}).encode()
        with request(BASE+'/rest/v1/pokemon_image_overrides?'+filters,'PATCH',payload,{'Content-Type':'application/json','Prefer':'return=representation'}) as response:updated=json.load(response)
        return {'id':card_id,'status':'preserved' if len(updated)==1 else 'changed-concurrently','url':public,'bytes':len(data)}
    except Exception as error:return {'id':card_id,'status':'failed','error':str(error)}
def main():
    with request(BASE+'/rest/v1/pokemon_image_overrides?select=card_key,image_url,updated_at') as response:rows=json.load(response)
    # Preserve original source links before changing any references.
    backup=json.loads(BACKUP.read_text()) if BACKUP.exists() else []
    known={(r['card_key'],r['image_url']) for r in backup}
    backup.extend(r for r in rows if (r['card_key'],r['image_url']) not in known)
    BACKUP.write_text(json.dumps(backup,ensure_ascii=False,indent=2)+'\n')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(preserve,rows))
    pathlib.Path('/tmp/pokemon-preserved-results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results,ensure_ascii=False))
if __name__=='__main__':main()
