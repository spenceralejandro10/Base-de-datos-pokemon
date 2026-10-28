#!/usr/bin/env python3
"""Read TCGplayer's actual featured seller offers. Never write cards or images."""
import concurrent.futures
import datetime
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'market-prices.js').read_text()
GROUPS = sorted({(int(c), int(g)) for c, g in re.findall(r'"[^"]+":\[(\d+),(\d+)\]', SOURCE)} | {(3, 3068)})
NOW = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()


def get(url, payload=None):
    headers = {'User-Agent': 'BovedaTCG/1.0', 'Accept': 'application/json'}
    if payload is not None:
        headers.update({'Content-Type': 'application/json', 'x-version': '1.0'})
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers=headers)
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.load(response)


def group_data(group):
    cat, gid = group
    cached = pathlib.Path('/tmp/pokemon-market') / f'{cat}-{gid}-products.json'
    if '--cached' in sys.argv and cached.exists():
        products = json.loads(cached.read_text())['results']
    else:
        result = get(f'https://tcgcsv.com/tcgplayer/{cat}/{gid}/products')
        assert result.get('success')
        products = result['results']
        time.sleep(0.15)
    compact = []
    for product in products:
        num = next((e['value'] for e in product.get('extendedData', []) if e['name'] == 'Number'), None)
        if num:
            compact.append({'id': product['productId'], 'name': product['name'], 'number': num})
    return f'{cat}-{gid}', {'updatedAt': NOW(), 'products': compact}


def featured(product):
    pid, language = product['id'], product['language']
    payload = {'filters': {'term': {'language': ['Japanese']}}} if language == 'Japanese' else {}
    # Same public endpoint and payload used by TCGplayer's ProductDetails Spotlight.
    # No Direct filter: TCGplayer chooses its featured seller, including Marketplace sellers.
    try:
        response = get(f'https://data.tcgplayer.com/spotlight/search/{pid}', payload)
        item = response.get('spotlight')
        if not item:
            return f'{pid}|{language}', None, 'no-featured-offer'
        assert item['productId'] == pid and item['language'] == language
        assert isinstance(item['price'], (int, float)) and item['price'] > 0
        fields = ['productId', 'price', 'condition', 'printing', 'language', 'sellerName', 'directSeller', 'shippingPrice', 'listingId']
        offer = {field: item.get(field) for field in fields}
        offer.update({'source': 'tcgplayer-spotlight', 'updatedAt': NOW()})
        return f'{pid}|{language}', offer, 'verified'
    except Exception as error:
        return f'{pid}|{language}', None, str(error)


def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        groups = dict(pool.map(group_data, GROUPS))
    snapshot = {'source': 'spotlight', 'groups': groups, 'offers': {}}
    # Reuse exactly the browser's identity matching logic instead of duplicating it.
    runner = r'''
const fs=require('fs'),vm=require('vm');
const snapshot=JSON.parse(fs.readFileSync(0,'utf8'));
const ctx={window:{MARKET_SNAPSHOT:snapshot},Date,Intl,Map,Set,setTimeout,clearTimeout};
vm.createContext(ctx);
for(const file of ['cards.js','market-prices.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const unique=new Map();
for(const card of ctx.window.CARDS){const product=ctx.window.CardPrices.productFor(card);if(product)unique.set(product.id+'|'+product.language,product)}
process.stdout.write(JSON.stringify([...unique.values()]));
'''
    products = json.loads(subprocess.check_output(['node', '-e', runner], input=json.dumps(snapshot).encode(), cwd=ROOT))
    previous_path = ROOT / 'market-snapshot.js'
    previous = {}
    if previous_path.exists():
        previous = json.loads(previous_path.read_text().split('window.MARKET_SNAPSHOT=', 1)[1].strip().removesuffix(';'))
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for key, offer, status in pool.map(featured, products):
            if offer:
                snapshot['offers'][key] = offer
            else:
                # Keep a previously verified Spotlight offer on a temporary request failure.
                old = previous.get('offers', {}).get(key)
                if status != 'no-featured-offer' and old and old.get('source') == 'tcgplayer-spotlight':
                    snapshot['offers'][key] = old
                failures.append({'key': key, 'status': status})
    fx = get('https://open.er-api.com/v6/latest/USD')
    assert fx['result'] == 'success' and fx['base_code'] == 'USD' and fx['rates']['COP'] > 0
    snapshot['fx'] = {'cop': fx['rates']['COP'], 'updatedAt': datetime.datetime.fromtimestamp(fx['time_last_update_unix'], datetime.timezone.utc).isoformat()}
    # Publish atomically only after the response has been validated.
    if len(snapshot['offers']) < max(1, len(products) * 0.7):
        raise RuntimeError('Too many offer lookups failed; existing snapshot preserved: ' + json.dumps(failures))
    content = '/* Actual TCGplayer featured offers (Spotlight); excludes shipping. */\nwindow.MARKET_SNAPSHOT=' + json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + ';\n'
    temporary = ROOT / 'market-snapshot.js.tmp'
    temporary.write_text(content)
    temporary.replace(previous_path)
    print(json.dumps({'verified_offers': len(snapshot['offers']), 'products': len(products), 'unconfirmed': failures, 'USD_COP': snapshot['fx']['cop']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
