import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REGIONS_COLOR } from './types';
import type { RegionMapProps } from './types';

/** Carte des régions sur le web : page publique /regions.html dans un cadre, pilotée par messages. */
export function RegionMap({ country, cities, selected, onToggle }: RegionMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const toggle = useRef(onToggle);
  toggle.current = onToggle;
  const src = useMemo(() => `/regions.html?country=${country}&color=${REGIONS_COLOR}`, [country]);

  useEffect(() => {
    setReady(false);
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const m = JSON.parse(e.data) as { type: string; id?: number };
        if (m.type === 'ready') setReady(true);
        if (m.type === 'toggle' && typeof m.id === 'number') toggle.current(m.id);
      } catch { /* message étranger : ignoré */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [src]);

  const send = useCallback((msg: unknown) => frame.current?.contentWindow?.postMessage(msg, '*'), []);
  const points = useMemo(() => cities.map((c) => ({ id: c.id, n: c.name, lat: c.lat, lng: c.lng, r: c.rank, a: c.airport ? 1 : 0 })), [cities]);
  const sel = useMemo(() => selected.map((s) => ({ id: s.id, o: s.order })), [selected]);
  const citiesKey = useRef<unknown>(null);
  useEffect(() => {
    if (!ready) return;
    if (citiesKey.current !== points) { citiesKey.current = points; send({ type: 'cities', cities: points, selected: sel }); }
    else send({ type: 'selected', selected: sel });
  }, [ready, points, sel, send]);

  return React.createElement('iframe', { ref: frame, src, title: 'Carte des régions', style: { border: 0, width: '100%', height: '100%', background: '#000' } });
}
