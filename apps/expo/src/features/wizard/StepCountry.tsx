import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { Field, Text } from '../../ui';
import { Flag } from '../../ui/Flag';
import { Button } from '../../ui';
import { COUNTRIES, POPULAR, COUNTRY_NAME, searchCountries } from '../../domain/countries.ts';
import { autoTitle } from '../../domain/wizard.ts';
import type { WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { Globe } from '../globe/Globe';
import { Choice, StepTitle } from './parts';
import type { StepProps } from './parts';

export function StepCountry({ state, update }: StepProps<WizardState>) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const results = query.trim() ? searchCountries(query) : null;

  function pick(code: string) {
    if (code === state.country) { update({ ...state }); return; }
    // Changer de pays vide les villes choisies : elles n'appartiennent plus au pays.
    const next = { ...state, country: code, cities: [] };
    update({ ...next, title: state.titleEdited ? state.title : autoTitle(next) });
  }

  const row = (code: string, detail?: string) => (
    <Choice key={code} title={COUNTRY_NAME[code] ?? code} detail={detail} selected={state.country === code} onPress={() => pick(code)}
      lead={<Flag code={code} width={32} />} />
  );

  return (
    <View style={{ gap: space.md }}>
      <StepTitle title="Où veux-tu aller ?" hint="Choisis un pays. Tu sélectionneras les villes ensuite." />
      <View style={{ height: 360, borderRadius: radius.card, overflow: 'hidden', backgroundColor: '#000' }}>
        <Globe mode="pick" focus={state.country} onPick={(code) => { if (COUNTRY_NAME[code]) pick(code); }} />
      </View>
      {state.country ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}><Flag code={state.country} width={26} /><Text variant="body">Pays choisi : {COUNTRY_NAME[state.country] ?? state.country}</Text></View> : null}
      <Field label="Rechercher un pays" value={query} onChangeText={setQuery} placeholder="Ex. Japon, Portugal…" autoCorrect={false} />
      {results ? (
        results.length ? results.map((c) => row(c.code)) : <Text variant="muted">Aucun pays ne correspond.</Text>
      ) : showList ? (
        <>
          <Button label="Masquer la liste des pays" variant="ghost" onPress={() => setShowList(false)} />
          <Text variant="label">Destinations populaires</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {POPULAR.map((p) => (
              <Pressable key={p.code} accessibilityRole="button" accessibilityState={{ selected: state.country === p.code }} accessibilityLabel={COUNTRY_NAME[p.code]} onPress={() => pick(p.code)}
                style={{ width: '48%', minHeight: 72, padding: space.md, gap: 6, borderRadius: radius.field, borderWidth: state.country === p.code ? 2 : 1, borderColor: state.country === p.code ? colors.accent : colors.line, backgroundColor: colors.surface }}>
                <Flag code={p.code} width={30} />
                <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 15, color: colors.text }}>{COUNTRY_NAME[p.code]}</RNText>
              </Pressable>
            ))}
          </View>
          <Text variant="label">Tous les pays</Text>
          {COUNTRIES.map((c) => row(c.code))}
        </>
      ) : (
        <Button label="Afficher la liste des pays" variant="ghost" onPress={() => setShowList(true)} />
      )}
    </View>
  );
}
