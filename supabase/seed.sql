-- Waypoint · données d'exemple pour le développement local (supabase db reset)
--
-- ATTENTION : ce sont des exemples pour travailler avant la première collecte,
-- pas des données vérifiées. `source = 'seed'` permet de les retirer d'une requête :
--   delete from public.countries where source = 'seed';

insert into public.countries (code, iso3, name_fr, name_en, capital, region, currency_codes, languages, timezones, flag_emoji, source, license)
values
  ('PT', 'PRT', 'Portugal', 'Portugal', 'Lisbonne', 'Europe', '{EUR}', '{pt}', '{Europe/Lisbon}', '🇵🇹', 'seed', 'exemple'),
  ('JP', 'JPN', 'Japon', 'Japan', 'Tokyo', 'Asie', '{JPY}', '{ja}', '{Asia/Tokyo}', '🇯🇵', 'seed', 'exemple'),
  ('FR', 'FRA', 'France', 'France', 'Paris', 'Europe', '{EUR}', '{fr}', '{Europe/Paris}', '🇫🇷', 'seed', 'exemple')
on conflict (code) do nothing;

insert into public.cities (country_code, name, name_fr, lat, lng, timezone, is_capital, geonames_id, source, license)
values
  ('PT', 'Lisboa', 'Lisbonne', 38.7223, -9.1393, 'Europe/Lisbon', true, 2267057, 'seed', 'exemple'),
  ('PT', 'Porto', 'Porto', 41.1579, -8.6291, 'Europe/Lisbon', false, 2735943, 'seed', 'exemple'),
  ('JP', 'Tōkyō', 'Tokyo', 35.6895, 139.6917, 'Asia/Tokyo', true, 1850147, 'seed', 'exemple'),
  ('FR', 'Paris', 'Paris', 48.8566, 2.3522, 'Europe/Paris', true, 2988507, 'seed', 'exemple')
on conflict (geonames_id) do nothing;
