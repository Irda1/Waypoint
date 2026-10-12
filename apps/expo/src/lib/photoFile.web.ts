// Version web : la photo est redessinée à 1600 px au plus (JPEG ≈ 300 Ko) avant l'envoi.
import type { PhotoFile } from './photoFile';

const MAX = 1600;

export async function photoFile(uri: string): Promise<PhotoFile> {
  const img = new Image();
  img.src = uri;
  await img.decode();
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
  const body = await new Promise<Blob>((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error('Photo illisible'))), 'image/jpeg', 0.8));
  return { body, width, height, contentType: 'image/jpeg' };
}
