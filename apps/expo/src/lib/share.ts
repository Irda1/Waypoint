import { Platform, Share } from 'react-native';

/** Partage un texte : fenêtre de partage du téléphone ; sur le web, partage du navigateur s'il existe, sinon copie dans le presse-papiers. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = (globalThis as { navigator?: { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator;
      if (nav?.share) { await nav.share({ text: message }); return 'shared'; }
      if (nav?.clipboard) { await nav.clipboard.writeText(message); return 'copied'; }
      return 'failed';
    }
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}

/** Copie un texte dans le presse-papiers (web uniquement). */
export async function copyText(text: string): Promise<boolean> {
  const nav = (globalThis as { navigator?: { clipboard?: { writeText: (t: string) => Promise<void> } } }).navigator;
  try { await nav?.clipboard?.writeText(text); return !!nav?.clipboard; } catch { return false; }
}

/** Télécharge un fichier texte (web uniquement ; sur téléphone il faudrait un module de fichiers, pas installé). */
export function downloadTextFile(filename: string, content: string, mime = 'text/plain'): boolean {
  const g = globalThis as { document?: { createElement: (t: string) => { href: string; download: string; click: () => void } }; URL?: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void }; Blob?: new (p: string[], o: { type: string }) => unknown };
  if (Platform.OS !== 'web' || !g.document || !g.URL || !g.Blob) return false;
  const url = g.URL.createObjectURL(new g.Blob([content], { type: `${mime};charset=utf-8` }));
  const a = g.document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => g.URL?.revokeObjectURL(url), 1000);
  return true;
}
