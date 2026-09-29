import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { mapHtml, safeJson } from '../../domain/map.ts';
import type { MapCanvasProps } from './types';

/** Carte sur Android et iOS : la même page MapLibre dans une WebView. */
export function MapCanvas({ points, selectedId, dark, start, fitKey, onSelect }: MapCanvasProps) {
  const view = useRef<WebView | null>(null);
  const [ready, setReady] = useState(false);
  const lastFit = useRef<string | null>(null);
  const html = useMemo(() => mapHtml({ dark, start }), [dark]); // eslint-disable-line react-hooks/exhaustive-deps -- le départ ne compte qu'à la création

  useEffect(() => {
    if (!ready) return;
    const fit = lastFit.current !== fitKey;
    lastFit.current = fitKey;
    view.current?.injectJavaScript(`window.__setPoints(${safeJson(points)}, ${fit}, ${safeJson(selectedId)}); true;`);
  }, [ready, points, fitKey, selectedId]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { type: string; id?: string | null };
      if (m.type === 'ready') setReady(true);
      if (m.type === 'select') onSelect(m.id ?? null);
    } catch { /* message étranger : ignoré */ }
  }

  return <WebView ref={view} originWhitelist={['*']} source={{ html, baseUrl: 'https://waypoint.local' }} javaScriptEnabled domStorageEnabled onMessage={onMessage} onLoadStart={() => setReady(false)} style={{ flex: 1 }} />;
}
