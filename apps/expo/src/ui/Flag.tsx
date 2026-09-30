import React, { useState } from 'react';
import { Image, Text as RNText, View } from 'react-native';
import { fonts } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

/**
 * Drapeau d'un pays (image flagcdn, code ISO à 2 lettres). Les émojis drapeaux s'affichent en lettres sous Windows :
 * on passe donc par une image, avec le code du pays en secours si elle ne charge pas.
 */
export function Flag({ code, width = 28 }: { code: string; width?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const height = Math.round(width * 0.75);
  const lower = code.toLowerCase();
  if (failed || !/^[a-z]{2}$/.test(lower)) {
    return <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}><RNText style={{ fontFamily: fonts.sansSemi, fontSize: Math.round(width * 0.4), color: colors.text3 }}>{code.toUpperCase()}</RNText></View>;
  }
  return (
    <Image accessibilityIgnoresInvertColors accessibilityLabel={`Drapeau ${code.toUpperCase()}`} source={{ uri: `https://flagcdn.com/w80/${lower}.png` }}
      onError={() => setFailed(true)} style={{ width, height, borderRadius: 3 }} resizeMode="cover" />
  );
}
