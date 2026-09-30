import React from 'react';

/** Ligne déplaçable par glisser-déposer : seulement sur le web (ailleurs, on monte/descend avec les boutons). */
export function DragRow({ children }: { index: number; onMove: (from: number, to: number) => void; children: React.ReactNode }) {
  return <>{children}</>;
}
