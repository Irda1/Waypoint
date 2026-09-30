import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { setBudgetLine } from '../../data/trips';
import { fonts, radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { shortDate, todayIso, diffDays } from '../../lib/dates.ts';
import { useLocalMoney } from '../../data/rates';
import { convert, formatApprox } from '../../domain/currency.ts';
import { activityLines, budgetSummary, posteDetail, savingSuggestions, share } from '../../domain/budget.ts';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import type { TripData } from '../../data/useTrip';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

export function BudgetCard({ data, onChanged }: { data: TripData; onChanged?: () => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState<Poste | null>(null);
  const [editing, setEditing] = useState(false);
  const [perPerson, setPerPerson] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { trip, members, expenses, items, places, budgetLines } = data;
  const active = members.filter((m) => !m.left_at);

  const envelopes = Object.fromEntries(budgetLines.map((l) => [l.poste, Number(l.amount)])) as Partial<Record<Poste, number>>;
  const summary = budgetSummary({ expenses, items, places, envelopes, travelers: Math.max(1, active.length) });
  const travelers = Math.max(1, active.length);
  const savings = savingSuggestions({ expenses, items, places, envelopes, travelers });
  const activities = activityLines({ days: data.days, items, places, expenses, travelers });
  const toPay = activities.filter((a) => a.due > 0);
  const donePaid = activities.filter((a) => a.due <= 0);
  const activityTotal = activities.reduce((n, a) => n + a.total, 0);
  const activityDue = toPay.reduce((n, a) => n + a.due, 0);
  const paidAll = POSTES.reduce((n, p) => n + summary[p].paid, 0);
  const forecastAll = POSTES.reduce((n, p) => n + summary[p].forecast, 0);
  const envelopeAll = POSTES.reduce((n, p) => n + summary[p].envelope, 0) || Number(trip.budget_total ?? 0);
  const spentAll = paidAll + forecastAll;
  const rest = envelopeAll - spentAll;
  const lastDay = data.days.at(-1)?.day_date ?? todayIso();
  const daysLeft = Math.max(1, diffDays(todayIso() > (data.days[0]?.day_date ?? todayIso()) ? todayIso() : (data.days[0]?.day_date ?? todayIso()), lastDay) + 1);
  const div = perPerson && travelers > 1 ? travelers : 1;
  const fm = (n: number): string => formatMoney(share(n, div), trip.currency);
  const { rates, local } = useLocalMoney(data.destinations[0]?.country_code ?? null);
  const localTotal = local && local !== trip.currency ? convert(paidAll, trip.currency, local, rates) : null;

  async function saveEnvelope(poste: Poste, value: number) {
    if (!Number.isFinite(value) || value < 0) { setError('Indique un montant positif.'); return; }
    const err = await setBudgetLine(trip.id, poste, Math.round(value * 100) / 100);
    setError(err);
    if (!err) { setEditing(false); onChanged?.(); }
  }

  return (
    <Card>
      <Text variant="heading">Budget</Text>
      {travelers > 1 ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Groupe" selected={!perPerson} onPress={() => setPerPerson(false)} />
          <Chip label="Par personne" selected={perPerson} onPress={() => { setPerPerson(true); setEditing(false); }} />
        </View>
      ) : null}
      <View style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>{fm(spentAll)}</Text>
          {envelopeAll > 0 ? <Text variant="mono" style={{ color: colors.text3 }}>/ {fm(envelopeAll)}</Text> : null}
        </View>
        {envelopeAll > 0 ? (
          <Text variant="body" style={{ color: rest < 0 ? colors.warm : colors.accent, fontFamily: fonts.sansSemi }}>
            {rest < 0 ? `≈ ${fm(-rest)} au-dessus du budget` : `≈ ${fm(rest)} de marge`}
          </Text>
        ) : <Text variant="muted">Aucun budget prévu : ouvre un poste pour en fixer un.</Text>}
        {envelopeAll > 0 ? (
          <View accessible accessibilityRole="progressbar" accessibilityLabel={`${Math.round((spentAll / envelopeAll) * 100)} % du budget`} style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: 'hidden', marginVertical: space.xs }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (spentAll / envelopeAll) * 100)}%`, backgroundColor: rest < 0 ? colors.warm : colors.text3, opacity: 0.45 }} />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (paidAll / envelopeAll) * 100)}%`, backgroundColor: rest < 0 ? colors.warm : colors.accent }} />
          </View>
        ) : null}
        {([['Payé', paidAll, colors.accent], ['Prévu', forecastAll, colors.text3], ['Budget', envelopeAll, colors.lineStrong]] as const).map(([label, value, color]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 12, height: 4, borderRadius: 2, backgroundColor: color }} />
              <Text variant="muted">{label}</Text>
            </View>
            <Text variant="mono">{fm(value)}</Text>
          </View>
        ))}
        {rest >= 0 && envelopeAll > 0 ? <Text variant="muted">Soit environ {fm(rest / daysLeft)} par jour pour les repas et imprévus hors itinéraire. Le prévu est estimé d'après les activités pas encore payées.</Text> : null}
        {localTotal !== null && local && paidAll > 0 ? (
          <Text variant="muted">Payé en monnaie locale : <Text variant="mono">{formatApprox(share(localTotal, div), local)}</Text> (taux BCE du {(rates.date ?? '').split('-').reverse().join('/')})</Text>
        ) : null}
      </View>
      {POSTES.map((p) => {
        const s = summary[p];
        if (!s.paid && !s.forecast && !s.envelope) return null;
        const spent = s.paid + s.forecast;
        const over = !!s.envelope && spent > s.envelope;
        const paidShare = s.envelope ? Math.min(100, (s.paid / s.envelope) * 100) : 0;
        const totalShare = s.envelope ? Math.min(100, (spent / s.envelope) * 100) : 0;
        return (
          <View key={p} style={{ gap: space.xs }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === p }} accessibilityLabel={`Détail du poste ${NOMS[p]}`} onPress={() => { setOpen(open === p ? null : p); setEditing(false); setError(null); }}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text variant="body">{NOMS[p]}</Text>
              <Text variant="mono" style={{ flexShrink: 1, textAlign: 'right' }}>
                {fm(s.paid)}
                {s.forecast ? ` + ≈ ${fm(s.forecast)} prévus` : ''}
                {s.envelope ? ` / ${fm(s.envelope)}` : ''}
              </Text>
            </Pressable>
            {s.envelope ? (
              <View accessible accessibilityRole="progressbar" accessibilityLabel={`${NOMS[p]} : ${Math.round((spent / s.envelope) * 100)} % du budget prévu`}
                style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surface2, overflow: 'hidden' }}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${totalShare}%`, backgroundColor: over ? colors.warm : colors.text3, opacity: 0.45 }} />
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${paidShare}%`, backgroundColor: over ? colors.warm : colors.accent }} />
              </View>
            ) : null}
            {over ? <Text variant="muted" style={{ color: colors.warm }}>Dépasse le budget prévu de {fm(spent - (s.envelope ?? 0))}</Text> : null}
            {open === p ? (
              <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }}>
                {posteDetail(p, { expenses, items, places, travelers }).map((l, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
                    <Text variant="body" style={{ flex: 1 }}>{l.label}{l.kind === 'forecast' ? ' (prévu)' : ''}</Text>
                    <Text variant="mono">{l.kind === 'forecast' ? '≈ ' : ''}{fm(l.amount)}</Text>
                  </View>
                ))}
                {!posteDetail(p, { expenses, items, places, travelers }).length ? <Text variant="muted">Aucune dépense ni étape prévue pour ce poste.</Text> : null}
                {perPerson && div > 1 ? (
                  <Text variant="muted">Passe en « Groupe » pour modifier le budget de ce poste.</Text>
                ) : editing ? (
                  <View style={{ gap: space.sm }}>
                    <Field label={`Budget prévu pour ${NOMS[p].toLowerCase()} (${trip.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex. 400" />
                    <Button label="Enregistrer le budget" onPress={() => saveEnvelope(p, Number(amount.replace(',', '.')))} />
                    <Button label="Annuler" variant="ghost" onPress={() => { setEditing(false); setError(null); }} />
                  </View>
                ) : (
                  <View style={{ gap: space.sm }}>
                    {over ? <Button label={`Augmenter à ${fm(Math.ceil(spent))}`} onPress={() => saveEnvelope(p, Math.ceil(spent))} /> : null}
                    <Button label="Modifier le budget de ce poste" variant="ghost" onPress={() => { setAmount(s.envelope ? String(s.envelope) : ''); setEditing(true); }} />
                  </View>
                )}
                <ErrorNote message={error} />
              </View>
            ) : null}
          </View>
        );
      })}

      {savings.length ? (
        <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2 }} accessibilityLabel="Revenir sous le budget">
          <Text variant="label" style={{ color: colors.warm }}>Revenir sous le budget</Text>
          {savings.map((sv) => (
            <View key={sv.poste} style={{ gap: 2 }}>
              <Text variant="body">{NOMS[sv.poste]} : {fm(sv.over)} de trop.</Text>
              {sv.remove.length ? (
                <Text variant="muted">
                  Retire {sv.remove.map((r) => `${r.name} (${fm(r.cost)})`).join(' + ')}
                  {sv.margin >= 0 ? sv.margin > 0 ? ` : il te resterait ${fm(sv.margin)}.` : ' : tu reviens pile au budget.' : ` : il manquerait encore ${fm(-sv.margin)}.`}
                </Text>
              ) : <Text variant="muted">Aucune étape à retirer : les dépenses déjà saisies dépassent le budget.</Text>}
            </View>
          ))}
          <Text variant="muted">Ou garde le programme : touche le poste ci-dessus pour augmenter son budget.</Text>
        </View>
      ) : null}

      {activities.length > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="label">Activités : coût estimé</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="body">Total des activités</Text><Text variant="mono">{fm(activityTotal)}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text variant="body">Reste à payer / réserver</Text><Text variant="mono" style={{ color: activityDue > 0 ? colors.warm : colors.accent }}>{fm(activityDue)}</Text></View>
          {toPay.length ? <Text variant="label" style={{ marginTop: space.xs }}>À payer / réserver</Text> : null}
          {toPay.map((a) => (
            <View key={a.itemId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text variant="body" style={{ flex: 1 }}>{a.name}<Text variant="muted"> · J{a.day}</Text></Text>
              <Text variant="mono">{a.paid > 0 ? `reste ${fm(a.due)}` : fm(a.due)}</Text>
            </View>
          ))}
          {donePaid.length ? <Text variant="label" style={{ marginTop: space.xs }}>Déjà payées</Text> : null}
          {donePaid.map((a) => (
            <View key={a.itemId} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <Text variant="body" style={{ flex: 1 }}>✓ {a.name}<Text variant="muted"> · J{a.day}</Text></Text>
              <Text variant="mono">{fm(a.total)}</Text>
            </View>
          ))}
          <Text variant="muted">Prix d'entrée estimés pour {div > 1 ? 'une personne' : travelers > 1 ? 'le groupe' : 'toi'}.</Text>
        </View>
      ) : null}

      <View style={{ gap: space.sm, marginTop: space.md }}>
        <Text variant="label">Dernières dépenses</Text>
        {expenses.length === 0 ? <Text variant="muted">Aucune dépense pour l'instant. Ajoute tes réservations au fur et à mesure.</Text> : [...expenses].reverse().slice(0, 8).map((e) => {
          const who = e.paid_by ? (members.find((m) => m.user_id === e.paid_by)?.profiles?.display_name ?? 'membre') : null;
          return (
            <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="body">{e.label}</Text>
                <Text variant="muted">{[NOMS[e.poste], who, e.spent_on ? shortDate(e.spent_on) : null].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text variant="mono">{fm(Number(e.amount))}</Text>
            </View>
          );
        })}
      </View>

    </Card>
  );
}
