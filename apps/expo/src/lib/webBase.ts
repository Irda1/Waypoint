// Dossier de publication du site web (ex. « /Waypoint » sur GitHub Pages ; vide en local). Défini à l'export par Expo (experiments.baseUrl).
export const WEB_BASE: string = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
