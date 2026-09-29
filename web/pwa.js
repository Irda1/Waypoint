/* Waypoint · couche « appli » commune au web (PWA) et à l'APK (Capacitor).
   - Web : enregistre le service worker (hors ligne + installation sur l'écran d'accueil).
   - APK : pas de service worker (les fichiers sont déjà dans l'appli) ; on règle la couleur
     des icônes de la barre d'état selon le mode Jour / Nuit choisi dans la maquette.
   Tout est protégé : si une API manque, la maquette fonctionne exactement comme avant. */
(function () {
  "use strict";

  var cap = window.Capacitor;
  var natif = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());

  // Couleur du navigateur / de la barre d'état, alignée sur le mode de la maquette.
  function modeJour() { return document.documentElement.dataset.mode === "jour"; }

  function appliquerBarres() {
    var jour = modeJour();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", jour ? "#FFF6E9" : "#07090B");
    if (natif && cap.Plugins && cap.Plugins.SystemBars && cap.Plugins.SystemBars.setStyle) {
      // DARK = icônes claires pour fond sombre ; LIGHT = icônes sombres pour fond clair.
      cap.Plugins.SystemBars.setStyle({ style: jour ? "LIGHT" : "DARK" }).catch(function () {});
    }
  }

  try {
    appliquerBarres();
    new MutationObserver(appliquerBarres).observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
  } catch (e) { /* sans effet sur la maquette */ }

  // Service worker : seulement sur le web servi en HTTPS (ou localhost pour les tests).
  if (!natif && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* hors ligne indisponible, rien d'autre ne change */ });
    });
  }
})();
