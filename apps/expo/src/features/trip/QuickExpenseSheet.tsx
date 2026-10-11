import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text as RNText, ScrollView, View } from 'react-native';
import { Button, Chip, ErrorNote, Field, Text } from '../../ui';
import { Icon } from '../../ui/Icon';
import type { IconName } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import { convert, formatApprox } from '../../domain/currency.ts';
import { useLocalMoney } from '../../data/rates';
import { insertExpense } from '../../data/trips';
import { formatMoney } from '../../lib/format';
import type { TripData } from '../../data/useTrip';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };
const ICONES: Record<Poste, IconName> = { hebergement: 'bed', transports: 'train', repas: 'gastronomie', activites: 'ticket', shopping: 'shopping' };
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'];

/** Repas aux heures des repas, Activités le reste du temps. */
function defaultPoste(d = new Date()): Poste {
  const h = d.getHours();
  return (h >= 11 && h < 15) || (h >= 18 && h < 23) ? 'repas' : 'activites';
}

/**
 * Dépense éclair : montant au clavier (monnaie du pays ou du voyage), poste, qui a payé, puis Enregistrer.
 * Libellé et activité liée restent possibles. Partagée à parts égales, enregistrée dans la monnaie du voyage.
 */
export function QuickExpenseSheet({ visible, data, userId, onClose, onSaved }: {
  visible: boolean; data: TripData; userId: string; onClose: () => void;
  /** Dépense enregistrée : son identifiant (pour « Annuler ») et un court résumé. */
  onSaved: (id: string | null, summary: string) => void;
}) {
  const { colors } = useTheme();
  const base = data.trip.currency;
  const { rates, local } = useLocalMoney(data.destinations[0]?.country_code ?? null);
  const members = data.members.filter((m) => !m.left_at);
  const planned = data.items.filter((i) => i.plan === 'A').map((i) => ({ id: i.id, name: (i.place_id != null ? data.places.get(i.place_id)?.name : null) ?? i.title ?? 'Étape' }));
  const [amount, setAmount] = useState('');
  const [useLocal, setUseLocal] = useState(true);
  const [poste, setPoste] = useState<Poste>(defaultPoste());
  const [payer, setPayer] = useState(userId);
  const [more, setMore] = useState(false);
  const [label, setLabel] = useState('');
  const [linked, setLinked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chaque ouverture repart d'une feuille vierge.
  useEffect(() => {
    if (!visible) return;
    setAmount(''); setPoste(defaultPoste()); setPayer(userId); setMore(false); setLabel(''); setLinked(null); setError(null);
  }, [visible, userId]);

  const hasLocal = !!local && local !== base;
  const cur = hasLocal && useLocal ? local! : base;
  const n = Number(amount.replace(',', '.'));
  const inBase = amount && Number.isFinite(n) ? convert(n, cur, base, rates) : null;

  function press(k: string) {
    if (k === '⌫') { setAmount((a) => a.slice(0, -1)); return; }
    if (k === ',') { setAmount((a) => (a.includes(',') ? a : (a || '0') + ',')); return; }
    setAmount((a) => {
      if (a.includes(',') && a.split(',')[1].length >= 2) return a;
      return a.length >= 9 ? a : (a === '0' ? k : a + k);
    });
  }

  async function save() {
    if (!amount || !Number.isFinite(n) || n <= 0) { setError('Tape un montant.'); return; }
    if (inBase == null) { setError(`Taux ${cur} → ${base} indisponible pour l'instant : passe en ${base}.`); return; }
    const value = Math.round(inBase * 100) / 100;
    const time = new Date().toTimeString().slice(0, 5);
    const name = label.trim() || `${NOMS[poste]} · ${time}`;
    setBusy(true);
    const res = await insertExpense({ tripId: data.trip.id, label: name, poste, amount: value, currency: base, paidBy: payer, itemId: linked });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    onSaved(res.id, `${name} · ${formatMoney(value, base)}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fermer" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(3, 5, 6, 0.6)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '94%' }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, alignSelf: 'center' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
              <Text variant="heading" accessibilityRole="header">Nouvelle dépense</Text>
              {hasLocal ? (
                <View style={{ flexDirection: 'row', gap: space.xs }}>
                  <Chip label={local!} selected={useLocal} onPress={() => setUseLocal(true)} />
                  <Chip label={base} selected={!useLocal} onPress={() => setUseLocal(false)} />
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: 'center', gap: 2 }} accessibilityLiveRegion="polite">
              <RNText style={{ fontFamily: fonts.serif, fontSize: 46, lineHeight: 52, color: amount ? colors.text : colors.text3 }}>{amount ? amount.replace(/^\d+/, (d) => d.replace(/\B(?=(\d{3})+$)/g, '\u202f')) : '0'} <RNText style={{ fontSize: 28, color: colors.text3 }}>{cur}</RNText></RNText>
              <Text variant="muted" style={{ fontSize: 13 }}>{cur !== base ? (inBase != null ? `${formatApprox(inBase, base)} · enregistré en ${base}, taux BCE du jour` : 'Taux du jour en cours de chargement…') : 'Partagée à parts égales entre les voyageurs'}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {KEYS.map((k) => (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === '⌫' ? 'Effacer' : k === ',' ? 'Virgule' : k} onPress={() => press(k)}
                  style={({ pressed }) => ({ width: '32%', flexGrow: 1, minHeight: 46, borderRadius: radius.field, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                  <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 21, color: colors.text }}>{k}</RNText>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="radiogroup">
              {POSTES.map((p) => {
                const on = poste === p;
                return (
                  <Pressable key={p} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={NOMS[p]} onPress={() => setPoste(p)}
                    style={{ flex: 1, minHeight: 62, borderRadius: radius.field, borderWidth: 1, borderColor: on ? colors.accent : colors.lineStrong, backgroundColor: on ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 }}>
                    <Icon name={ICONES[p]} size={20} tone={on ? 'onAccent' : 'text'} />
                    <RNText numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.sansSemi, fontSize: 10.5, color: on ? colors.onAccent : colors.text2 }}>{NOMS[p]}</RNText>
                  </Pressable>
                );
              })}
            </View>
            {members.length > 1 ? (
              <View style={{ gap: space.xs }}>
                <Text variant="label">Payé par</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  {members.map((m) => <Chip key={m.user_id} label={m.user_id === userId ? 'Toi' : m.profiles?.display_name ?? 'Membre'} selected={payer === m.user_id} onPress={() => setPayer(m.user_id)} />)}
                </View>
              </View>
            ) : null}
            {more ? (
              <View style={{ gap: space.sm, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm }}>
                <Field label="Libellé (facultatif)" value={label} onChangeText={setLabel} placeholder="Ex. Ramen à Nishiki" />
                {planned.length ? (
                  <>
                    <Text variant="label">Activité liée (facultatif : compte comme paiement de l'activité)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                      <Chip label="Aucune" selected={linked === null} onPress={() => setLinked(null)} />
                      {planned.map((p) => <Chip key={p.id} label={p.name} selected={linked === p.id} onPress={() => setLinked(p.id)} />)}
                    </ScrollView>
                  </>
                ) : null}
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setMore(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <RNText style={{ fontFamily: fonts.sansSemi, color: colors.accent }}>+ Libellé, activité liée</RNText>
              </Pressable>
            )}
            <ErrorNote message={error} />
            <Button label="Enregistrer" icon="check" onPress={save} loading={busy} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
