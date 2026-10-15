// Sur le web, pas de copie hors connexion : le billet s'ouvre toujours en ligne.
export const canKeep = false;
export const isKept = (_id: string, _ext: string): boolean => false;
export async function keep(_id: string, _ext: string, _url: string): Promise<void> {}
export function forget(_id: string, _ext: string): void {}
export async function openKept(_id: string, _ext: string, _mime: string): Promise<void> {}
