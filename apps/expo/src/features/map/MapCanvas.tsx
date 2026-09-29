import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { mapHtml, safeJson } from '../../domain/map.ts';
import type { MapCanvasProps } from './types';

// Les types de react-native-webview ne s'accordent pas avec ceux de React 19 : on n'expose que ce qu'on utilise.
const WebViewView = WebView as unknown as React.ComponentType<Record<string, unknown>>;

/** Carte sur Android et iOS : la même page MapLibre dans une WebView. */
export function MapCanvas({ points, selectedId, dark, start, fitKey, onSelect }: MapCanvasProps) {
  const view = useRef<{ injectJavaScript: (script: string) => void } | null>(null);
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

  return <WebViewView ref={view} originWhitelist={['*']} source={{ html, baseUrl: 'https://waypoint.local' }} javaScriptEnabled domStorageEnabled onMessage={onMessage} onLoadStart={() => setReady(false)} style={{ flex: 1 }} />;
}
