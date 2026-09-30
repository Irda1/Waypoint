import React, { useCallback, useEffect, useRef } from 'react';
import { GLOBE_COLOR } from './types';
import type { GlobeProps } from './types';

/** Globe 3D sur le web : page publique /globe.html dans un cadre, qui répond par messages. */
export function Globe({ mode, color = GLOBE_COLOR, focus = null, onPick }: GlobeProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  const send = useCallback(() => {
    if (focus) frame.current?.contentWindow?.postMessage(JSON.stringify({ type: 'focus', code: focus }), '*');
  }, [focus]);
  useEffect(send, [send]);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      try {
        const m = JSON.parse(e.data) as { type: string; code?: string; name?: string };
        if (m.type === 'pick' && m.code) pick.current?.(m.code, m.name ?? m.code);
      } catch { /* message étranger : ignoré */ }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return React.createElement('iframe', {
    ref: frame, onLoad: send, src: `/globe.html?mode=${mode}&color=${color}`, title: 'Globe terrestre',
    style: { border: 0, width: '100%', height: '100%', background: '#000', pointerEvents: mode === 'hero' ? 'none' : 'auto' },
  });
}
