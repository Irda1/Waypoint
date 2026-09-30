import React, { useState } from 'react';

/** Ligne déplaçable par glisser-déposer (HTML5) : on la lâche sur une autre ligne pour prendre sa place. */
export function DragRow({ index, onMove, children }: { index: number; onMove: (from: number, to: number) => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!over) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const from = Number(e.dataTransfer.getData('text/plain'));
        if (Number.isInteger(from)) onMove(from, index);
      }}
      style={{ cursor: 'grab', outline: over ? '2px dashed currentColor' : 'none', outlineOffset: 2, borderRadius: 8 }}
    >
      {children}
    </div>
  );
}
