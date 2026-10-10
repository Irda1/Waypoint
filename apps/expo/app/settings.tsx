import React, { useEffect, useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, Card, Chip, ErrorNote, Field, Screen, Text } from '../src/ui';
import { Icon } from '../src/ui/Icon';
import { ACCENTS, ICON_STYLES } from '../src/theme/settings';
import type { IconStyle, ModePref } from '../src/theme/settings';
import { setAppearance, useAppearance } from '../src/theme/store';
import { palette } from '../src/theme/tokens';
import type { AccentName } from '../src/theme/tokens';
import { fonts, space } from '../src/theme/tokens';
import { useTheme } from '../src/theme/useTheme';
import { loadNotifPrefs, remindersEnabled, remindersSupported, saveNotifPrefs, setRemindersEnabled } from '../src/lib/reminders';
import { BUILD_ID } from '../src/lib/env';
import { DEFAULT_PREFS, MINUTES_CHOICES } from '../src/domain/reminders.ts';
import type { NotifPrefs } from '../src/domain/reminders.ts';

const MODE_LABELS: Record<ModePref, string> = { auto: 'Auto', nuit: 'Nuit', jour: 'Jour' };
const ICON_LABELS: Record<IconStyle, string> = { couleur: 'Émojis', trait: 'Trait', plein: 'Plein' };
const ACCENT_LABELS: Record<AccentName, string> = { soleil: 'Soleil', turquoise: 'Turquoise', corail: 'Corail', lavande: 'Lavande' };

export default function Settings() {
  const guard = useRequireAuth();
  const { session, signOut, changePassword, deleteAccount } = useAuth();
  const [newPwd, setNewPwd] = useState('');
  const [pwdNote, setPwdNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remind, setRemind] = useState(false);
  const [remindNote, setRemindNote] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  useEffect(() => { void remindersEnabled().then(setRemind); void loadNotifPrefs().then(setPrefs); }, []);
  function changePrefs(next: NotifPrefs) { setPrefs(next); void saveNotifPrefs(next); setRemindNote('Choix enregistrés : les rappels se reprogramment à l\'ouverture de chaque voyage.'); }
  const { colors, mode } = useTheme();
  const pref = useAppearance();
  if (guard) return guard;

  async function toggleReminders() {
    setRemindNote(null);
    const r = await setRemindersEnabled(!remind);
    setRemind(r.enabled);
    if (r.denied) setRemindNote('Les notifications sont refusées : autorise-les dans les réglages du téléphone pour Waypoint.');
    else if (r.enabled) setRemindNote('Rappels activés : ils se programment à l\'ouverture de chaque voyage.');
  }

  async function savePassword() {
    if (newPwd.length < 6) { setPwdNote({ ok: false, text: 'Mot de passe : 6 caractères minimum.' }); return; }
    setBusy(true);
    const err = await changePassword(newPwd);
    setBusy(false);
    setPwdNote(err ? { ok: false, text: err } : { ok: true, text: 'Mot de passe changé.' });
    if (!err) setNewPwd('');
  }
  async function removeAccount() {
    setBusy(true); setDelError(null);
    const err = await deleteAccount();
    setBusy(false);
    if (err) setDelError(err);
  }

  return (
    <Screen>
      <Button label="Retour" icon="back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Text variant="title" accessibilityRole="header">Paramètres</Text>

      <Card>
        <Text variant="label">Apparence</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
          {(Object.keys(MODE_LABELS) as ModePref[]).map((m) => (
            <Chip key={m} label={MODE_LABELS[m]} selected={pref.mode === m} onPress={() => setAppearance({ mode: m })} />
          ))}
        </View>
        <Text variant="muted">Auto suit le réglage de ton téléphone.</Text>
      </Card>

      <Card>
        <Text variant="label">Couleur d'accent</Text>
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }} accessibilityRole="radiogroup">
          {ACCENTS.map((a) => {
            const on = pref.accent === a;
            return (
              <Pressable key={a} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={ACCENT_LABELS[a]} onPress={() => setAppearance({ accent: a })}
                style={{ alignItems: 'center', gap: space.xs, minWidth: 64 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette(mode, a).accent, borderWidth: on ? 3 : 1, borderColor: on ? colors.text : colors.lineStrong }} />
                <RNText style={{ fontFamily: on ? fonts.sansSemi : fonts.sans, fontSize: 13, color: on ? colors.text : colors.text2 }}>{ACCENT_LABELS[a]}</RNText>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text variant="label">Style des icônes</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup">
          {ICON_STYLES.map((i) => (
            <Chip key={i} label={ICON_LABELS[i]} selected={pref.icons === i} onPress={() => setAppearance({ icons: i })} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
          {(['map', 'day', 'budget', 'friends', 'culture', 'gastronomie'] as const).map((g) => <Icon key={g} name={g} size={26} />)}
        </View>
        <Text variant="muted">Émojis : les icônes colorées du téléphone. Trait et Plein : icônes dessinées, à la couleur d'accent, en contour ou pleines.</Text>
      </Card>

      {remindersSupported ? (
        <Card>
          <Text variant="label">Notifications</Text>
          <Text variant="muted">Rappels programmés sur ton téléphone, sans serveur. Choisis ceux que tu veux.</Text>
          <Button label={remind ? 'Notifications activées : désactiver' : 'Activer les notifications'} variant={remind ? 'ghost' : 'primary'} onPress={toggleReminders} />
          {remind ? (
            <View style={{ gap: space.sm }}>
              <Chip label="La veille du départ (18 h)" icon={prefs.eve ? 'check' : undefined} selected={prefs.eve} onPress={() => changePrefs({ ...prefs, eve: !prefs.eve })} />
              <Chip label="Jour J : activités à réserver ou payer (8 h)" icon={prefs.bookings ? 'check' : undefined} selected={prefs.bookings} onPress={() => changePrefs({ ...prefs, bookings: !prefs.bookings })} />
              <Chip label="Prochaine activité dans X minutes" icon={prefs.next ? 'check' : undefined} selected={prefs.next} onPress={() => changePrefs({ ...prefs, next: !prefs.next })} />
              {prefs.next ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
                  <Text variant="label">Prévenir</Text>
                  {MINUTES_CHOICES.map((m) => <Chip key={m} label={`${m} min avant`} selected={prefs.minutes === m} onPress={() => changePrefs({ ...prefs, minutes: m })} />)}
                </View>
              ) : null}
            </View>
          ) : null}
          {remindNote ? <Text variant="muted" accessibilityLiveRegion="polite">{remindNote}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <Text variant="label">Compte</Text>
        <Text variant="body">{session?.user.email ?? ''}</Text>
        <Button label="Se déconnecter" variant="ghost" onPress={signOut} />
        <Text variant="muted">Version : {BUILD_ID}</Text>
      </Card>

      <Card>
        <Text variant="label">Mot de passe</Text>
        <Field label="Nouveau mot de passe" value={newPwd} onChangeText={setNewPwd} secureTextEntry autoComplete="new-password" />
        {pwdNote ? (pwdNote.ok ? <Text variant="muted" accessibilityLiveRegion="polite">{pwdNote.text}</Text> : <ErrorNote message={pwdNote.text} />) : null}
        <Button label="Changer le mot de passe" variant="ghost" onPress={savePassword} loading={busy} disabled={!newPwd} />
      </Card>

      <Card>
        <Text variant="label">Supprimer mon compte</Text>
        <Text variant="muted">Efface ton compte et les voyages où tu voyages seul·e. Dans un voyage partagé, tes dépenses restent mais sans ton nom. Impossible à annuler.</Text>
        {confirmDelete ? (
          <>
            <Field label="Pour confirmer, écris SUPPRIMER" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
            <ErrorNote message={delError} />
            <Button label="Supprimer définitivement" onPress={removeAccount} loading={busy} disabled={typed.trim().toUpperCase() !== 'SUPPRIMER'} />
            <Button label="Annuler" variant="ghost" onPress={() => { setConfirmDelete(false); setTyped(''); setDelError(null); }} />
          </>
        ) : (
          <Button label="Supprimer mon compte…" variant="ghost" onPress={() => setConfirmDelete(true)} />
        )}
      </Card>
    </Screen>
  );
}
