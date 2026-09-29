-- Waypoint · villes phares (celles de la maquette, avec leur nom français et leur ordre d'affichage)
--
-- À lancer une fois dans l'éditeur SQL, après la collecte des pays et des villes (passes « countries » et « cities »).
-- Pour chaque ville phare : si une ville de la base se trouve à moins de 0,2° (≈ 20 km), c'est la plus peuplée
-- qui est marquée (nom français + rang) ; sinon la ville est ajoutée (source « seed »). Sans danger si relancé.

do $$
declare
  f record;
  v_id bigint;
begin
  for f in
    select * from (values
      ('PT', 'Lisbonne', 1, 38.7223, -9.1393),
      ('PT', 'Porto', 2, 41.1579, -8.6291),
      ('PT', 'Sintra', 3, 38.8029, -9.3817),
      ('PT', 'Lagos (Algarve)', 4, 37.1028, -8.673),
      ('PT', 'Coimbra', 5, 40.2033, -8.4103),
      ('JP', 'Tokyo', 1, 35.6812, 139.7671),
      ('JP', 'Kyoto', 2, 35.0116, 135.7681),
      ('JP', 'Osaka', 3, 34.6937, 135.5023),
      ('JP', 'Nara', 4, 34.6851, 135.8048),
      ('JP', 'Hiroshima', 5, 34.3853, 132.4553),
      ('IT', 'Rome', 1, 41.9028, 12.4964),
      ('IT', 'Florence', 2, 43.7696, 11.2558),
      ('IT', 'Venise', 3, 45.4408, 12.3155),
      ('IT', 'Naples', 4, 40.8518, 14.2681),
      ('IT', 'Milan', 5, 45.4642, 9.19),
      ('ES', 'Barcelone', 1, 41.3874, 2.1686),
      ('ES', 'Madrid', 2, 40.4168, -3.7038),
      ('ES', 'Séville', 3, 37.3891, -5.9845),
      ('ES', 'Grenade', 4, 37.1773, -3.5986),
      ('GR', 'Athènes', 1, 37.9838, 23.7275),
      ('GR', 'Santorin', 2, 36.3932, 25.4615),
      ('GR', 'Naxos', 3, 37.1036, 25.3766),
      ('GR', 'Thessalonique', 4, 40.6401, 22.9444),
      ('MA', 'Marrakech', 1, 31.6295, -7.9811),
      ('MA', 'Fès', 2, 34.0181, -5.0078),
      ('MA', 'Essaouira', 3, 31.5085, -9.7595),
      ('MA', 'Chefchaouen', 4, 35.1688, -5.2636),
      ('TH', 'Bangkok', 1, 13.7563, 100.5018),
      ('TH', 'Chiang Mai', 2, 18.7883, 98.9853),
      ('TH', 'Phuket', 3, 7.8804, 98.3923),
      ('TH', 'Krabi', 4, 8.0863, 98.9063),
      ('US', 'New York', 1, 40.7128, -74.006),
      ('US', 'San Francisco', 2, 37.7749, -122.4194),
      ('US', 'Los Angeles', 3, 34.0522, -118.2437),
      ('US', 'Chicago', 4, 41.8781, -87.6298),
      ('GB', 'Londres', 1, 51.5072, -0.1276),
      ('GB', 'Édimbourg', 2, 55.9533, -3.1883),
      ('GB', 'Liverpool', 3, 53.4084, -2.9916),
      ('HR', 'Split', 1, 43.5081, 16.4402),
      ('HR', 'Dubrovnik', 2, 42.6507, 18.0944),
      ('HR', 'Zagreb', 3, 45.815, 15.9819),
      ('IS', 'Reykjavik', 1, 64.1466, -21.9426),
      ('IS', 'Vík', 2, 63.4186, -19.006),
      ('IS', 'Akureyri', 3, 65.6885, -18.1262),
      ('MX', 'Mexico', 1, 19.4326, -99.1332),
      ('MX', 'Oaxaca', 2, 17.0732, -96.7266),
      ('MX', 'Tulum', 3, 20.2114, -87.4654),
      ('ID', 'Ubud (Bali)', 1, -8.5069, 115.2625),
      ('ID', 'Yogyakarta', 2, -7.7956, 110.3695),
      ('ID', 'Jakarta', 3, -6.2088, 106.8456),
      ('VN', 'Hanoï', 1, 21.0278, 105.8342),
      ('VN', 'Hội An', 2, 15.8801, 108.338),
      ('VN', 'Hô Chi Minh-Ville', 3, 10.8231, 106.6297),
      ('CA', 'Montréal', 1, 45.5019, -73.5674),
      ('CA', 'Québec', 2, 46.8139, -71.208),
      ('CA', 'Vancouver', 3, 49.2827, -123.1207),
      ('CA', 'Toronto', 4, 43.6532, -79.3832),
      ('NO', 'Oslo', 1, 59.9139, 10.7522),
      ('NO', 'Bergen', 2, 60.3913, 5.3221),
      ('NO', 'Tromsø', 3, 69.6492, 18.9553)
    ) as t (code, name_fr, rank, lat, lng)
  loop
    -- 1. la ville existante la plus peuplée autour de la ville phare
    select c.id into v_id
    from public.cities c
    where c.country_code = f.code and abs(c.lat - f.lat) < 0.2 and abs(c.lng - f.lng) < 0.2
    order by c.population desc nulls last
    limit 1;

    if v_id is not null then
      update public.cities set name_fr = f.name_fr, featured_rank = f.rank where id = v_id;
    elsif exists (select 1 from public.countries k where k.code = f.code) then
      -- 2. sinon on l'ajoute (pays présent en base uniquement)
      insert into public.cities (country_code, name, name_fr, lat, lng, featured_rank, source, license)
      values (f.code, f.name_fr, f.name_fr, f.lat, f.lng, f.rank, 'seed', 'exemple');
    end if;
  end loop;
end $$;
