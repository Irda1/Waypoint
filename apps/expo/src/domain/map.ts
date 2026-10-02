// Carte : préparation des points et page HTML de la carte (MapLibre GL JS + fond OpenFreeMap). Logique pure, testée avec Node.
// Fond de carte : OpenFreeMap (usage commercial autorisé, sans clé ni inscription). Données © OpenStreetMap contributors.
// Les tuiles s'affichent seulement avec du réseau : hors ligne, la carte reste vide (les listes restent disponibles).

import { scheduleDay } from './planning.ts';
import type { Place, TripItem } from './types.ts';

export const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';
export const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const MAPLIBRE_VERSION = '4.7.1';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  root: string;
  /** « plan » : étape du programme (numérotée, couleur du jour) ; « disc » : lieu à découvrir (point de sa catégorie). */
  kind: 'plan' | 'disc';
  day: number | null;
  order: number | null;
  color: string;
  placeId: number | null;
}

/** Palette des jours (lisible sur fond clair et sombre) ; le jour n reprend la couleur n - 1 modulo la taille. */
export const DAY_COLORS = ['#E8833A', '#2F8FD8', '#3FA66B', '#B25DD6', '#D6567A', '#1FA7A0', '#C9A227', '#7C6CE0'];
export const dayColor = (dayNumber: number): string => DAY_COLORS[(Math.max(dayNumber, 1) - 1) % DAY_COLORS.length];

/** Étapes du programme placées sur la carte, numérotées dans l'ordre de la journée. */
export function planPoints(args: {
  days: { id: string; day_date: string }[];
  items: TripItem[];
  places: Map<number, Place>;
  rootOf: (category: string) => string;
}): MapPoint[] {
  const out: MapPoint[] = [];
  args.days.forEach((d, index) => {
    const schedule = scheduleDay({ date: d.day_date, items: args.items.filter((i) => i.day_id === d.id), places: args.places });
    let n = 0;
    for (const s of schedule) {
      if (!s.place) continue;
      n++;
      out.push({
        id: `plan:${s.item.id}`, lat: s.place.lat, lng: s.place.lng, label: s.place.name, root: args.rootOf(s.place.category_code),
        kind: 'plan', day: index + 1, order: n, color: dayColor(index + 1), placeId: s.place.id,
      });
    }
  });
  return out;
}

/** Lieux à découvrir, sans ceux déjà au programme. */
export function discoverPoints(args: {
  candidates: { place: Place; root: string }[];
  inTrip: Set<number>;
  colorOf: (root: string) => string;
}): MapPoint[] {
  return args.candidates
    .filter((c) => !args.inTrip.has(c.place.id))
    .map((c) => ({ id: `disc:${c.place.id}`, lat: c.place.lat, lng: c.place.lng, label: c.place.name, root: c.root, kind: 'disc' as const, day: null, order: null, color: args.colorOf(c.root), placeId: c.place.id }));
}

export interface Filters {
  /** null = tous les jours ; sinon numéro du jour dont on montre le programme. */
  day: number | null;
  /** Affiche les lieux à découvrir. */
  discover: boolean;
  /** Catégories affichées pour les lieux à découvrir ; vide = toutes. */
  roots: string[];
}

export function visiblePoints(points: MapPoint[], f: Filters): MapPoint[] {
  return points.filter((p) => {
    if (p.kind === 'plan') return f.day === null || p.day === f.day;
    return f.discover && (f.roots.length === 0 || f.roots.includes(p.root));
  });
}

export interface Bounds { south: number; west: number; north: number; east: number }

/** Cadre contenant tous les points ; un point seul reçoit un cadre d'environ 2 km. Null si aucun point. */
export function boundsOf(points: { lat: number; lng: number }[]): Bounds | null {
  if (!points.length) return null;
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const p of points) { south = Math.min(south, p.lat); north = Math.max(north, p.lat); west = Math.min(west, p.lng); east = Math.max(east, p.lng); }
  const MIN = 0.01;
  if (north - south < MIN) { const c = (north + south) / 2; south = c - MIN / 2; north = c + MIN / 2; }
  if (east - west < MIN) { const c = (east + west) / 2; west = c - MIN / 2; east = c + MIN / 2; }
  return { south, west, north, east };
}

/** JSON sûr à écrire dans une balise <script> : « < » et les séparateurs de ligne Unicode sont échappés. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/**
 * Page de la carte. Elle reçoit les points par message ({type:'points', points, fit}) ou par `window.__setPoints`, et
 * renvoie à l'application {type:'ready'} puis {type:'select', id} quand on touche un repère.
 */
export function mapHtml(opts: { dark: boolean; start: { lat: number; lng: number; zoom: number }; fromUrl?: boolean }): string {
  const bg = opts.dark ? '#0B0D10' : '#EDEAE3';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css">
<style>html,body,#map{margin:0;height:100%;width:100%;background:${bg}}
.pin{width:30px;height:30px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);color:#fff;font:700 13px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer}
.dot{width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);cursor:pointer}
.sel{outline:3px solid #FFB95A;outline-offset:2px}
.maplibregl-ctrl-attrib{font-size:8px!important;line-height:1.2!important;opacity:.6;background:rgba(255,255,255,.35)!important}.maplibregl-ctrl-attrib-button{width:16px!important;height:16px!important}.maplibregl-ctrl-bottom-right .maplibregl-ctrl{margin:0 2px 2px 0!important}
#diag{position:absolute;left:8px;bottom:22px;max-width:70%;padding:4px 8px;border-radius:8px;background:rgba(0,0,0,.65);color:#fff;font:12px system-ui,sans-serif;display:none}
#fail{display:none;position:absolute;inset:0;align-items:center;justify-content:center;padding:24px;text-align:center;font:15px system-ui,sans-serif;color:${opts.dark ? '#ccc' : '#333'}}</style></head>
<body><div id="map"></div><div id="diag"></div><div id="fail">La carte ne peut pas se charger (connexion ?). Les listes restent disponibles.</div>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<script>
(function () {
  function send(m) { var s = JSON.stringify(m); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage(s, '*'); }
  if (!window.maplibregl) { document.getElementById('fail').style.display = 'flex'; send({type:'ready'}); return; }
  // Mode « fromUrl » (web) : la page est un fichier public (/map.html) et lit son réglage dans l'adresse (?dark=1&lat=..&lng=..&zoom=..).
  var Q = new URLSearchParams(location.search);
  var URLMODE = ${opts.fromUrl ? 'true' : 'false'};
  var DARK = URLMODE ? Q.get('dark') === '1' : ${opts.dark ? 'true' : 'false'};
  var STYLE = DARK ? ${safeJson(STYLE_DARK)} : ${safeJson(STYLE_LIGHT)};
  var CENTER = URLMODE ? [parseFloat(Q.get('lng')) || 0, parseFloat(Q.get('lat')) || 20] : [${opts.start.lng}, ${opts.start.lat}];
  var ZOOM = URLMODE ? (parseFloat(Q.get('zoom')) || 2) : ${opts.start.zoom};
  document.body.style.background = DARK ? '#0B0D10' : '#EDEAE3';
  var map = new maplibregl.Map({ container: 'map', style: STYLE, center: CENTER, zoom: ZOOM, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  var markers = [], selected = null, routes = [];
  // Traits reliant les étapes d'un même jour : un calque SVG recalculé à chaque mouvement, indépendant du fond de carte.
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('style', 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible');
  map.getCanvasContainer().appendChild(svg);
  function drawRoutes() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    routes.forEach(function (r) {
      if (r.pts.length < 2) return;
      var xy = r.pts.map(function (p) { var q = map.project([p.lng, p.lat]); return q.x + ',' + q.y; }).join(' ');
      [['#000', 0.35, 7, ''], [r.color, 0.95, 4, '10 7']].forEach(function (st) {
        var l = document.createElementNS(NS, 'polyline');
        l.setAttribute('points', xy); l.setAttribute('fill', 'none'); l.setAttribute('stroke', st[0]); l.setAttribute('stroke-opacity', st[1]);
        l.setAttribute('stroke-width', st[2]); l.setAttribute('stroke-linecap', 'round'); l.setAttribute('stroke-linejoin', 'round');
        if (st[3]) l.setAttribute('stroke-dasharray', st[3]);
        svg.appendChild(l);
      });
    });
  }
  map.on('move', drawRoutes); map.on('resize', drawRoutes);
  function mark(id) { selected = id; markers.forEach(function (m) { m.el.classList.toggle('sel', m.id === id); }); }
  window.__setPoints = function (points, fit, sel, focus) {
    markers.forEach(function (m) { m.marker.remove(); }); markers = [];
    points.forEach(function (p) {
      var el = document.createElement('div');
      el.className = p.kind === 'plan' ? 'pin' : 'dot'; el.style.background = p.color;
      if (p.kind === 'plan') el.textContent = String(p.order);
      el.title = p.label; el.setAttribute('role', 'button'); el.setAttribute('aria-label', p.label);
      el.addEventListener('click', function (e) { e.stopPropagation(); send({type:'select', id: p.id}); });
      markers.push({ id: p.id, el: el, marker: new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map) });
    });
    var byDay = {};
    points.forEach(function (p) { if (p.kind === 'plan') (byDay[p.day] = byDay[p.day] || { color: p.color, pts: [] }).pts.push(p); });
    routes = Object.keys(byDay).map(function (d) { var r = byDay[d]; r.pts.sort(function (a, b) { return a.order - b.order; }); return r; });
    drawRoutes();
    mark(sel || null);
    if (fit && points.length) {
      var b = new maplibregl.LngLatBounds();
      points.forEach(function (p) { b.extend([p.lng, p.lat]); });
      map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 400 });
    }
    // Recherche : on centre la carte sur le lieu choisi.
    var f = focus ? points.filter(function (p) { return p.id === focus; })[0] : null;
    if (f) map.flyTo({ center: [f.lng, f.lat], zoom: Math.max(map.getZoom(), 14), duration: 500 });
  };
  function onMessage(e) {
    try { var m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (m && m.type === 'points') window.__setPoints(m.points, m.fit, m.selected, m.focus);
      if (m && m.type === 'selected') mark(m.id);
    } catch (err) {}
  }
  window.addEventListener('message', onMessage); document.addEventListener('message', onMessage);
  // Les repères sont de simples éléments de page : on n'attend donc pas la fin du chargement des tuiles pour les poser.
  send({type:'ready'});
  var lastError = '', net = '', fell = false, tried = 0;
  function state() {
    var c = map.getCanvas ? map.getCanvas() : null;
    return 'style ' + (map.isStyleLoaded() ? 'ok' : '…') + ', tuiles ' + (map.areTilesLoaded() ? 'ok' : '…') + (c ? ', zone ' + c.width + 'x' + c.height : '');
  }
  function diag() {
    var d = document.getElementById('diag');
    if (map.loaded() && !lastError) { d.style.display = 'none'; return; }
    d.textContent = (lastError ? 'Fond de carte : ' + lastError : 'Chargement du fond de carte…') + ' [' + state() + (net ? ' ; ' + net : '') + ']';
    d.style.display = 'block';
  }
  map.on('error', function (e) { lastError = (e && e.error && e.error.message) ? String(e.error.message).slice(0, 160) : 'erreur de chargement'; diag(); });
  map.on('idle', function () { if (map.loaded()) { lastError = ''; } diag(); });
  function probe(label, url, ms) {
    return fetch(url).then(function (r) { net += (net ? ' ; ' : '') + label + ' HTTP ' + r.status; return r; })
      .catch(function (e) { net += (net ? ' ; ' : '') + label + ' injoignable (' + (e && e.message ? e.message : 'réseau') + ')'; return null; })
      .then(function (r) { diag(); return r; });
  }
  probe('tuiles', 'https://tiles.openfreemap.org/planet');
  // Si le fond n'est pas chargé au bout de 3 s, on télécharge le style nous-mêmes (page) et on le donne à la carte ;
  // au bout de 9 s, si le style sombre échoue, on passe au style clair.
  function forceStyle(url) {
    tried++;
    return fetch(url).then(function (r) { net += ' ; style HTTP ' + r.status; return r.json(); })
      .then(function (json) { map.setStyle(json); })
      .catch(function (e) { net += ' ; style illisible (' + (e && e.message ? e.message : 'erreur') + ')'; })
      .then(diag);
  }
  setTimeout(function () { if (!map.loaded()) forceStyle(STYLE); diag(); }, 3000);
  setTimeout(function () { if (!map.loaded() && !fell && DARK) { fell = true; forceStyle(${safeJson(STYLE_LIGHT)}); } diag(); }, 9000);
  setInterval(diag, 2000);
  map.on('click', function () { send({type:'select', id: null}); });
})();
</script></body></html>`;
}

/** Repli des accents et de la casse pour comparer des noms de lieux. */
export const foldText = (t: string): string => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Recherche d'un lieu par son nom parmi les repères ; les étapes du programme passent avant les lieux à découvrir. */
export function searchPoints(points: MapPoint[], term: string, limit = 6): MapPoint[] {
  const q = foldText(term);
  if (q.length < 2) return [];
  return points
    .filter((p) => foldText(p.label).includes(q))
    .sort((a, b) => Number(a.kind === 'disc') - Number(b.kind === 'disc') || Number(!foldText(a.label).startsWith(q)) - Number(!foldText(b.label).startsWith(q)) || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Légende : une ligne par jour présent sur la carte, avec sa couleur. */
export function legendDays(points: MapPoint[]): { day: number; color: string }[] {
  return [...new Set(points.filter((p) => p.kind === 'plan' && p.day != null).map((p) => p.day as number))].sort((a, b) => a - b).map((day) => ({ day, color: dayColor(day) }));
}
