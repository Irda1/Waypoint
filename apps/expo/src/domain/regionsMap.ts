// Page de la carte « régions et villes » de l'étape Villes (MapLibre, pays en imagerie satellite réaliste (Sentinel-2 sans nuages, EOX, CC BY-NC 4.0), le reste assombri, régions en contour turquoise).
// Même principe que la carte du voyage et le globe : une page autonome, dans un cadre (web) ou une WebView (mobile).
// Réglages : ?country=PT&base=<racine des fichiers>&color=5FD3BC (web) ou window.__REGIONS__ (mobile).
// Messages reçus : {type:'cities', cities:[{id,n,lat,lng,r}], selected:[{id,o}]} ; envoyés : {type:'ready'}, {type:'toggle', id}.
// Visibilité des villes : les plus importantes (rang r) d'abord ; en choisissant une région, ses villes apparaissent, puis les autres au fil du zoom.

export function regionsHtml(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Régions</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:#000;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}
.city{display:flex;align-items:center;gap:5px;cursor:pointer;transform:translate(0,0);white-space:nowrap}
.dot{width:12px;height:12px;border-radius:50%;background:#fff;border:2px solid #000;box-shadow:0 0 0 1px rgba(255,255,255,.55);flex:none;display:flex;align-items:center;justify-content:center;font:700 11px system-ui,sans-serif;color:#04201a}
.lab{color:#fff;font-size:12.5px;font-weight:600;text-shadow:0 1px 3px #000,0 0 8px #000}
.city.on .dot{width:24px;height:24px;background:var(--c);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.city.on .lab{font-size:13.5px}
.city.hide .lab{display:none}
.rl{color:#fff;opacity:.45;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;white-space:nowrap;text-shadow:0 1px 4px #000}
#back{position:fixed;left:10px;top:10px;padding:7px 12px;border-radius:999px;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:13px;font-weight:600;cursor:pointer;display:none;z-index:5}
#msg{position:fixed;left:0;right:0;bottom:10px;text-align:center;color:#A7ADAB;font-size:12.5px;pointer-events:none;text-shadow:0 1px 4px #000}
.maplibregl-ctrl-group{background:rgba(0,0,0,.55)!important}.maplibregl-ctrl-group button{filter:invert(1)}
</style></head><body><div id="map"></div><div id="back"></div><div id="msg"></div>
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function () {
  "use strict";
  var Q = new URLSearchParams(location.search), G = window.__REGIONS__ || {};
  var CC = String(G.country || Q.get("country") || "").toUpperCase();
  var COLOR = "#" + String(G.color || Q.get("color") || "5FD3BC").replace("#", "");
  var BASE = String(G.base || Q.get("base") || location.origin).replace(/\\/+$/, "");
  var post = function (o) { var s = JSON.stringify(o); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage(s, "*"); };
  var msg = document.getElementById("msg"), back = document.getElementById("back");
  document.documentElement.style.setProperty("--c", COLOR);
  if (!window.maplibregl) { msg.textContent = "Carte indisponible : connexion requise."; post({ type: "ready" }); return; }

  var map = new maplibregl.Map({ container: "map", style: { version: 8, sources: { sat: { type: "raster", tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"], tileSize: 256, maxzoom: 13, attribution: "Sentinel-2 cloudless © EOX" } }, layers: [{ id: "bg", type: "background", paint: { "background-color": "#000" } }, { id: "sat", type: "raster", source: "sat", paint: { "raster-saturation": 0.1, "raster-contrast": 0.08 } }] },
    center: [0, 20], zoom: 1.5, attributionControl: false, dragRotate: false, pitchWithRotate: false, renderWorldCopies: false, maxZoom: 14 });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

  var regions = [], regionMarkers = [], cities = [], selected = {}, selRegion = -1, z0 = 5, zSel = 5, ready = false, hoverId = null;

  function ringIn(lon, lat, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }
  function polysOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []; }
  function inFeature(f, lon, lat) { var ps = polysOf(f.geometry); for (var k = 0; k < ps.length; k++) { var n = 0; for (var r = 0; r < ps[k].length; r++) if (ringIn(lon, lat, ps[k][r])) n++; if (n % 2 === 1) return true; } return false; }
  function bboxOf(f) { var b = [1e9, 1e9, -1e9, -1e9]; polysOf(f.geometry).forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function union(bs) { return bs.reduce(function (a, b) { return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; }); }
  var pad = function () { return { top: 50, bottom: 40, left: 30, right: 30 }; };
  function fit(b, dur) { map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad(), maxZoom: 10, duration: dur }); }
  var countryBox = null;
  // Zone principale du pays : on ignore les îles lointaines (Açores, Canaries, Alaska…) pour cadrer sur l'essentiel.
  function mainBox(list) {
    var parts = []; list.forEach(function (f) { polysOf(f.geometry).forEach(function (p) { var b = [1e9, 1e9, -1e9, -1e9]; p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); parts.push(b); }); });
    if (!parts.length) return null;
    var big = parts.reduce(function (a, b) { return (b[2] - b[0]) * (b[3] - b[1]) > (a[2] - a[0]) * (a[3] - a[1]) ? b : a; });
    var bc = [(big[0] + big[2]) / 2, (big[1] + big[3]) / 2], reach = 1.5 * Math.hypot(big[2] - big[0], big[3] - big[1]) + 3;
    return union(parts.filter(function (b) { return Math.hypot((b[0] + b[2]) / 2 - bc[0], (b[1] + b[3]) / 2 - bc[1]) < reach; }));
  }
  function zoomFor(b) { var c = map.cameraForBounds([[b[0], b[1]], [b[2], b[3]]], { padding: pad(), maxZoom: 10 }); return c ? c.zoom : map.getZoom(); }

  function assign() {
    cities.forEach(function (c) {
      c.reg = -1;
      for (var i = 0; i < regions.length; i++) { var b = regions[i].bb; if (c.lng < b[0] || c.lng > b[2] || c.lat < b[1] || c.lat > b[3]) continue; if (inFeature(regions[i], c.lng, c.lat)) { c.reg = i; break; } }
      if (c.reg < 0 && regions.length) { var best = 1e9; regions.forEach(function (r, i) { var d = Math.hypot((r.bb[0] + r.bb[2]) / 2 - c.lng, (r.bb[1] + r.bb[3]) / 2 - c.lat); if (d < best) { best = d; c.reg = i; } }); }
    });
    var byReg = {};
    cities.slice().sort(function (a, b) { return a.r - b.r; }).forEach(function (c) { byReg[c.reg] = (byReg[c.reg] || 0) + 1; c.rIn = byReg[c.reg] - 1; });
  }

  function build() {
    cities.forEach(function (c) {
      if (c.el) { c.mk.remove(); }
      var el = document.createElement("div"); el.className = "city"; el.innerHTML = '<div class="dot"></div><div class="lab"></div>'; el.lastChild.textContent = c.n;
      el.addEventListener("click", function (e) { e.stopPropagation(); post({ type: "toggle", id: c.id }); });
      c.el = el; c.mk = new maplibregl.Marker({ element: el, anchor: "left", offset: [-6, 0] }).setLngLat([c.lng, c.lat]).addTo(map);
    });
  }

  var raf = 0;
  function render() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; draw(); }); }
  function draw() {
    var z = map.getZoom(), capG = Math.max(3, Math.floor(3 * Math.pow(2, (z - z0) * 1.15))), capS = Math.max(6, Math.floor(6 * Math.pow(2, (z - zSel) * 1.15)));
    var boxes = [], list = cities.slice().sort(function (a, b) { return (selected[b.id] ? 1 : 0) - (selected[a.id] ? 1 : 0) || a.r - b.r; });
    list.forEach(function (c) {
      var on = !!selected[c.id], vis = on || c.r < capG || (selRegion >= 0 && c.reg === selRegion && c.rIn < capS);
      if (selRegion >= 0 && !on && c.reg !== selRegion && c.r >= 3) vis = false;
      if (!vis) { c.el.style.display = "none"; return; }
      c.el.style.display = "flex"; c.el.classList.toggle("on", on);
      c.el.firstChild.textContent = on ? String(selected[c.id]) : "";
      var p = map.project([c.lng, c.lat]), w = c.n.length * 7 + 22, box = [p.x - 6, p.y - 10, p.x - 6 + w, p.y + 10], hit = false;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) { hit = true; break; } }
      c.el.classList.toggle("hide", hit && !on); if (!hit || on) boxes.push(box);
      c.el.style.zIndex = on ? 3 : hit ? 1 : 2;
    });
    var showRl = z < z0 + 2.4;
    regionMarkers.forEach(function (m) {
      if (!showRl) { m.el.style.display = "none"; return; }
      var p = map.project(m.ll), w = m.el.textContent.length * 7, box = [p.x - w / 2, p.y - 7, p.x + w / 2, p.y + 7], hit = false;
      for (var i = 0; i < boxes.length; i++) { var b = boxes[i]; if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) { hit = true; break; } }
      m.el.style.display = hit ? "none" : "block"; if (!hit) boxes.push(box);
    });
  }

  function setState(i, key, val) { if (i != null && i >= 0) map.setFeatureState({ source: "regions", id: i }, (function () { var o = {}; o[key] = val; return o; })()); }
  function selectRegion(i) {
    if (i === selRegion) i = -1;
    setState(selRegion, "sel", false); selRegion = i; setState(i, "sel", true);
    if (i >= 0) { var b = regions[i].bb; zSel = zoomFor(b); fit(b, 650); back.textContent = "‹ Tout le pays · " + regions[i].properties.name; back.style.display = "block"; }
    else { zSel = z0; if (countryBox) fit(countryBox, 650); back.style.display = "none"; }
    render();
  }
  back.addEventListener("click", function () { selectRegion(selRegion); });

  window.__setCities = function (cs, sel) {
    cities.forEach(function (c) { if (c.mk) c.mk.remove(); });
    cities = (cs || []).map(function (c) { return { id: c.id, n: c.n, lat: c.lat, lng: c.lng, r: c.r }; });
    assign(); build(); window.__setSelected(sel || []);
    if (!countryBox && cities.length) { countryBox = union(cities.map(function (c) { return [c.lng, c.lat, c.lng, c.lat]; })); z0 = zoomFor(countryBox); zSel = z0; fit(countryBox, 0); }
    render();
  };
  window.__setSelected = function (sel) { selected = {}; (sel || []).forEach(function (s) { selected[s.id] = s.o; }); render(); };
  function onMsg(e) { try { var m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; if (m && m.type === "cities") window.__setCities(m.cities, m.selected); else if (m && m.type === "selected") window.__setSelected(m.selected); } catch (err) {} }
  window.addEventListener("message", onMsg); document.addEventListener("message", onMsg);
  map.on("move", render); map.on("resize", render);

  function ensureLayers() {
    map.addSource("regions", { type: "geojson", data: { type: "FeatureCollection", features: regions } });
    var sel = ["boolean", ["feature-state", "sel"], false], hov = ["boolean", ["feature-state", "hover"], false];
    // Tout ce qui n'est pas le pays est assombri : le pays seul reste en pleine lumière, avec son relief.
    var holes = []; regions.forEach(function (r) { polysOf(r.geometry).forEach(function (p) { holes.push(p[0].slice().reverse()); }); });
    map.addSource("outside", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]].concat(holes) } } });
    map.addLayer({ id: "outside", type: "fill", source: "outside", paint: { "fill-color": "#000", "fill-opacity": 0.78 } });
    map.addLayer({ id: "r-fill", type: "fill", source: "regions", paint: { "fill-color": ["case", sel, COLOR, hov, COLOR, "#000"], "fill-opacity": ["case", sel, 0.22, hov, 0.14, 0] } });
    map.addLayer({ id: "r-line", type: "line", source: "regions", paint: { "line-color": ["case", sel, "#FFFFFF", "#FFFFFF"], "line-width": ["case", sel, 2.6, 0.9], "line-opacity": ["case", sel, 1, 0.55] }, layout: { "line-join": "round" } });
    map.on("click", "r-fill", function (e) { if (e.features && e.features.length) selectRegion(e.features[0].id); });
    map.on("mousemove", "r-fill", function (e) { var id = e.features && e.features[0] ? e.features[0].id : null; if (id === hoverId) return; setState(hoverId, "hover", false); hoverId = id; setState(id, "hover", true); map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "r-fill", function () { setState(hoverId, "hover", false); hoverId = null; map.getCanvas().style.cursor = ""; });
    regions.forEach(function (r) {
      var big = null, size = -1; polysOf(r.geometry).forEach(function (p) { if (p[0].length > size) { size = p[0].length; big = p[0]; } });
      if (!big) return; var x = 0, y = 0; big.forEach(function (c) { x += c[0]; y += c[1]; });
      var el = document.createElement("div"); el.className = "rl"; el.textContent = r.properties.name;
      var ll = [x / big.length, y / big.length]; regionMarkers.push({ el: el, ll: ll, mk: new maplibregl.Marker({ element: el }).setLngLat(ll).addTo(map) });
    });
  }

  map.on("load", function () {
    map.on("click", function (e) { if (!map.getLayer("r-fill") || !map.queryRenderedFeatures(e.point, { layers: ["r-fill"] }).length) { if (selRegion >= 0) selectRegion(selRegion); } });
    fetch(BASE + "/regions/" + CC + ".json").then(function (r) { if (!r.ok) throw new Error("no"); return r.json(); }).then(function (fc) {
      regions = fc.features; regions.forEach(function (f, i) { f.id = i; f.bb = bboxOf(f); });
      countryBox = mainBox(regions) || union(regions.map(function (f) { return f.bb; })); z0 = zoomFor(countryBox); zSel = z0; fit(countryBox, 0);
      ensureLayers(); assign(); render(); msg.textContent = "Touche une région, puis une ville pour l'ajouter.";
    }).catch(function () { msg.textContent = "Régions indisponibles : les villes restent choisissables ici ou dans la liste."; }).then(function () { ready = true; post({ type: "ready" }); });
  });
})();
</script></body></html>`;
}
