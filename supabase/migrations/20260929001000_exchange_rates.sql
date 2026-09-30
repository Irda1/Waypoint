-- Waypoint · migration 1000 : taux de change
--
-- Taux du jour de la Banque centrale européenne, via l'API Frankfurter (sans clé), collectés par la passe
-- `rates` du pipeline (clé de service). Tous les taux sont exprimés pour 1 EUR : convertir A -> B, c'est
-- montant / taux(A) * taux(B). Lecture publique, aucune écriture depuis l'app.
--
-- Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à 0900.

create table public.exchange_rates (
  base        char(3) not null default 'EUR' check (base = 'EUR'),
  quote       char(3) not null check (quote ~ '^[A-Z]{3}$'),
  rate        numeric(18, 8) not null check (rate > 0),
  rate_date   date not null,                      -- date de publication du taux (jour ouvré BCE)
  fetched_at  timestamptz not null default now(),
  source      text not null default 'frankfurter.dev (BCE)',
  primary key (base, quote)
);

alter table public.exchange_rates enable row level security;
create policy "lecture publique" on public.exchange_rates for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.exchange_rates from anon, authenticated;

-- La passe `rates` est journalisée dans ingestion_runs (colonne pass = texte libre).
