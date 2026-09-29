import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip, ErrorNote, Field, Text } from '../../ui';
import { space } from '../../theme/tokens';
import { listCities } from '../../data/places';
import type { CityOption } from '../../data/places';

interface Props {
  selected: CityOption[];
  onAdd: (city: CityOption) => void;
  onRemove: (cityId: number) => void;
  label?: string;
}

/**
 * Choix des destinations : les villes retenues (touche pour retirer), et une recherche sur toute la base
 * (à partir de 2 lettres) dont les résultats s'ajoutent d'une touche.
 */
export function CityPicker({ selected, onAdd, onRemove, label = 'Destination' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityOption[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setSearched(false); return; }
    let alive = true;
    const id = setTimeout(() => {
      void listCities({ query: term }).then((res) => {
        if (!alive) return;
        setResults(res.cities);
        setSearched(true);
        setError(res.error);
      });
    }, 250);
    return () => { alive = false; clearTimeout(id); };
  }, [query]);

  const chosen = new Set(selected.map((c) => c.id));
  const proposals = results.filter((c) => !chosen.has(c.id));

  return (
    <View style={{ gap: space.sm }}>
      {selected.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {selected.map((c) => (
            <Chip key={c.id} label={`${c.name} · ${c.country_code}  ✕`} selected onPress={() => onRemove(c.id)} />
          ))}
        </View>
      ) : null}
      <Field label={label} value={query} onChangeText={setQuery} placeholder="Ex. Lisbonne, Porto, Kyoto…" autoCorrect={false} />
      {proposals.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {proposals.map((c) => (
            <Chip key={c.id} label={`${c.name} · ${c.country_code}`} onPress={() => { onAdd(c); setQuery(''); }} />
          ))}
        </View>
      ) : searched && !error ? (
        <Text variant="muted">Aucune ville ne correspond. Essaie l'orthographe anglaise ou locale (Lisbon, Wien…).</Text>
      ) : null}
      <ErrorNote message={error} />
    </View>
  );
}
