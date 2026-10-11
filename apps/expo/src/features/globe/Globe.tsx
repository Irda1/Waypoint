import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { globeHtml } from '../../domain/globe.ts';
import { ROUTE_BG, routeHtml } from '../../domain/routeGlobe.ts';
import { GLOBE_COLOR } from './types';
import { REGIONS_BASE_NATIVE } from '../regions/types';
import type { GlobeProps } from './types';

const WebViewView = WebView as unknown as React.ComponentType<Record<string, unknown>>;

/** Globe 3D sur Android et iOS : la page Three.js dans une WebView. */
export function Globe({ mode, color = GLOBE_COLOR, focus = null, onPick, theme = 'nuit', route }: GlobeProps) {
  const view = useRef<{ injectJavaScript: (script: string) => void } | null>(null);
  const config = `window.__GLOBE__=${JSON.stringify(route ? { mode, color, theme, route } : { mode, color, theme, base: REGIONS_BASE_NATIVE })};`;
  // Réglages (couleur, thème, trajet) écrits dans la page avant son premier script : pas de couleur par défaut si l'injection arrive trop tard.
  const html = useMemo(() => (mode === 'route' ? routeHtml() : globeHtml()).replace('<script', `<script>${config}</script><script`), [mode, config]);
  const before = `${config} true;`;
  const send = useCallback(() => {
    if (focus && /^[A-Z]{2}$/.test(focus)) view.current?.injectJavaScript(`window.__focus && window.__focus(${JSON.stringify(focus)}); true;`);
  }, [focus]);
  useEffect(send, [send]);
  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; code?: string; name?: string };
      if (m.type === 'pick' && m.code) onPick?.(m.code, m.name ?? m.code);
    } catch { /* message étranger : ignoré */ }
  }
  return (
    <WebViewView key={`${mode}-${theme}-${color}-${route ?? ''}`} ref={view} onLoadEnd={send} originWhitelist={['*']} source={{ html, baseUrl: 'https://waypoint.local' }} javaScriptEnabled domStorageEnabled
      injectedJavaScriptBeforeContentLoaded={before} onMessage={onMessage} scrollEnabled={false} bounces={false}
      pointerEvents={mode === 'pick' ? 'auto' : 'none'} style={{ flex: 1, backgroundColor: mode === 'route' && theme === 'jour' ? ROUTE_BG.jour : '#000' }} />
  );
}
