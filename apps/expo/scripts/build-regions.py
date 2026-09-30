#!/usr/bin/env python3
"""Génère public/regions/XX.json : régions (niveau 1) simplifiées de chaque pays, pour la carte de l'étape « Villes ».

Source : geoBoundaries (gbOpen, ADM1, version simplifiée, licence CC BY 4.0 / ODbL selon le pays), téléchargée via
media.githubusercontent.com. Usage : pip install pycountry shapely ; python3 scripts/build-regions.py [PT JP ...]
Sans argument : tous les pays de src/domain/countries.ts.
"""
import json, re, sys, os, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import pycountry
from shapely.geometry import shape, mapping
from shapely.validation import make_valid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'regions')
REV = '9469f09'
URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/%s/releaseData/gbOpen/%s/ADM1/geoBoundaries-%s-ADM1_simplified.geojson'

def codes():
    src = open(os.path.join(ROOT, 'src', 'domain', 'countries.ts'), encoding='utf-8').read()
    return re.findall(r'\["([A-Z]{2})",\s*"', src)

def rnd(x, d):
    return [round(x[0], d), round(x[1], d)]

def round_geom(g, d):
    def ring(r):
        out = []
        for p in r:
            q = rnd(p, d)
            if not out or out[-1] != q:
                out.append(q)
        return out if len(out) >= 4 else None
    if g['type'] == 'Polygon':
        rings = [ring(r) for r in g['coordinates']]
        rings = [r for r in rings if r]
        return {'type': 'Polygon', 'coordinates': rings} if rings else None
    polys = []
    for poly in g['coordinates']:
        rings = [ring(r) for r in poly]
        rings = [r for r in rings if r]
        if rings:
            polys.append(rings)
    return {'type': 'MultiPolygon', 'coordinates': polys} if polys else None

SMALL = {'de', 'do', 'da', 'dos', 'das', 'du', 'des', 'la', 'le', 'les', 'el', 'del', 'di', 'e', 'y', 'of', 'and', 'the', 'von', 'van'}

def clean(name):
    # Certains noms de la source sont mal encodés (UTF-8 relu en Latin-1) ou tout en capitales.
    try:
        name = name.encode('latin-1').decode('utf-8')
    except (UnicodeEncodeError, UnicodeDecodeError):
        pass
    if len(name) > 3 and name.isupper():
        words = name.lower().split(' ')
        name = ' '.join(w if (i and w in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words))
    return name.strip()

def build(code):
    a3 = pycountry.countries.get(alpha_2=code).alpha_3
    data = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(URL % (REV, a3, a3), timeout=90) as r:
                data = json.load(r)
            break
        except Exception as e:
            if attempt == 3:
                print(code, 'échec', e); return
            time.sleep(2 * (attempt + 1))
    geoms = [(clean(f['properties'].get('shapeName') or ''), make_valid(shape(f['geometry']))) for f in data['features']]
    # Précision d'après la taille d'une région typique (les îles lointaines ne comptent pas) : ~0,4 % de sa diagonale.
    diags = sorted(((g.bounds[2] - g.bounds[0]) ** 2 + (g.bounds[3] - g.bounds[1]) ** 2) ** 0.5 for _, g in geoms)
    median = diags[len(diags) // 2]
    tol = min(0.05, max(0.003, median * 0.004))
    dec = 3 if median < 6 else 2
    feats = []
    for name, g in geoms:
        s = g.simplify(tol, preserve_topology=True)
        if s.is_empty:
            continue
        gj = round_geom(mapping(s), dec)
        if gj:
            feats.append({'type': 'Feature', 'properties': {'name': name}, 'geometry': gj})
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, code + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, ensure_ascii=False, separators=(',', ':'))
    print(code, len(feats), 'régions', os.path.getsize(path) // 1024, 'Ko')

if __name__ == '__main__':
    todo = sys.argv[1:] or codes()
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(lambda c: build(c), todo))
