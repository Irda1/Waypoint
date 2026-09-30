import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MapCanvasProps } from './types';

/** Carte sur le web : page MapLibre dans un cadre (iframe), pilotée par messages. */
export function MapCanvas({ points, selectedId, dark, start, fitKey, focusId, onSelect }: MapCanvasProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const lastFit = useRef<string | null>(null);
  // Page publique /map.html (dossier public/) : une vraie adresse, comme une page web ordinaire, plutôt qu'un contenu « srcdoc ».
  const src = useMemo(() => `/map.html?dark=${dark ? 1 : 0}&lat=${start.lat}&lng=${start.lng}&zoom=${start.zoom}`, [dark]); // eslint-disable-line react-hooks/exhaustive-deps -- le départ ne compte qu'à la création
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    setReady(false);
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const m = JSON.parse(e.data) as { type: string; id?: string | null };
        if (m.type === 'ready') setReady(true);
        if (m.type === 'select') select.current(m.id ?? null);
      } catch { /* message étranger : ignoré */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [src]);

  useEffect(() => {
    if (!ready) return;
    const fit = lastFit.current !== fitKey;
    lastFit.current = fitKey;
    frame.current?.contentWindow?.postMessage({ type: 'points', points, fit, selected: selectedId, focus: focusId ?? null }, '*');
  }, [ready, points, fitKey, selectedId, focusId]);

  return React.createElement('iframe', { ref: frame, src, title: 'Carte du voyage', style: { border: 0, width: '100%', height: '100%' } });
}
