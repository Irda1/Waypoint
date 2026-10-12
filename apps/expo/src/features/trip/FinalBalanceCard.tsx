import React, { useState } from 'react';
import { Platform, Pressable, Text as RNText, View } from 'react-native';
import { Button, Card, Text } from '../../ui';
import { Icon } from '../../ui/Icon';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { formatDay, formatMoney } from '../../lib/format';
import { downloadTextFile, shareText } from '../../lib/share';
import { POSTE_NAMES, balanceText, expensesCsv } from '../../domain/finalBalance.ts';
import type { FinalBalance } from '../../domain/finalBalance.ts';
import type { TripData } from '../../data/useTrip';

/** Bilan du voyage (onglet Budget) : ouvert une fois le voyage terminé, replié avant (« Bilan provisoire »). */
export function FinalBalanceCard({ data, balance, ended, onOpenFriends }: { data: TripData; balance: FinalBalance; ended: boolean; onOpenFriends: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(ended);
  const [note, setNote] = useState<string | null>(null);
  const { trip, members } = data;
  const money = (n: number) => formatMoney(n, trip.currency);
  const member = (id: string | null) => members.find((m) => m.user_id === id);
  const name = (id: string | null) => member(id)?.profiles?.display_name ?? 'Ancien voyageur';
  const b = balance;

  const share = async () => {
    const r = await shareText(balanceText(b, { title: trip.title, money, name }));
    setNote(r === 'copied' ? 'Bilan copié : colle-le dans ta messagerie.' : r === 'failed' ? 'Partage impossible ici.' : null);
  };
  const csv = async () => {
    const content = expensesCsv(data.expenses, { currency: trip.currency, name });
    // Sur le web on télécharge le fichier ; sur téléphone, le tableau part en texte dans le menu de partage.
    if (Platform.OS === 'web' && downloadTextFile(`depenses-${trip.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.csv`, `﻿${content}`, 'text/csv')) return;
    await shareText(content);
  };

  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" style={{ color: colors.accent }}>{ended ? `Terminé${trip.ends_on ? ` le ${formatDay(trip.ends_on)}` : ''}` : 'Pendant le voyage'}</Text>
          <Text variant="heading">{ended ? 'Bilan du voyage' : 'Bilan provisoire'}</Text>
        </View>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={18} tone="muted" />
      </Pressable>
      {open ? (
        <View style={{ gap: space.md }}>
          <View style={{ gap: 2 }}>
            <RNText style={{ fontFamily: fonts.serif, fontSize: 34, color: colors.text, fontVariant: ['tabular-nums'] }}>{money(b.total)}</RNText>
            {b.budget ? (
              <Text variant="body" style={{ fontFamily: fonts.sansSemi, color: b.delta >= 0 ? colors.paid : colors.warm }}>
                {b.delta >= 0 ? `${money(b.delta)} sous le budget prévu (${money(b.budget)})` : `${money(-b.delta)} au-dessus du budget prévu (${money(b.budget)})`}
              </Text>
            ) : <Text variant="muted">Aucun budget fixé pour comparer.</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {([[money(b.perDay), 'par jour'], [money(b.perPerson), 'par personne'], [String(b.count), b.count > 1 ? 'dépenses' : 'dépense']] as const).map(([v, l]) => (
              <View key={l} style={{ flex: 1, padding: space.sm, borderRadius: radius.field, backgroundColor: colors.surface2, gap: 2 }}>
                <RNText style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] }}>{v}</RNText>
                <Text variant="muted" style={{ fontSize: 12 }}>{l}</Text>
              </View>
            ))}
          </View>

          {b.postes.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label">Réel{b.postes.some((p) => p.envelope) ? ' et prévu' : ''}, par poste</Text>
              {b.postes.map((p) => {
                const max = Math.max(p.paid, p.envelope) || 1;
                const over = p.envelope > 0 && p.paid > p.envelope;
                return (
                  <View key={p.poste} style={{ gap: 4 }} accessibilityLabel={`${POSTE_NAMES[p.poste]} : ${money(p.paid)}${p.envelope ? ` sur ${money(p.envelope)} prévus` : ''}`}>
                    <View style={{ flexDirection: 'row' }}>
                      <Text variant="body" style={{ flex: 1, fontSize: 14 }}>{POSTE_NAMES[p.poste]}</Text>
                      <Text variant="body" style={{ fontSize: 14, fontVariant: ['tabular-nums'], color: over ? colors.warm : colors.text }}>{money(p.paid)}{p.envelope ? ` / ${money(p.envelope)}` : ''}</Text>
                    </View>
                    <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surface2 }}>
                      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 5, width: `${Math.min(100, (p.paid / max) * 100)}%`, backgroundColor: over ? colors.warm : colors.accent }} />
                      {p.envelope ? <View style={{ position: 'absolute', top: -3, bottom: -3, width: 2, left: `${Math.min(99, (p.envelope / max) * 100)}%`, backgroundColor: colors.text }} /> : null}
                    </View>
                  </View>
                );
              })}
              {b.postes.some((p) => p.envelope) ? <Text variant="muted" style={{ fontSize: 12 }}>Trait foncé : le prévu. Barre orange : poste dépassé.</Text> : null}
            </View>
          ) : <Text variant="muted">Aucune dépense enregistrée pour l'instant.</Text>}

          {b.payers.length ? (
            <View style={{ gap: space.sm }}>
              <Text variant="label">Qui a payé quoi</Text>
              {b.payers.map((p) => (
                <View key={p.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: member(p.userId)?.color ?? colors.text3 }}>
                    <RNText style={{ fontFamily: fonts.sansBold, fontSize: 12, color: '#fff' }}>{name(p.userId).slice(0, 1).toUpperCase()}</RNText>
                  </View>
                  <Text variant="body" style={{ flex: 1 }}>{name(p.userId)}</Text>
                  <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>{money(p.paid)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {members.filter((m) => !m.left_at).length > 1 ? (
            <Pressable accessibilityRole={b.transfersLeft ? 'button' : undefined} disabled={!b.transfersLeft} onPress={onOpenFriends}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
              <Icon name={b.transfersLeft ? 'time' : 'check'} size={18} tone={b.transfersLeft ? 'accent' : 'paid'} />
              <Text variant="body" style={{ flex: 1, fontSize: 14 }}>{b.transfersLeft ? `Encore ${b.transfersLeft} remboursement${b.transfersLeft > 1 ? 's' : ''} pour être quittes` : 'Tout est réglé entre vous.'}</Text>
              {b.transfersLeft ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: 14, color: colors.accent }}>Voir</RNText> : null}
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <View style={{ flexGrow: 1 }}><Button label="Partager le bilan" icon="share" variant="ghost" onPress={() => void share()} /></View>
            {b.count ? <View style={{ flexGrow: 1 }}><Button label="Tableau des dépenses (CSV)" icon="list" variant="ghost" onPress={() => void csv()} /></View> : null}
          </View>
          {note ? <Text variant="muted" accessibilityLiveRegion="polite">{note}</Text> : null}
        </View>
      ) : null}
    </Card>
  );
}
