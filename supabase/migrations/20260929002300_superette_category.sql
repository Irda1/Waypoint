-- Waypoint · migration 2300 : catégorie « Supérettes » (filtre Pratique de la carte)
--
-- La carte gagne un filtre « Pratique » (pharmacies, toilettes, distributeurs, banques, hôpitaux, laveries) et la
-- collecte ajoute les supérettes et supermarchés (OpenStreetMap shop=convenience|supermarket). Un lieu n'est enregistré
-- que si sa catégorie existe : on ajoute donc « superette » sous « Pratique ».
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 2200.
-- Sans elle l'appli marche comme avant : les supérettes sont simplement ignorées à la collecte.

insert into public.place_categories (code, kind, parent_code, name_fr, name_en, icon, sort_order)
values ('superette', 'service', 'pratique', 'Supérettes', 'Convenience stores', 'superette', 107)
on conflict do nothing;
