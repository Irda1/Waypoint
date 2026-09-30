import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { regionsHtml } from '../../domain/regionsMap.ts';
import { REGIONS_BASE_NATIVE, REGIONS_COLOR } from './types';
import type { RegionMapProps } from './types';

const WebViewView = WebView as unknown as React.ComponentType<Record<string, unknown>>;

/** Carte des régions sur Android et iOS : la même page MapLibre dans une WebView. */
export function RegionMap({ country, cities, selected, onToggle }: RegionMapProps) {
  const view = useRef<{ injectJavaScript: (script: string) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => regionsHtml(), []);
  const before = useMemo(() => `window.__REGIONS__=${JSON.stringify({ country, color: REGIONS_COLOR, base: REGIONS_BASE_NATIVE })}; true;`, [country]);
  const points = useMemo(() => cities.map((c) => ({ id: c.id, n: c.name, lat: c.lat, lng: c.lng, r: c.rank })), [cities]);
  const citiesKey = useRef<unknown>(null);

  useEffect(() => {
    if (!ready) return;
    const sel = JSON.stringify(selected.map((s) => ({ id: s.id, o: s.order })));
    if (citiesKey.current !== points) { citiesKey.current = points; view.current?.injectJavaScript(`window.__setCities(${JSON.stringify(points)}, ${sel}); true;`); }
    else view.current?.injectJavaScript(`window.__setSelected(${sel}); true;`);
  }, [ready, points, selected]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; id?: number };
      if (m.type === 'ready') setReady(true);
      if (m.type === 'toggle' && typeof m.id === 'number') onToggle(m.id);
    } catch { /* message étranger : ignoré */ }
  }

  return <WebViewView key={country} ref={view} originWhitelist={['*']} source={{ html, baseUrl: 'https://waypoint.local' }} javaScriptEnabled domStorageEnabled
    injectedJavaScriptBeforeContentLoaded={before} onLoadStart={() => setReady(false)} onMessage={onMessage} style={{ flex: 1, backgroundColor: '#000' }} />;
}
