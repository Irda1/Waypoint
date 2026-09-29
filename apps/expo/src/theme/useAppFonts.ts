import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

/**
 * Charge les polices de la maquette. Renvoie `true` dès qu'on peut afficher l'appli :
 * polices prêtes, échec de chargement, ou 2,5 s écoulées (réseau lent). L'appli ne reste
 * donc jamais bloquée sur un écran vide ; sans les polices, le système les remplace.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(id);
  }, []);
  return loaded || !!error || timedOut;
}
