import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { setBudgetLine } from '../../data/trips';
import { radius, space } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { formatMoney } from '../../lib/format';
import { useLocalMoney } from '../../data/rates';
import { convert, formatApprox } from '../../domain/currency.ts';
import { budgetSummary, costByDay, posteDetail, savingSuggestions, share } from '../../domain/budget.ts';
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
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const travelers = Math.max(1, active.length);
  const savings = savingSuggestions({ expenses, items, places, envelopes, travelers });
  const dayCosts = costByDay(data.days, items, places, travelers);
  const maxDay = Math.max(0, ...dayCosts);
  const div = perPerson && travelers > 1 ? travelers : 1;
  const fm = (n: number): string => formatMoney(share(n, div), trip.currency);
  const { rates, local } = useLocalMoney(data.destinations[0]?.country_code ?? null);
  const localTotal = local && local !== trip.currency ? convert(total, trip.currency, local, rates) : null;

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
      <Text variant="muted">Dépensé : <Text variant="mono">{fm(total)}</Text></Text>
      {localTotal !== null && local && total > 0 ? (
        <Text variant="muted">En monnaie locale : <Text variant="mono">{formatApprox(share(localTotal, div), local)}</Text> (taux BCE du {(rates.date ?? '').split('-').reverse().join('/')})</Text>
      ) : null}
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

      {maxDay > 0 ? (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="label">Coût des activités, par jour</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, height: 110 }}>
            {dayCosts.map((c, i) => (
              <View key={data.days[i].id} accessible accessibilityLabel={`Jour ${i + 1} : ${fm(c)}`} style={{ flex: 1, maxWidth: 40, alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }}>
                <Text variant="muted" style={{ fontSize: 11 }}>{c > 0 ? fm(c) : ''}</Text>
                <View style={{ width: '100%', height: `${Math.max(3, (c / maxDay) * 62)}%`, borderRadius: 4, backgroundColor: c === maxDay ? colors.accent : colors.lineStrong }} />
                <Text variant="muted" style={{ fontSize: 12 }}>{i + 1}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

    </Card>
  );
}
