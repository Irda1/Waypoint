// Billets gardés sur le téléphone (« Garder sur ce téléphone ») : copie dans les documents de l'appli, ouverte même hors connexion.
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const canKeep = true;
const folder = () => new Directory(Paths.document, 'billets');
const fileFor = (id: string, ext: string) => new File(folder(), `${id}.${ext}`);

export function isKept(id: string, ext: string): boolean {
  try { return fileFor(id, ext).exists; } catch { return false; }
}

export async function keep(id: string, ext: string, url: string): Promise<void> {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  await File.downloadFileAsync(url, fileFor(id, ext), { idempotent: true });
}

export function forget(id: string, ext: string): void {
  const f = fileFor(id, ext);
  if (f.exists) f.delete();
}

/** Ouvre la copie gardée : le téléphone propose ses applis (lecteur PDF, galerie, Wallet…). */
export async function openKept(id: string, ext: string, mime: string): Promise<void> {
  await Sharing.shareAsync(fileFor(id, ext).uri, { mimeType: mime, dialogTitle: 'Ouvrir le billet' });
}
