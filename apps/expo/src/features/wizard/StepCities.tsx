import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text as RNText, View, useWindowDimensions } from 'react-native';
import { Button, ChevronBadge, Chip, ErrorNote, Field, Text } from '../../ui';
import { RegionMap } from '../regions/RegionMap';
import { listCountryCities, listCountryCityPoints, listQuartiers } from '../../data/places';
import { warmCity } from '../../data/cityCollection';
import type { CityPoint, CountryCity, Quartier } from '../../data/places';
import { Flag } from '../../ui/Flag';
import { COUNTRY_NAME } from '../../domain/countries.ts';
import { changeNights, nightCount, toggleCity, toggleQuartier } from '../../domain/wizard.ts';
import { moveCity } from '../../domain/destinations.ts';
import { DragList } from '../trip/DragList';
import type { WizardCity, WizardState } from '../../domain/wizard.ts';
import { useTheme } from '../../theme/useTheme';
import { fonts, space } from '../../theme/tokens';
import { Choice, RoundButton, StepTitle } from './parts';
import type { StepProps } from './parts';
import { ViewToggle } from './ViewToggle';

type Row = CountryCity;

export function StepCities({ state, update, preferCity, onMapGrab }: StepProps<WizardState> & { preferCity?: string | null; onMapGrab?: (on: boolean) => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [list, setList] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [points, setPoints] = useState<CityPoint[]>([]);
  const [quartiers, setQuartiers] = useState<Map<number, Quartier[]>>(new Map());
  const [allQ, setAllQ] = useState<Set<number>>(new Set());
  const nights = nightCount(state);
  const country = state.country ?? '';

  useEffect(() => {
    let alive = true;
    const id = setTimeout(() => {
      void listCountryCities(country, query).then((r) => { if (!alive) return; setList(r.cities); setError(r.error); });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [country, query]);

  useEffect(() => {
    let alive = true;
    void listCountryCityPoints(country).then((r) => { if (alive) setPoints(r.points); });
    return () => { alive = false; };
  }, [country]);

  // Ville venue d'une idée « Envie de… » : cochée d'office une seule fois.
  const [prefDone, setPrefDone] = useState(false);
  useEffect(() => {
    if (prefDone || !preferCity || !list || state.cities.length) return;
    setPrefDone(true);
    const hit = list.find((c) => c.name.toLowerCase() === preferCity.toLowerCase());
    if (hit) toggle(hit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  const chosen = new Map(state.cities.map((c, i) => [c.id, i]));

  // Préchauffage : les lieux d'une ville choisie commencent à se charger tout de suite (après 1,5 s sans changement),
  // pendant que la personne répond aux étapes suivantes. Trois villes au plus, jamais deux fois la même.
  const warmed = useRef<Set<number>>(new Set());
  const cityKey = state.cities.map((c) => c.id).join(',');
  useEffect(() => {
    const id = setTimeout(() => {
      for (const c of state.cities) {
        if (warmed.current.size >= 3) break;
        if (!warmed.current.has(c.id)) { warmed.current.add(c.id); warmCity(c.id); }
      }
    }, 1500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  // Quartiers à explorer des villes choisies (vides tant que la migration 2200 et la collecte n'ont pas tourné).
  useEffect(() => {
    let alive = true;
    void listQuartiers(state.cities.map((c) => c.id)).then((m) => { if (alive) setQuartiers(m); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey]);

  function toggle(c: Row) {
    // Un quartier trouvé par la recherche : on choisit sa ville avec ce quartier à explorer.
    if (c.parent && c.lat != null && c.lng != null) {
      const q = { id: c.id, name: c.name, lat: c.lat, lng: c.lng };
      if (chosen.has(c.parent.id)) { update({ ...state, cities: toggleQuartier(state.cities, c.parent.id, q) }); return; }
      const r = toggleCity(state.cities, c.parent, nights);
      setWarn(r.error);
      if (!r.error) update({ ...state, cities: toggleQuartier(r.cities, c.parent.id, q) });
      return;
    }
    const r = toggleCity(state.cities, { id: c.id, name: c.name }, nights);
    setWarn(r.error);
    if (!r.error) update({ ...state, cities: r.cities });
  }

  /** « Quartiers à explorer » sous une ville du parcours : 6 d'abord, les autres sur demande. Les choisis restent visibles. */
  function quartierChips(c: WizardCity) {
    const picked = c.quartiers ?? [];
    const list = [...picked.filter((q) => !(quartiers.get(c.id) ?? []).some((x) => x.id === q.id)), ...(quartiers.get(c.id) ?? [])];
    if (!list.length) return null;
    const shown = allQ.has(c.id) ? list : list.slice(0, Math.max(6, picked.length));
    return (
      <View style={{ gap: space.xs, paddingHorizontal: space.xs }}>
        <Text variant="label">Quartiers à explorer · {picked.length ? `${picked.length} choisi${picked.length > 1 ? 's' : ''}` : 'facultatif'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {shown.map((q) => <Chip key={q.id} label={q.name} selected={picked.some((x) => x.id === q.id)} onPress={() => update({ ...state, cities: toggleQuartier(state.cities, c.id, q) })} />)}
          {list.length > shown.length ? <Chip label={`+ ${list.length - shown.length} autres`} onPress={() => setAllQ(new Set([...allQ, c.id]))} /> : null}
        </View>
      </View>
    );
  }

  const selected = useMemo(() => state.cities.map((c, i) => ({ id: c.id, order: i + 1 })), [state.cities]);
  function toggleById(id: number) {
    const p = points.find((x) => x.id === id);
    if (p) toggle({ id: p.id, name: p.name } as Row);
  }

  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const map = (
    <View style={wide ? { flex: 1, minHeight: 280, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' } : { height: Math.max(440, Math.round(height * 0.62)), borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
      <RegionMap country={country} cities={points} selected={selected} onToggle={toggleById} onGrab={onMapGrab} />
      <ViewToggle showing="visual" onPress={() => setShowList(true)} listLabel="Afficher la liste des villes" backLabel="Revenir à la carte" backIcon="map" />
    </View>
  );
  const route = (
    <>
      {state.cities.length > 0 ? (
        <View style={{ gap: space.xs }}>
          {wide ? <Text variant="label">Ton parcours{state.cities.length > 1 ? ' · glisse ⠿ pour changer l\'ordre' : ''}</Text> : (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: routeOpen }} accessibilityLabel="Ton parcours : afficher ou masquer la liste des villes" onPress={() => setRouteOpen(!routeOpen)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontFamily: fonts.sansBold }}>Ton parcours · {state.cities.length} ville{state.cities.length > 1 ? 's' : ''}</Text>
                <Text variant="muted" numberOfLines={1}>{routeOpen ? (state.cities.length > 1 ? 'Glisse ⠿ pour changer l\'ordre, − et + pour les nuits' : 'Ajuste les nuits avec − et +') : state.cities.map((c, i) => `${i + 1}. ${c.name}`).join('  ') + ' · touche pour modifier'}</Text>
              </View>
              <ChevronBadge open={routeOpen} />
            </Pressable>
          )}
          {wide || routeOpen ? <DragList count={state.cities.length} mode="insert" orderKey={state.cities.map((c) => c.id).join(',')} onMove={(from, to) => update({ ...state, cities: moveCity(state.cities, from, to) })} renderRow={(i, handle) => {
            const c = state.cities[i];
            return (
            <View style={{ paddingBottom: space.sm }}>
            <View style={{ gap: space.sm, padding: space.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {state.cities.length > 1 ? handle : null}
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>{i + 1}. {c.name}</Text>
              </View>
              {state.cities.length > 1 ? (
                <RoundButton label="−" name={`Retirer une nuit à ${c.name}`} disabled={c.nights <= 1} onPress={() => update({ ...state, cities: changeNights(state.cities, i, -1) })} />
              ) : null}
              <View style={{ minWidth: 64, alignItems: 'center' }} accessibilityLiveRegion="polite">
                <Text variant="body" style={{ fontFamily: fonts.sansBold }}>{c.nights}</Text>
                <Text variant="muted" style={{ fontSize: 12 }}>nuit{c.nights > 1 ? 's' : ''}</Text>
              </View>
              {state.cities.length > 1 ? (
                <RoundButton label="+" name={`Ajouter une nuit à ${c.name}`} disabled={!state.cities.some((o, j) => j !== i && o.nights > 1)} onPress={() => update({ ...state, cities: changeNights(state.cities, i, 1) })} />
              ) : null}
            </View>
            {quartierChips(c)}
            </View>
            </View>
            );
          }} /> : null}
        </View>
      ) : (
        <Text variant="muted">Tu peux aussi continuer sans choisir : « Je choisirai sur place ».</Text>
      )}
      {warn ? <Text variant="muted" style={{ color: colors.warm }} accessibilityLiveRegion="polite">{warn}</Text> : null}

    </>
  );
  const search = (
    <>
      <Field label="Rechercher une ville" value={query} onChangeText={setQuery} placeholder="Ex. Lisbonne, Porto…" autoCorrect={false} />
      {list === null ? <Text variant="muted">Chargement des villes…</Text> : list.length === 0 ? (
        <Text variant="muted">{query ? 'Aucune ville ne correspond.' : 'Aucune ville en base pour ce pays. Tu peux continuer sans, ou lancer la collecte des villes (voir le guide).'}</Text>
      ) : list.map((c) => {
        if (c.parent) {
          const at = chosen.get(c.parent.id);
          const on = at !== undefined && (state.cities[at].quartiers ?? []).some((q) => q.id === c.id);
          return <Choice key={c.id} title={c.name} detail={`Quartier de ${c.parent.name}`} selected={on} onPress={() => toggle(c)} />;
        }
        const index = chosen.get(c.id);
        return (
          <Choice key={c.id} title={c.name} detail={c.featured_rank != null ? 'Ville phare' : undefined} selected={index !== undefined} onPress={() => toggle(c)}
            right={index !== undefined ? <RNText style={{ fontFamily: fonts.sansBold, fontSize: 13, color: colors.accent }}>{state.cities[index].nights} nuit{state.cities[index].nights > 1 ? 's' : ''}</RNText> : undefined} />
        );
      })}
    </>
  );

  // La carte reste montée (cachée) quand on ouvre la liste : on retrouve la même vue en revenant.
  const zone = (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: showList ? 'none' : 'flex' }}>{map}</View>
      {showList ? (
        <View style={{ gap: space.md }}>
          <View style={{ minHeight: 56, justifyContent: 'center' }}>
            <ViewToggle showing="list" onPress={() => setShowList(false)} listLabel="Afficher la liste des villes" backLabel="Revenir à la carte" backIcon="map" />
          </View>
          {search}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: space.sm, flex: 1 }}>
      <StepTitle title={`Quelles villes en ${COUNTRY_NAME[country] ?? 'ce pays'} ?`}
        hint={`${nights} nuit${nights > 1 ? "s" : ""} à répartir. Touche une région sur la carte, puis les villes à visiter : les nuits se répartissent toutes seules.`} />
      {state.country ? <Flag code={state.country} width={30} /> : null}
      {wide ? (
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'stretch', flex: 1 }}>
          <View style={{ flex: 7, minWidth: 0 }}>{zone}</View>
          <View style={{ flex: 3, minWidth: 260, gap: space.md }}>{route}</View>
        </View>
      ) : (
        <>{zone}{route}</>
      )}
      <ErrorNote message={error} />
    </View>
  );
}
