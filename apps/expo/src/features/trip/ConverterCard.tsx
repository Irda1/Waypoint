import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Field, Text } from '../../ui';
import { useLocalMoney } from '../../data/rates';
import { convert, formatApprox } from '../../domain/currency.ts';
import type { TripData } from '../../data/useTrip';
import { space } from '../../theme/tokens';

/** Convertisseur : un montant en monnaie locale devient des euros (monnaie du voyage), et inversement. Taux BCE du jour. */
export function ConverterCard({ data }: { data: TripData }) {
  const { rates, local } = useLocalMoney(data.destinations[0]?.country_code ?? null);
  const base = data.trip.currency;
  const [amount, setAmount] = useState('');
  const [fromLocal, setFromLocal] = useState(true);
  if (!local || local === base) return null;
  const n = Number(amount.replace(',', '.'));
  const out = Number.isFinite(n) && amount.trim() ? convert(n, fromLocal ? local : base, fromLocal ? base : local, rates) : null;
  const date = (rates.date ?? '').split('-').reverse().join('/');
  return (
    <Card>
      <Text variant="heading">Convertisseur</Text>
      <Field label={`Montant en ${fromLocal ? local : base}`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Ex. 1500" />
      <View style={{ gap: space.sm }}>
        <Text variant="body">{out != null ? `≈ ${formatApprox(out, fromLocal ? base : local)}` : amount.trim() ? 'Taux indisponible pour l\'instant.' : `Entre un montant pour le convertir en ${fromLocal ? base : local}.`}</Text>
        <Button label={`Inverser : ${fromLocal ? `${base} → ${local}` : `${local} → ${base}`}`} variant="ghost" onPress={() => setFromLocal(!fromLocal)} />
        {date ? <Text variant="muted">Taux BCE du {date}.</Text> : null}
      </View>
    </Card>
  );
}
