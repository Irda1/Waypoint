import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_APPEARANCE, parseAppearance } from './settings';
import type { Appearance } from './settings';

const KEY = 'waypoint.appearance';
let current: Appearance = DEFAULT_APPEARANCE;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

// Relecture au démarrage : l'appli s'affiche d'abord avec le défaut, puis bascule si un réglage existe.
void AsyncStorage.getItem(KEY).then((raw) => {
  const saved = parseAppearance(raw);
  if (saved.mode !== current.mode || saved.accent !== current.accent || saved.icons !== current.icons) { current = saved; emit(); }
}).catch(() => {});

export function setAppearance(patch: Partial<Appearance>) {
  current = { ...current, ...patch };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => current,
    () => current,
  );
}
