---
name: supabase-migrations
description: Créer, modifier ou vérifier une migration Supabase de Waypoint (tables, RLS, RPC, Realtime). À utiliser dès qu'on touche à supabase/migrations/, au schéma, aux règles de sécurité ou à all-migrations.sql.
---

# Migrations Supabase (Waypoint)

Le cloud n'a que la clé anon : **il ne peut pas exécuter de migration**. Adrien les lance à la main dans Supabase > SQL Editor. Ton travail : écrire, tester en local, regénérer, documenter.

## Étapes
1. **Nommer** : `supabase/migrations/AAAAMMJJ00NNNN_sujet.sql`, numéro suivant le dernier (voir `ls supabase/migrations`). Une migration par thème.
2. **En-tête** en français, comme les autres : `-- Waypoint · migration NNNN : sujet`, ce que ça fait, et « Migration incrémentale : à exécuter seule, sur une base qui a déjà les migrations 0100 à NNNN-1 ».
3. **Écrire** :
   - toute table : `enable row level security` + politiques explicites (modèle : `trip_shares`, `trip_checklist`), accès via `public.is_trip_member(trip_id)` ;
   - jamais d'accès public non voulu : une fonction `security definer` doit fixer `search_path` et ne rien exposer d'autre que ce qui est annoncé ;
   - l'appli doit **continuer de marcher sans** la migration (fonction facultative, dégradation propre) ; le dire dans le journal.
4. **Tester** : `bash supabase/tests/run-local.sh` (PostgreSQL jetable, schéma + RLS). Ajouter un cas dans `supabase/tests/rls.test.sql` si la migration touche la sécurité. PostGIS est ignoré en local (migration 0700).
5. **Regénérer** : `node scripts/bundle-sql.mjs` (puis `--check`). Ne jamais éditer `supabase/all-migrations.sql` à la main.
6. **Documenter** : ajouter une ligne `vX.Y.Z` dans le journal de `docs/BACKEND.md` avec « **Migration NNNN à exécuter seule dans le SQL Editor** (`chemin`) », et mettre à jour le numéro de version dans `docs/CONTEXT-CLAUDE-CODE.md` si le projet le fait.
7. **Dire à Adrien** : le fichier à coller, où (SQL Editor > New query > Run), et ce qui change dans l'appli.

## Interdits
Modifier une migration déjà lancée (en créer une nouvelle) · mettre une clé `service_role` dans le dépôt · `drop` de données sans demande explicite.
