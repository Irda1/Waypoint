import React, { useMemo, useState } from 'react';
import { ScrollView, Text as RNText, View } from 'react-native';
import { Card, Chip, Text } from '../../ui';
import { describeCode, isCovered, tempRange } from '../../domain/weather.ts';
import type { Forecast } from '../../domain/weather.ts';
import { todayIso, shortDate } from '../../lib/dates.ts';
import type { Destination } from '../../data/useTrip';
import { useTheme } from '../../theme/useTheme';
import { Icon } from '../../ui/Icon';
import { fonts, space } from '../../theme/tokens';

interface Props { destinations: Destination[]; forecasts: Map<number, Forecast>; loading: boolean; error: string | null; start: string | null; end: string | null }

export function WeatherCard({ destinations, forecasts, loading, error, start, end }: Props) {
  const { colors } = useTheme();
  const today = useMemo(() => todayIso(), []);
  const [cityId, setCityId] = useState<number | null>(null);
  if (destinations.length === 0) return null;
  const city = destinations.find((d) => d.city_id === cityId) ?? destinations[0];
  const f = forecasts.get(city.city_id);
  const inTrip = (date: string) => (!start || date >= start) && (!end || date <= end);
  // Les jours du voyage couverts par les prévisions ; sinon les prochains jours, pour se faire une idée.
  const tripDays = f?.days.filter((d) => inTrip(d.date) && isCovered(d.date, today)) ?? [];
  const days = tripDays.length ? tripDays : (f?.days.slice(0, 7) ?? []);
  const tripBeyond = !!start && !isCovered(start, today) && start > today;

  return (
    <Card>
      <Text variant="label">Météo</Text>
      {destinations.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {destinations.map((d) => <Chip key={d.city_id} label={d.name} selected={d.city_id === city.city_id} onPress={() => setCityId(d.city_id)} />)}
        </ScrollView>
      ) : null}
      {loading && !f ? <Text variant="muted">Chargement de la météo…</Text> : null}
      {error ? <Text variant="muted" style={{ color: colors.warm }}>{error}</Text> : null}
      {f?.current && f.current.temp != null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name={describeCode(f.current.code).icon} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{Math.round(f.current.temp)}° à {city.name}</Text>
            <Text variant="muted">
              {[describeCode(f.current.code).label, f.current.feels != null ? `ressenti ${Math.round(f.current.feels)}°` : null, f.current.wind != null ? `vent ${Math.round(f.current.wind)} km/h` : null, f.current.humidity != null ? `humidité ${Math.round(f.current.humidity)} %` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}
      {days.length ? (
        <>
          <Text variant="muted">{tripDays.length ? 'Prévisions pendant ton voyage' : 'Prévisions des prochains jours'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {days.map((d) => (
              <View key={d.date} style={{ width: 92, alignItems: 'center', gap: 2, padding: space.sm, borderRadius: 14, backgroundColor: colors.surface2 }} accessibilityLabel={`${shortDate(d.date)} : ${describeCode(d.code).label}, ${tempRange(d)}${d.rainProb != null ? `, pluie ${d.rainProb} %` : ''}`}>
                <Text variant="muted" style={{ fontSize: 12 }}>{shortDate(d.date)}</Text>
                <Icon name={describeCode(d.code).icon} size={26} />
                <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 13, color: colors.text }}>{tempRange(d)}</RNText>
                {d.rainProb != null ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Icon name="drop" size={12} tone="muted" /><Text variant="muted" style={{ fontSize: 12 }}>{Math.round(d.rainProb)} %</Text></View> : null}
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
      {tripBeyond ? <Text variant="muted">Les prévisions couvrent 16 jours : celles de ton voyage apparaîtront à l'approche du départ.</Text> : null}
      <Text variant="muted" style={{ fontSize: 12 }}>Prévisions (modèles météo, pas des mesures). Données : Open-Meteo.com, licence CC BY 4.0.{f?.fetchedAt ? ` Mis à jour à ${new Date(f.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ''}</Text>
    </Card>
  );
}
