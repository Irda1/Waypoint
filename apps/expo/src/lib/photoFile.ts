// Photo choisie sur le téléphone → contenu à envoyer. L'appli la choisit déjà compressée (qualité 0,6) ;
// la version web (photoFile.web.ts) la réduit en plus à 1600 px.
export interface PhotoFile { body: ArrayBuffer | Blob; width: number; height: number; contentType: string }

export async function photoFile(uri: string, width: number, height: number): Promise<PhotoFile> {
  const body = await (await fetch(uri)).arrayBuffer();
  return { body, width, height, contentType: 'image/jpeg' };
}
