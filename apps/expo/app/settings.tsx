import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text as RNText, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useRequireAuth } from '../src/auth/useRequireAuth';
import { Button, ChevronBadge, Chip, ErrorNote, Field, Text } from '../src/ui';
import { useBreakpoint } from '../src/ui/useBreakpoint';
import { Icon } from '../src/ui/Icon';
import { ACCENTS, ICON_STYLES } from '../src/theme/settings';
import type { IconStyle, ModePref } from '../src/theme/settings';
import { setAppearance, useAppearance } from '../src/theme/store';
import { palette } from '../src/theme/tokens';
import type { AccentName } from '../src/theme/tokens';
import { fonts, radius, space } from '../src/theme/tokens';
import type { IconName } from '../src/ui/Icon';
import { useTheme } from '../src/theme/useTheme';
import { loadNotifPrefs, remindersEnabled, remindersSupported, saveNotifPrefs, setRemindersEnabled } from '../src/lib/reminders';
import { BUILD_ID } from '../src/lib/env';
import { DEFAULT_PREFS, MINUTES_CHOICES } from '../src/domain/reminders.ts';
import type { NotifPrefs } from '../src/domain/reminders.ts';

const MODE_LABELS: Record<ModePref, string> = { auto: 'Auto', nuit: 'Nuit', jour: 'Jour' };
const ICON_LABELS: Record<IconStyle, string> = { couleur: 'Émojis', trait: 'Trait', plein: 'Plein' };
const ACCENT_LABELS: Record<AccentName, string> = { soleil: 'Soleil', turquoise: 'Turquoise', corail: 'Corail', lavande: 'Lavande' };
const MODES_ORDER: ModePref[] = ['auto', 'jour', 'nuit'];
const MODE_ICONS: Record<ModePref, IconName> = { auto: 'settings', jour: 'sunny', nuit: 'nocturne' };
const CREDITS = [
  'Lieux et fond de carte : © contributeurs d\'OpenStreetMap (ODbL), via OpenFreeMap et Geoapify.',
  'Villes : GeoNames (CC BY 4.0).',
  'Descriptions et photos des lieux : Wikipédia et Wikimedia Commons (CC BY-SA).',
  'Taux de change : Banque centrale européenne.',
  'Météo : Open-Meteo.',
];

/** Groupe de réglages : petit titre, puis un bloc arrondi. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label" style={{ paddingHorizontal: space.xs, paddingTop: space.sm }}>{title}</Text>
      <View style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** Réglage avec son titre, ses choix et une aide en dessous. */
function Item({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ padding: space.md, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, marginTop: -1 }}>
      <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{title}</RNText>
      {children}
      {hint ? <Text variant="muted" style={{ fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

/** Ligne : titre, aide, et à droite un interrupteur ou une flèche ; toute la ligne se touche si `onPress`. */
function Row({ title, hint, right, onPress, danger }: { title: string; hint?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const body = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: danger ? colors.danger : colors.text }}>{title}</RNText>
        {hint ? <Text variant="muted" style={{ fontSize: 13 }}>{hint}</Text> : null}
      </View>
      {right}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, minHeight: 56, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, marginTop: -1 };
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={style}>{body}</Pressable> : <View style={style}>{body}</View>;
}

/** Choix côte à côte, comme des onglets. */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.label} onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 42, borderRadius: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.surface : 'transparent', borderWidth: on ? 1 : 0, borderColor: colors.line }}>
            {o.icon ? <Icon name={o.icon} size={15} tone={on ? 'text' : 'muted'} /> : null}
            <RNText style={{ fontFamily: on ? fonts.sansBold : fonts.sansSemi, fontSize: 13.5, color: on ? colors.text : colors.text2 }}>{o.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const guard = useRequireAuth();
  const { session, signOut, changePassword, deleteAccount } = useAuth();
  const [newPwd, setNewPwd] = useState('');
  const [pwdNote, setPwdNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [credits, setCredits] = useState(false);
  const { breakpoint } = useBreakpoint();
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

  const inner = { width: '100%' as const, maxWidth: breakpoint === 'phone' ? undefined : 640, alignSelf: 'center' as const, padding: breakpoint === 'phone' ? space.lg : space.xl, gap: space.md };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" stickyHeaderIndices={[1]}>
        <View style={{ gap: space.xs }}>
          <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
            <Icon name="back" size={16} tone="text" /><RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>Retour</RNText>
          </Pressable>
          <Text variant="title" accessibilityRole="header">Paramètres</Text>
        </View>

        {/* Aperçu en direct : reste en haut pendant qu'on choisit ; tout l'écran change aussitôt. */}
        <View style={{ backgroundColor: colors.bg, paddingVertical: space.xs }}>
          <View accessibilityLabel="Aperçu en direct" style={{ borderRadius: radius.card, padding: space.md, gap: space.sm, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}>
            <Text variant="label">Aperçu en direct</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text }}>Japon · 12 jours</RNText>
                <RNText style={{ fontFamily: fonts.sans, fontSize: 12.5, color: colors.text2 }}>11 → 23 oct. · 2 voyageurs</RNText>
              </View>
              <View style={{ paddingHorizontal: space.md, minHeight: 34, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.accent }}>
                <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.onAccent }}>Ouvrir</RNText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Chip label="Jour 2" selected />
              <Chip label="Jour 3" />
              <View style={{ flexDirection: 'row', gap: space.md, marginLeft: 'auto' }}>
                {(['map', 'day', 'budget'] as const).map((g) => <Icon key={g} name={g} size={20} />)}
              </View>
            </View>
          </View>
        </View>

        <Group title="Apparence">
          <Item title="Thème" hint="Auto suit le réglage de ton téléphone.">
            <Segmented value={pref.mode} options={MODES_ORDER.map((m) => ({ value: m, label: MODE_LABELS[m], icon: MODE_ICONS[m] }))} onChange={(m) => setAppearance({ mode: m })} />
          </Item>
          <Item title="Couleur">
            <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }} accessibilityRole="radiogroup">
              {ACCENTS.map((a) => {
                const on = pref.accent === a;
                return (
                  <Pressable key={a} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={ACCENT_LABELS[a]} onPress={() => setAppearance({ accent: a })}
                    style={{ alignItems: 'center', gap: space.xs, minWidth: 64 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette(mode, a).accent, borderWidth: 3, borderColor: on ? colors.text : 'transparent' }}>
                      {on ? <Icon name="check" size={18} color={palette(mode, a).onAccent} /> : null}
                    </View>
                    <RNText style={{ fontFamily: on ? fonts.sansSemi : fonts.sans, fontSize: 13, color: on ? colors.text : colors.text2 }}>{ACCENT_LABELS[a]}</RNText>
                  </Pressable>
                );
              })}
            </View>
          </Item>
          <Item title="Icônes" hint="Émojis : les icônes colorées du téléphone. Trait et Plein : icônes dessinées, à la couleur choisie.">
            <Segmented value={pref.icons} options={ICON_STYLES.map((i) => ({ value: i, label: ICON_LABELS[i] }))} onChange={(i) => setAppearance({ icons: i })} />
            <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'center' }}>
              {(['map', 'day', 'budget', 'friends', 'culture', 'gastronomie'] as const).map((g) => <Icon key={g} name={g} size={24} />)}
            </View>
          </Item>
        </Group>

        {remindersSupported ? (
          <Group title="Rappels">
            <Row title="Notifications" hint="Programmées sur ton téléphone, sans serveur." right={<Switch value={remind} onValueChange={() => { void toggleReminders(); }} trackColor={{ true: colors.accent, false: colors.lineStrong }} accessibilityLabel="Notifications" />} />
            {remind ? (
              <>
                <Row title="La veille du départ" hint="À 18 h" right={<Switch value={prefs.eve} onValueChange={() => changePrefs({ ...prefs, eve: !prefs.eve })} trackColor={{ true: colors.accent, false: colors.lineStrong }} accessibilityLabel="La veille du départ" />} />
                <Row title="Jour J : à réserver ou payer" hint="À 8 h" right={<Switch value={prefs.bookings} onValueChange={() => changePrefs({ ...prefs, bookings: !prefs.bookings })} trackColor={{ true: colors.accent, false: colors.lineStrong }} accessibilityLabel="Jour J : à réserver ou payer" />} />
                <Row title="Prochaine activité" hint="Un rappel avant chaque étape" right={<Switch value={prefs.next} onValueChange={() => changePrefs({ ...prefs, next: !prefs.next })} trackColor={{ true: colors.accent, false: colors.lineStrong }} accessibilityLabel="Prochaine activité" />} />
                {prefs.next ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md }} accessibilityRole="radiogroup">
                    {MINUTES_CHOICES.map((m) => <Chip key={m} label={`${m} min avant`} selected={prefs.minutes === m} onPress={() => changePrefs({ ...prefs, minutes: m })} />)}
                  </View>
                ) : null}
              </>
            ) : null}
            {remindNote ? <Text variant="muted" accessibilityLiveRegion="polite" style={{ paddingHorizontal: space.md, paddingBottom: space.md }}>{remindNote}</Text> : null}
          </Group>
        ) : null}

        <Group title="Compte">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
              <RNText style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.onAccent }}>{(session?.user.email ?? '?').charAt(0).toUpperCase()}</RNText>
            </View>
            <View style={{ flex: 1 }}>
              <RNText numberOfLines={1} style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{session?.user.email ?? ''}</RNText>
              <Text variant="muted" style={{ fontSize: 13 }}>Connecté</Text>
            </View>
          </View>
          <Row title="Changer le mot de passe" onPress={() => setPwdOpen((v) => !v)} right={<ChevronBadge open={pwdOpen} />} />
          {pwdOpen ? (
            <View style={{ gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md }}>
              <Field label="Nouveau mot de passe (6 caractères minimum)" value={newPwd} onChangeText={setNewPwd} secureTextEntry autoComplete="new-password" />
              {pwdNote ? (pwdNote.ok ? <Text variant="muted" accessibilityLiveRegion="polite">{pwdNote.text}</Text> : <ErrorNote message={pwdNote.text} />) : null}
              <Button label="Changer le mot de passe" onPress={savePassword} loading={busy} disabled={!newPwd} />
            </View>
          ) : null}
          <Row title="Se déconnecter" onPress={signOut} right={<Icon name="chevronRight" size={18} tone="muted" />} />
        </Group>

        <Group title="À propos">
          <Row title="Données et crédits" hint="Lieux, cartes, photos, taux de change, météo" onPress={() => setCredits((v) => !v)} right={<ChevronBadge open={credits} />} />
          {credits ? (
            <View style={{ gap: space.xs, paddingHorizontal: space.md, paddingBottom: space.md }}>
              {CREDITS.map((c) => <Text key={c} variant="muted" style={{ fontSize: 13.5 }}>{c}</Text>)}
            </View>
          ) : null}
        </Group>

        <View style={{ borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
          <Row title="Supprimer mon compte…" danger hint="Efface ton compte et les voyages où tu voyages seul·e. Dans un voyage partagé, tes dépenses restent mais sans ton nom. Impossible à annuler."
            onPress={() => { setConfirmDelete((v) => !v); setTyped(''); setDelError(null); }} right={<ChevronBadge open={confirmDelete} />} />
          {confirmDelete ? (
            <View style={{ gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.md }}>
              <Field label="Pour confirmer, écris SUPPRIMER" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
              <ErrorNote message={delError} />
              <Button label="Supprimer définitivement" onPress={removeAccount} loading={busy} disabled={typed.trim().toUpperCase() !== 'SUPPRIMER'} />
              <Button label="Annuler" variant="ghost" onPress={() => { setConfirmDelete(false); setTyped(''); setDelError(null); }} />
            </View>
          ) : null}
        </View>
        <Text variant="muted" style={{ textAlign: 'center', fontSize: 12 }}>Waypoint · version {BUILD_ID}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
