import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { parseAmount } from '../../lib/format';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import { addExpense } from '../../data/trips';
import type { TripData } from '../../data/useTrip';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

export function AddExpenseCard({ data, userId, onChanged }: { data: TripData; userId: string; onChanged: () => void }) {
  const tripId = data.trip.id;
  const currency = data.trip.currency;
  const members = data.members.filter((m) => !m.left_at);
  const [payer, setPayer] = useState(userId);
  const [linked, setLinked] = useState<string | null>(null);
  const travelers = Math.max(1, members.length);
  const planned = data.items.filter((i) => i.plan === 'A').map((i) => ({ id: i.id, price: i.place_id != null ? data.places.get(i.place_id)?.price_amount ?? null : null, name: (i.place_id != null ? data.places.get(i.place_id)?.name : null) ?? i.title ?? 'Étape' }));
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [poste, setPoste] = useState<Poste>('repas');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Choisir une activité préremplit le libellé et le montant estimé (prix par personne × voyageurs) ; tout reste modifiable.
  function link(p: { id: string; name: string; price: number | null } | null) {
    setLinked(p?.id ?? null);
    if (!p) return;
    setLabel(p.name);
    setPoste('activites');
    if (p.price != null && p.price > 0) setAmount(String(Math.round(p.price * travelers * 100) / 100).replace('.', ','));
  }

  async function submit() {
    const value = parseAmount(amount);
    if (!label.trim()) { setError('Décris la dépense (ex. Train Lisbonne → Porto).'); return; }
    if (value == null) { setError('Montant invalide (ex. 12,50).'); return; }
    setBusy(true);
    const err = await addExpense({ tripId, label, poste, amount: value, currency, paidBy: payer, itemId: linked });
    setBusy(false);
    setError(err);
    if (!err) { setLabel(''); setAmount(''); setLinked(null); onChanged(); }
  }

  return (
    <Card>
      <Text variant="heading">Ajouter une dépense</Text>
      <Text variant="muted">Partagée à parts égales entre les membres.</Text>
      <Field label="Libellé" value={label} onChangeText={setLabel} placeholder="Train Lisbonne → Porto" />
      <Field label={`Montant (${currency})`} value={amount} onChangeText={setAmount} placeholder="75" keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {POSTES.map((p) => <Chip key={p} label={NOMS[p]} selected={poste === p} onPress={() => setPoste(p)} />)}
      </View>
      {members.length > 1 ? (
        <>
          <Text variant="label">Payé par</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {members.map((m) => <Chip key={m.user_id} label={m.user_id === userId ? 'Toi' : m.profiles?.display_name ?? 'Membre'} selected={payer === m.user_id} onPress={() => setPayer(m.user_id)} />)}
          </View>
        </>
      ) : null}
      {planned.length ? (
        <>
          <Text variant="label">Activité liée (facultatif : compte comme paiement de l'activité)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="Aucune" selected={linked === null} onPress={() => link(null)} />
            {planned.map((p) => <Chip key={p.id} label={p.name} selected={linked === p.id} onPress={() => link(p)} />)}
          </ScrollView>
        </>
      ) : null}
      <ErrorNote message={error} />
      <Button label="Enregistrer" onPress={submit} loading={busy} />
    </Card>
  );
}
