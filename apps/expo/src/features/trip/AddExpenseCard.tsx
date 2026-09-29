import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, ErrorNote, Field, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { parseAmount } from '../../lib/format';
import { POSTES } from '../../domain/types.ts';
import type { Poste } from '../../domain/types.ts';
import { addExpense } from '../../data/trips';

const NOMS: Record<Poste, string> = { hebergement: 'Hébergement', transports: 'Transports', repas: 'Repas', activites: 'Activités', shopping: 'Shopping' };

export function AddExpenseCard({ tripId, currency, userId, onChanged }: { tripId: string; currency: string; userId: string; onChanged: () => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [poste, setPoste] = useState<Poste>('repas');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseAmount(amount);
    if (!label.trim()) { setError('Décris la dépense (ex. Train Lisbonne → Porto).'); return; }
    if (value == null) { setError('Montant invalide (ex. 12,50).'); return; }
    setBusy(true);
    const err = await addExpense({ tripId, label, poste, amount: value, currency, paidBy: userId });
    setBusy(false);
    setError(err);
    if (!err) { setLabel(''); setAmount(''); onChanged(); }
  }

  return (
    <Card>
      <Text variant="heading">Ajouter une dépense</Text>
      <Text variant="muted">Avancée par toi, partagée à parts égales entre les membres.</Text>
      <Field label="Libellé" value={label} onChangeText={setLabel} placeholder="Train Lisbonne → Porto" />
      <Field label={`Montant (${currency})`} value={amount} onChangeText={setAmount} placeholder="75" keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {POSTES.map((p) => <Chip key={p} label={NOMS[p]} selected={poste === p} onPress={() => setPoste(p)} />)}
      </View>
      <ErrorNote message={error} />
      <Button label="Enregistrer" onPress={submit} loading={busy} />
    </Card>
  );
}
