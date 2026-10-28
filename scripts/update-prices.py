#!/usr/bin/env python3
"""Update only the public market-price snapshot; never write inventory or images."""
import concurrent.futures
import datetime
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = (ROOT / 'market-prices.js').read_text()
GROUPS = sorted({(int(c), int(g)) for c, g in re.findall(r'"[^"]+":\[(\d+),(\d+)\]', SOURCE)} | {(3, 3068)})
NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()

def get(path):
    request = urllib.request.Request('https://tcgcsv.com/tcgplayer/' + path,
                                    headers={'User-Agent': 'BovedaTCG/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)
    if not data.get('success') or not isinstance(data.get('results'), list):
        raise ValueError('Invalid market response: ' + path)
    return data['results']

def group_data(group):
    cat, gid = group
    prefix = f'{cat}/{gid}/'
    # Optional local source cache is only for reproducible verification.
    def read(kind):
        cached = pathlib.Path('/tmp/pokemon-market') / f'{cat}-{gid}-{kind}.json'
        return json.loads(cached.read_text())['results'] if '--cached' in sys.argv and cached.exists() else get(prefix + kind)
    products, prices = read('products'), read('prices')
    by_id = {}
    for p in prices:
        value = p.get('directLowPrice')
        if isinstance(value, (int, float)) and value > 0:
            by_id.setdefault(p['productId'], []).append({'usd': value, 'finish': p['subTypeName']})
    compact = []
    for p in products:
        num = next((e['value'] for e in p.get('extendedData', []) if e['name'] == 'Number'), None)
        if num:
            compact.append({'id': p['productId'], 'name': p['name'], 'number': num,
                            'prices': by_id.get(p['productId'], [])})
    return f'{cat}-{gid}', {'updatedAt': NOW, 'products': compact}

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        groups = dict(pool.map(group_data, GROUPS))
    request = urllib.request.Request('https://open.er-api.com/v6/latest/USD', headers={'User-Agent': 'BovedaTCG/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        fx = json.load(response)
    assert fx['result'] == 'success' and fx['base_code'] == 'USD' and fx['rates']['COP'] > 0
    snapshot = {'source': 'directLowPrice', 'groups': groups, 'fx': {'cop': fx['rates']['COP'], 'updatedAt':
        datetime.datetime.fromtimestamp(fx['time_last_update_unix'], datetime.timezone.utc).isoformat()}}
    (ROOT / 'market-snapshot.js').write_text('/* TCGplayer Direct Low via TCGCSV; never Market Price. */\nwindow.MARKET_SNAPSHOT=' + json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(f'{len(groups)} collections; USD/COP {snapshot["fx"]["cop"]}; inventory untouched.')

if __name__ == '__main__':
    main()
