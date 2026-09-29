import type { ImageSourcePropType } from 'react-native';
import type { PhotoKey } from '../lib/photoKey';

// Photos d'ambiance de la maquette (web/index.html), extraites dans assets/photos.
export const photos: Record<PhotoKey, ImageSourcePropType> = {
  horizon: require('../../assets/photos/horizon.jpg'),
  lisbonne: require('../../assets/photos/lisbonne.jpg'),
  porto: require('../../assets/photos/porto.jpg'),
  alfama: require('../../assets/photos/alfama.jpg'),
  marche: require('../../assets/photos/marche.jpg'),
  atelier: require('../../assets/photos/atelier.jpg'),
};
