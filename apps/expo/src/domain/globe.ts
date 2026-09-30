// Page du globe 3D (Three.js) : planète réaliste (jour à droite et au centre, nuit à gauche, quelques nuages), contours fins des pays, pays survolé ou choisi mis en avant.
// La lumière est fixée à l'écran : l'effet jour/nuit reste le même quand on fait tourner le globe.
// La même page sert sur le web (public/globe.html, dans un cadre) et sur mobile (WebView). Fichier pur : testable avec Node.
// Réglages passés dans l'adresse (?mode=hero|pick&color=5FD3BC&zoom=1) ou dans window.__GLOBE__ (mobile).
//   hero : fond de l'accueil, la terre tourne doucement, rien à toucher.
//   pick : choix d'un pays, avec zoom d'ouverture, survol et toucher.
// Messages vers l'appli : {type:'ready'} puis {type:'pick', code:'PT', name:'Portugal'}.

export function globeHtml(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Globe</title>
<style>
html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
canvas{display:block;width:100%;height:100%}
#nom{position:fixed;left:16px;top:14px;max-width:70%;text-align:left;color:#fff;font-size:clamp(22px,4.5vw,36px);font-weight:700;letter-spacing:-.02em;pointer-events:none;text-shadow:0 2px 18px rgba(0,0,0,.9);opacity:0;transition:opacity .18s}
#nom.on{opacity:1}
#msg{position:fixed;left:0;right:0;bottom:14px;text-align:center;color:#A7ADAB;font-size:13px;pointer-events:none}
</style></head><body>
<canvas id="c"></canvas><div id="nom"></div><div id="msg"></div>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
<script>
(function () {
  "use strict";
  var q = new URLSearchParams(location.search), G = window.__GLOBE__ || {};
  var MODE = G.mode || q.get("mode") || "pick";
  var COLOR = "#" + String(G.color || q.get("color") || "5FD3BC").replace("#", "");
  var post = function (o) {
    var s = JSON.stringify(o);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else if (window.parent !== window) window.parent.postMessage(s, "*");
  };
  var msg = document.getElementById("msg"), nomEl = document.getElementById("nom");
  if (!window.THREE || !window.topojson) { msg.textContent = "Globe indisponible : connexion requise."; post({ type: "ready" }); return; }

  var canvas = document.getElementById("c");
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  var scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  function resize() { var w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();

  // étoiles
  var N = 900, pos = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) { var u = Math.random() * 2 - 1, t = Math.random() * 6.2832, r = Math.sqrt(1 - u * u), d = 60 + Math.random() * 30; pos[i * 3] = d * r * Math.cos(t); pos[i * 3 + 1] = d * u; pos[i * 3 + 2] = d * r * Math.sin(t); }
  var sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.85 })));

  // soleil : halo en fond, en haut à droite
  function halo(size, stops) {
    var c = document.createElement("canvas"); c.width = c.height = 256; var x = c.getContext("2d");
    var g = x.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    var m = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    var s = new THREE.Sprite(m); s.scale.set(size, size, 1); return s;
  }
  var sun = halo(26, [[0, "rgba(255,244,214,1)"], [0.08, "rgba(255,226,160,.9)"], [0.3, "rgba(255,170,90,.28)"], [1, "rgba(255,140,60,0)"]]);
  sun.position.set(20, 11, -30); scene.add(sun);
  var rim = halo(6.4, [[0.62, "rgba(0,0,0,0)"], [0.8, "rgba(120,190,255,.10)"], [1, "rgba(120,190,255,0)"]]);
  scene.add(rim);

  // planète : jour/nuit calculés d'après une lumière fixe (en haut à droite, vers l'avant), nuages légers, halo bleu
  var SUN = new THREE.Vector3(0.8, 0.3, 0.45).normalize();
  var TEX = "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/";
  var loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  var aniso = renderer.capabilities.getMaxAnisotropy();
  function tex(name, srgb) { var t = loader.load(TEX + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; }
  var earthMat = new THREE.ShaderMaterial({
    uniforms: { day: { value: tex("earth_atmos_2048.jpg", true) }, night: { value: tex("earth_lights_2048.png", true) }, sun: { value: SUN } },
    vertexShader: "varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D day; uniform sampler2D night; uniform vec3 sun; varying vec2 vUv; varying vec3 vN;" +
      "void main(){ vec3 n = normalize(vN); float l = dot(n, sun); float k = smoothstep(-0.12, 0.3, l);" +
      "vec3 d = texture2D(day, vUv).rgb; vec3 c = texture2D(night, vUv).rgb;" +
      "vec3 dayC = d * (0.62 + 0.55 * max(l, 0.0)); vec3 nightC = d * 0.045 + c * 1.25;" +
      "vec3 col = mix(nightC, dayC, k);" +
      "float tw = smoothstep(-0.25, 0.0, l) * (1.0 - smoothstep(0.0, 0.3, l)); col += vec3(0.9, 0.5, 0.25) * tw * 0.022;" +
      "float rim = pow(1.0 - max(n.z, 0.0), 3.0); col += vec3(0.25, 0.5, 1.0) * rim * 0.55 * k;" +
      "gl_FragColor = vec4(col, 1.0);\\n#include <colorspace_fragment>\\n}"
  });
  var globe = new THREE.Mesh(new THREE.SphereGeometry(2, 128, 96), earthMat);
  var group = new THREE.Group(); group.add(globe); scene.add(group);
  group.rotation.y = -1.2; group.rotation.x = 0.35;

  var sunLight = new THREE.DirectionalLight(0xffffff, 1.6); sunLight.position.copy(SUN.clone().multiplyScalar(20)); scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x88a8ff, 0.07));
  var clouds = new THREE.Mesh(new THREE.SphereGeometry(2.035, 96, 64), new THREE.MeshLambertMaterial({ map: tex("earth_clouds_1024.png", true), transparent: true, opacity: 0.42, depthWrite: false }));
  group.add(clouds);
  var atmos = new THREE.Mesh(new THREE.SphereGeometry(2.16, 96, 64), new THREE.ShaderMaterial({
    uniforms: { sun: { value: SUN } }, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 sun; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.74 - dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 3.2); float k = mix(0.22, 1.0, smoothstep(-0.35, 0.45, dot(normalize(vN), sun)));" +
      "gl_FragColor = vec4(vec3(0.28, 0.55, 1.0) * i * 2.2 * k, 1.0); }"
  }));
  scene.add(atmos);

  // contours : segments fins posés sur la sphère (nets à tous les zooms), plus discrets côté nuit
  var lineMat = new THREE.ShaderMaterial({
    uniforms: { sun: { value: SUN }, col: { value: new THREE.Color(COLOR).lerp(new THREE.Color(0xffffff), 0.45) } }, transparent: true, depthWrite: false,
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 sun; uniform vec3 col; varying vec3 vN; void main(){ float k = smoothstep(-0.2, 0.3, dot(normalize(vN), sun)); gl_FragColor = vec4(col, mix(0.28, 0.85, k)); }"
  });
  function addBorders(topo) {
    var m = topojson.mesh(topo, topo.objects.countries), pts = [];
    m.coordinates.forEach(function (line) {
      for (var i = 1; i < line.length; i++) {
        var a = line[i - 1], b = line[i]; if (Math.abs(a[0] - b[0]) > 180) continue;
        var va = vec(a[0], a[1], 2.005), vb = vec(b[0], b[1], 2.005); pts.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(g, lineMat));
  }

  // pays survolé et pays choisi : remplissage dessiné sur une couche transparente
  var W = 4096, H = 2048, tex2 = document.createElement("canvas"); tex2.width = W; tex2.height = H;
  var ctx = tex2.getContext("2d"), overlay = new THREE.CanvasTexture(tex2);
  overlay.colorSpace = THREE.SRGBColorSpace; overlay.anisotropy = aniso;
  group.add(new THREE.Mesh(new THREE.SphereGeometry(2.012, 128, 96), new THREE.MeshBasicMaterial({ map: overlay, transparent: true, depthWrite: false })));

  var feats = [], fr = new Intl.DisplayNames(["fr"], { type: "region" }), en = new Intl.DisplayNames(["en"], { type: "region" }), byEn = {}, byFr = {};
  // anciens codes encore connus du navigateur (FX pour la France, UK, SU…) : ils écraseraient le vrai code
  var OLD = { AN: 1, BU: 1, CS: 1, DD: 1, DY: 1, FX: 1, HV: 1, NH: 1, RH: 1, SU: 1, TP: 1, UK: 1, VD: 1, YD: 1, YU: 1, ZR: 1 };
  for (var a = 65; a <= 90; a++) for (var b = 65; b <= 90; b++) {
    var code = String.fromCharCode(a, b), n1, n2; if (OLD[code]) continue; try { n1 = en.of(code); n2 = fr.of(code); } catch (e) { continue; }
    if (n1 && n1 !== code) byEn[n1] = code; if (n2 && n2 !== code) byFr[n2] = code;
  }
  var ALIAS = { "United States of America": "US", "Dem. Rep. Congo": "CD", "Congo": "CG", "Central African Rep.": "CF", "Dominican Rep.": "DO", "Czechia": "CZ", "Bosnia and Herz.": "BA", "Eq. Guinea": "GQ", "Côte d'Ivoire": "CI", "Myanmar": "MM", "eSwatini": "SZ", "S. Sudan": "SS", "Solomon Is.": "SB", "Macedonia": "MK", "N. Cyprus": "CY", "Falkland Is.": "FK", "Fr. S. Antarctic Lands": "TF", "W. Sahara": "EH", "Timor-Leste": "TL", "Palestine": "PS", "Kosovo": "XK", "Turkey": "TR", "Trinidad and Tobago": "TT", "Antigua and Barb.": "AG", "St. Vin. and Gren.": "VC", "Saint Lucia": "LC", "St. Kitts and Nevis": "KN", "São Tomé and Principe": "ST", "Cabo Verde": "CV", "Marshall Is.": "MH", "Micronesia": "FM", "Cook Is.": "CK", "N. Mariana Is.": "MP", "U.S. Virgin Is.": "VI", "British Virgin Is.": "VG", "Cayman Is.": "KY", "Turks and Caicos Is.": "TC", "Faeroe Is.": "FO", "Fr. Polynesia": "PF", "Wallis and Futuna Is.": "WF", "St-Martin": "MF", "St-Barthélemy": "BL", "Sint Maarten": "SX", "Curaçao": "CW", "Åland": "AX", "Heard I. and McDonald Is.": "HM", "S. Geo. and the Is.": "GS", "Br. Indian Ocean Ter.": "IO", "Indian Ocean Ter.": "CC", "Siachen Glacier": "IN", "St. Pierre and Miquelon": "PM", "Saint Helena": "SH", "Vatican": "VA", "Dhekelia": "CY", "Akrotiri": "CY", "Somaliland": "SO", "Bajo Nuevo Bank": null, "Serranilla Bank": null, "Scarborough Reef": null, "Spratly Is.": null, "Coral Sea Is.": null, "Ashmore and Cartier Is.": null, "Clipperton I.": null, "USNB Guantanamo Bay": null, "Bir Tawil": null, "Brazilian I.": null };
  function codeOf(f) { var n = (f.properties && f.properties.name) || ""; return Object.prototype.hasOwnProperty.call(ALIAS, n) ? ALIAS[n] : byEn[n] || null; }
  function frName(f, code) { if (code) { try { var n = fr.of(code); if (n && n !== code) return n; } catch (e) {} } return (f.properties && f.properties.name) || ""; }
  var px = function (lon) { return (lon + 180) / 360 * W; }, py = function (lat) { return (90 - lat) / 180 * H; };
  function path(f) {
    ctx.beginPath();
    var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    polys.forEach(function (poly) { poly.forEach(function (ring) { ring.forEach(function (p, i) { var jump = i && Math.abs(p[0] - ring[i - 1][0]) > 180; i && !jump ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1])); }); }); });
  }
  var hover = -1, sel = -1;
  function paint() {
    ctx.clearRect(0, 0, W, H); ctx.lineJoin = "round";
    if (sel >= 0 && sel !== hover) { var q = feats[sel]; path(q.f); ctx.fillStyle = COLOR; ctx.globalAlpha = 0.34; ctx.fill("evenodd"); ctx.globalAlpha = 1; ctx.strokeStyle = COLOR; ctx.lineWidth = 5; ctx.stroke(); }
    if (hover >= 0) { var h = feats[hover]; path(h.f); ctx.fillStyle = COLOR; ctx.globalAlpha = 0.4; ctx.fill("evenodd"); ctx.globalAlpha = 1; ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4; ctx.stroke(); }
    overlay.needsUpdate = true;
  }

  function inRing(lon, lat, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c; } return c; }
  function inFeature(f, lon, lat) {
    var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (var k = 0; k < polys.length; k++) { var n = 0; for (var r = 0; r < polys[k].length; r++) if (inRing(lon, lat, polys[k][r])) n++; if (n % 2 === 1) return true; }
    return false;
  }
  function centroid(f) {
    var g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [], best = null, size = -1;
    polys.forEach(function (p) { var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; p[0].forEach(function (c) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }); var area = (x1 - x0) * (y1 - y0); if (area > size) { size = area; best = [[x0, y0], [x1, y1]]; } });
    if (!best) return null; return [(best[0][0] + best[1][0]) / 2, (best[0][1] + best[1][1]) / 2];
  }
  function vec(lon, lat, r) { var phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180; return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)); }

  // caméra : distance courante et cible (zoom d'ouverture en mode « pick »)
  var dist = MODE === "pick" ? 16 : 7.4, target = MODE === "pick" ? 5.2 : 7.4, t0 = performance.now();
  var drag = null, vx = 0, moved = 0, autoSpin = MODE === "hero" ? 0.0012 : 0.0004;
  var ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  function pick(clientX, clientY) {
    var r = canvas.getBoundingClientRect(); mouse.set((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); var hit = ray.intersectObject(globe)[0]; if (!hit) return -1;
    var p = globe.worldToLocal(hit.point.clone()).normalize(), lat = Math.asin(p.y) * 180 / Math.PI, th = Math.atan2(p.z, -p.x), lon = th * 180 / Math.PI - 180;
    if (lon < -180) lon += 360;
    for (var i = 0; i < feats.length; i++) if (inFeature(feats[i].f, lon, lat)) return i; return -1;
  }
  function setHover(i) {
    if (i === hover) return; hover = i; paint(); refresh();
  }
  // Nom affiché en haut à gauche : le pays survolé, sinon le pays choisi.
  function shown() { return hover >= 0 ? hover : sel; }
  function refresh() {
    var i = shown();
    if (i >= 0) { nomEl.textContent = feats[i].name; nomEl.classList.add("on"); } else nomEl.classList.remove("on");
  }
  // Fait pivoter le globe vers un pays (code ISO à 2 lettres) et le met en évidence.
  var anim = null;
  function focus(code) {
    if (!feats.length) { pending = code; return; }
    var i = -1; for (var k = 0; k < feats.length; k++) if (feats[k].code === code) { i = k; break; }
    sel = i; paint(); refresh();
    if (i >= 0 && feats[i].c) {
      var v = vec(feats[i].c[0], feats[i].c[1], 1), ry = -Math.atan2(v.x, v.z), rx = Math.max(-1.2, Math.min(1.2, feats[i].c[1] * Math.PI / 180));
      var cur = group.rotation.y; ry = cur + Math.atan2(Math.sin(ry - cur), Math.cos(ry - cur));
      anim = { ry: ry, rx: rx }; target = Math.min(target, 4.6);
    }
  }
  var pending = null;
  window.__focus = focus;
  function onMsg(e) { try { var m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; if (m && m.type === "focus") focus(m.code); } catch (err) {} }
  window.addEventListener("message", onMsg); document.addEventListener("message", onMsg);
  if (MODE === "pick") {
    canvas.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY }; anim = null; moved = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", function (e) {
      if (drag) { var dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag = { x: e.clientX, y: e.clientY }; var k = 0.005 * (dist / 6); group.rotation.y += dx * k; group.rotation.x = Math.max(-1.2, Math.min(1.2, group.rotation.x + dy * k)); vx = dx * k; }
      else if (e.pointerType === "mouse") setHover(pick(e.clientX, e.clientY));
    });
    canvas.addEventListener("pointerup", function (e) {
      var wasTap = moved < 8; drag = null;
      if (wasTap) { var i = pick(e.clientX, e.clientY); setHover(i); if (i >= 0 && feats[i].code) { sel = i; paint(); refresh(); post({ type: "pick", code: feats[i].code, name: feats[i].name }); } }
    });
    canvas.addEventListener("wheel", function (e) { e.preventDefault(); target = Math.max(2.7, Math.min(11, target + e.deltaY * 0.004)); }, { passive: false });
    var pinch = null;
    canvas.addEventListener("touchmove", function (e) { if (e.touches.length === 2) { var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) target = Math.max(2.7, Math.min(11, target * pinch / d)); pinch = d; } }, { passive: true });
    canvas.addEventListener("touchend", function () { pinch = null; });
  }

  function frame(now) {
    var k = Math.min(1, (now - t0) / 2600), ease = 1 - Math.pow(1 - k, 3);
    if (MODE === "pick" && k < 1) dist = 16 + (target - 16) * ease; else dist += (target - dist) * 0.12;
    camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0);
    camera.near = Math.max(0.3, dist - 2.6); camera.updateProjectionMatrix(); clouds.rotation.y += 0.00012;
    if (anim && !drag) {
      group.rotation.y += (anim.ry - group.rotation.y) * 0.08; group.rotation.x += (anim.rx - group.rotation.x) * 0.08;
      if (Math.abs(anim.ry - group.rotation.y) < 0.002 && Math.abs(anim.rx - group.rotation.x) < 0.002) anim = null;
    } else if (!drag && sel < 0) { group.rotation.y += autoSpin + vx; vx *= 0.94; }
    else if (!drag) { group.rotation.y += vx; vx *= 0.94; }
    group.updateMatrixWorld(); renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // contours fins (50 m) pour le choix d'un pays ; 110 m suffisent pour le décor de l'accueil
  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-" + (MODE === "pick" ? "50m" : "110m") + ".json").then(function (r) { return r.json(); }).then(function (topo) {
    var fc = topojson.feature(topo, topo.objects.countries);
    feats = fc.features.map(function (f) { var code = codeOf(f); return { f: f, name: frName(f, code), code: code, c: centroid(f) }; });
    addBorders(topo); paint(); post({ type: "ready" }); if (pending) { var c = pending; pending = null; focus(c); }
    window.__feats = feats;
  }).catch(function () { msg.textContent = "Globe indisponible : connexion requise."; post({ type: "ready" }); });
  if (MODE === "pick") msg.textContent = "Glisse pour tourner, touche un pays pour le choisir";
})();
</script></body></html>`;
}
