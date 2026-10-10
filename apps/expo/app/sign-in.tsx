import React, { useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Button, Card, ErrorNote, Field, Text } from '../src/ui';
import { useBreakpoint } from '../src/ui/useBreakpoint';
import { isConfigured } from '../src/lib/env';
import { fonts, space } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';

// Photo d'ambiance de l'accueil : la connexion est la première image de Waypoint, elle doit donner envie de partir.
const horizon = require('../assets/photos/horizon.jpg');
const ON_PHOTO = '#F4EFE6';
const ON_PHOTO_SOFT = 'rgba(245, 245, 242, 0.84)';
const ON_PHOTO_ACCENT = '#FFD08A';

// N'accepte que des chemins internes : évite une redirection vers un site extérieur.
const safeNext = (next: string | string[] | undefined): string => {
  const value = Array.isArray(next) ? next[0] : next;
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
};

export default function SignIn() {
  const { session, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { colors } = useTheme();
  const { breakpoint } = useBreakpoint();
  const wide = breakpoint === 'desktop';
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Redirect href={safeNext(next) as never} />;

  async function submit() {
    setError(null); setInfo(null);
    if (!email.includes('@')) { setError('Adresse email invalide.'); return; }
    if (password.length < 6) { setError('Mot de passe : 6 caractères minimum.'); return; }
    setBusy(true);
    if (mode === 'in') {
      setError(await signIn(email, password));
    } else {
      const res = await signUp(email, password, name || email.split('@')[0]);
      if (res.error) setError(res.error);
      else if (res.needsConfirmation) setInfo('Compte créé. Ouvre le lien reçu par email pour le confirmer, puis connecte-toi.');
    }
    setBusy(false);
  }

  async function forgot() {
    setError(null); setInfo(null);
    if (!email.includes('@')) { setError('Entre ton adresse email ci-dessus, puis touche « Mot de passe oublié ».'); return; }
    setBusy(true);
    const err = await resetPassword(email);
    setBusy(false);
    if (err) setError(err);
    else setInfo('Si un compte existe avec cet email, un lien pour choisir un nouveau mot de passe vient d\'être envoyé.');
  }

  const link = (label: string, onPress: () => void, a11y?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress} disabled={busy} hitSlop={6}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.accent }}>{label}</RNText>
    </Pressable>
  );

  const hero = (
    <ImageBackground source={horizon} resizeMode="cover" style={wide ? styles.heroWide : styles.hero}>
      <View style={styles.veil} pointerEvents="none" />
      <SafeAreaView edges={['top']} style={styles.heroInner}>
        <RNText style={styles.brand} accessibilityRole="header">Waypoint</RNText>
        <View style={{ gap: space.sm }}>
          <RNText style={[styles.eyebrow, { color: ON_PHOTO_ACCENT }]}>Compagnon de voyage</RNText>
          <RNText style={wide ? styles.posterWide : styles.poster}>Le voyage se prépare à plusieurs.</RNText>
          <RNText style={styles.lead}>Programme jour par jour, carte, budget partagé. Même sans connexion.</RNText>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );

  const form = (
    <View style={{ gap: space.lg, width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      {!isConfigured ? (
        <Card>
          <Text variant="heading">Configuration manquante</Text>
          <Text variant="muted">Copie .env.example en .env.local et renseigne EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (voir docs/BACKEND.md), puis relance l'appli.</Text>
        </Card>
      ) : null}

      <View style={{ gap: space.xs }}>
        <Text variant="title" style={{ fontSize: 28, lineHeight: 34 }}>{mode === 'in' ? 'Bon retour' : 'Créer un compte'}</Text>
        <Text variant="muted">{mode === 'in' ? 'Connecte-toi pour retrouver tes voyages.' : 'Gratuit. Tes voyages restent privés, partagés seulement avec qui tu invites.'}</Text>
      </View>

      <View style={{ gap: space.md }}>
        {mode === 'up' ? <Field label="Prénom ou pseudo" value={name} onChangeText={setName} autoCapitalize="words" /> : null}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'in' ? 'current-password' : 'new-password'} onSubmitEditing={submit} />
        {mode === 'in' ? <View style={{ alignSelf: 'flex-end', marginTop: -space.sm }}>{link('Mot de passe oublié ?', forgot)}</View> : null}
      </View>

      <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
        <ErrorNote message={error} />
        {info ? <Text variant="muted">{info}</Text> : null}
      </View>

      <Button label={mode === 'in' ? 'Se connecter' : 'Créer mon compte'} onPress={submit} loading={busy} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text variant="muted" style={{ fontSize: 13 }}>ou</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>
      <Button label="Continuer avec Google" icon="google" variant="ghost" onPress={async () => { setError(await signInWithGoogle()); }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 6 }}>
        <Text variant="muted">{mode === 'in' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}</Text>
        {link(mode === 'in' ? 'Créer un compte' : 'Se connecter', () => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null); })}
      </View>
    </View>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={{ flex: 1.15, overflow: 'hidden' }}>{hero}</View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xxl }} keyboardShouldPersistTaps="handled">{form}</ScrollView>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {hero}
      <View style={[styles.sheet, { backgroundColor: colors.bg }]}>{form}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 340, width: '100%' },
  heroWide: { width: '100%', height: '100%', overflow: 'hidden' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7, 9, 11, 0.38)' },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl + space.lg, gap: space.xxl },
  brand: { fontFamily: fonts.serif, fontSize: 22, color: ON_PHOTO },
  eyebrow: { fontFamily: fonts.sansSemi, fontSize: 11.5, letterSpacing: 1.6, textTransform: 'uppercase' },
  poster: { fontFamily: fonts.serif, fontSize: 38, lineHeight: 42, color: ON_PHOTO, maxWidth: 340 },
  posterWide: { fontFamily: fonts.serif, fontSize: 56, lineHeight: 60, color: ON_PHOTO, maxWidth: 520 },
  lead: { fontFamily: fonts.sans, fontSize: 15.5, lineHeight: 22, color: ON_PHOTO_SOFT, maxWidth: 380 },
  sheet: { flexGrow: 1, marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space.xxl },
});
