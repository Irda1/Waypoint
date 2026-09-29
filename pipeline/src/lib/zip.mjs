// Lecture minimale d'une archive .zip (première entrée), sans dépendance.
// Suffisant pour les fichiers GeoNames (une entrée, méthode « deflate », < 4 Go).
import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export function readFirstZipEntry(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Archive zip invalide (fin de répertoire introuvable)');

  const entries = buf.readUInt16LE(eocd + 10);
  if (entries < 1) throw new Error('Archive zip vide');
  const cd = buf.readUInt32LE(eocd + 16);
  if (buf.readUInt32LE(cd) !== CENTRAL_SIG) throw new Error('Archive zip invalide (répertoire central)');

  const method = buf.readUInt16LE(cd + 10);
  const compSize = buf.readUInt32LE(cd + 20);
  const size = buf.readUInt32LE(cd + 24);
  const nameLen = buf.readUInt16LE(cd + 28);
  const localOffset = buf.readUInt32LE(cd + 42);
  if (compSize === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) {
    throw new Error('Archives zip64 non prises en charge');
  }
  const name = buf.toString('utf8', cd + 46, cd + 46 + nameLen);

  if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw new Error('Archive zip invalide (en-tête local)');
  const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
  const raw = buf.subarray(start, start + compSize);

  let data;
  if (method === 0) data = Buffer.from(raw);
  else if (method === 8) data = inflateRawSync(raw);
  else throw new Error(`Méthode de compression zip ${method} non prise en charge`);
  if (data.length !== size) throw new Error('Archive zip corrompue (taille inattendue)');
  return { name, data };
}
