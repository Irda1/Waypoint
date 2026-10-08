# Graph Report - Waypoint  (2026-10-08)

## Corpus Check
- 440 files · ~230,258 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: .xml 6, (none) 5, .zip 2)

## Summary
- 1390 nodes · 4369 edges · 70 communities (66 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1dcf4c57`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- places.ts
- settings.tsx
- cityCollect.ts
- react
- BudgetCard.tsx
- domain/weather.ts
- Waypoint · backend, collecte de données et application Expo
- Globe.tsx
- ExportCard.tsx
- map/[id].tsx
- trip/[id].tsx
- wizard.ts
- StepProposals.tsx
- Text
- new-trip.tsx
- build-web.mjs
- trips.ts
- domain/routes.ts
- osm.mjs
- DayCard.tsx
- package.json
- passes.test.mjs
- expo
- domain/types.ts
- planning.ts
- domain/itinerary.ts
- ChecklistCard.tsx
- DestinationsCard.tsx
- Card
- expo/package.json
- dependencies
- StepCities.tsx
- build-regions.py
- data/bookings.ts
- app/index.tsx
- cityCollection.ts
- ref_node_assert
- cities.mjs
- SimpleCreate.tsx
- cli.mjs
- pipeline/package.json
- useTheme
- images.mjs
- AuthProvider.tsx
- placeInfo.ts
- compilerOptions
- supabase.ts
- openingHours.ts
- domain/simple.ts
- compilerOptions
- Ponytail
- offline.ts
- data/simple.ts
- reorder.ts
- cities.ts
- Ponytail Help
- scripts
- data/categories.ts
- altplan.ts
- DragList.tsx
- ponytail-audit/SKILL.md
- ponytail-review/SKILL.md
- devDependencies
- useBreakpoint.ts
- ponytail-debt/SKILL.md
- Migrations Supabase (Waypoint)
- pwa.js
- session-start.sh
- run-local.sh
- sw.js

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 96 edges
2. `Text()` - 92 edges
3. `react` - 72 edges
4. `TripScreen()` - 60 edges
5. `react-native` - 60 edges
6. `DayCard()` - 60 edges
7. `Button()` - 57 edges
8. `Card()` - 57 edges
9. `ErrorNote()` - 55 edges
10. `space` - 45 edges

## Surprising Connections (you probably didn't know these)
- `Pièges` --references--> `globeHtml()`  [INFERRED]
  CLAUDE.md → apps/expo/src/domain/globe.ts
- `Journal des versions de l'application` --references--> `accentTolerantTerm()`  [INFERRED]
  docs/BACKEND.md → apps/expo/src/lib/search.ts
- `Application installable` --references--> `main()`  [INFERRED]
  docs/DESCRIPTION-TECHNIQUE.md → pipeline/src/cli.mjs
- `Publication` --references--> `main()`  [INFERRED]
  README.md → pipeline/src/cli.mjs
- `Transports et trafic : où on en est` --references--> `fetchTripData()`  [INFERRED]
  docs/BACKEND.md → apps/expo/src/data/useTrip.ts

## Import Cycles
- None detected.

## Communities (70 total, 4 thin omitted)

### Community 0 - "places.ts"
Cohesion: 0.08
Nodes (40): CityRow, HomeCity, listCities(), listCountryCities(), listCountryCityPoints(), PlaceHit, searchHomeCities(), searchPlaces() (+32 more)

### Community 1 - "settings.tsx"
Cohesion: 0.07
Nodes (38): ACCENT_LABELS, ICON_LABELS, MODE_LABELS, changePrefs(), toggleReminders(), BOOKING_HOUR, buildReminders(), DEFAULT_PREFS (+30 more)

### Community 2 - "cityCollect.ts"
Cohesion: 0.06
Nodes (47): buildFastQuery(), CityInput, collectCityPlaces(), CollectResult, FetchLike, FILTERED_GROUPS, GEOAPIFY_CATEGORIES, geoapifyElements() (+39 more)

### Community 3 - "react"
Cohesion: 0.12
Nodes (33): NEXT, Props, FloatingNav(), NAV_HEIGHT, NavTab, Props, styles, CHOICES (+25 more)

### Community 4 - "BudgetCard.tsx"
Cohesion: 0.10
Nodes (42): loadCountryCurrency(), loadRates(), useLocalMoney(), markReceived(), TripData, ActivityLine, activityLines(), amountDue() (+34 more)

### Community 5 - "domain/weather.ts"
Cohesion: 0.07
Nodes (42): Destination, cache, fetchForecast(), Spot, AdviceInput, AdviceStop, BUSY_MINUTES, dayTips() (+34 more)

### Community 6 - "Waypoint · backend, collecte de données et application Expo"
Cohesion: 0.04
Nodes (42): Commandes, Façon de travailler, Pièges, Structure, Waypoint, 1. Créer le projet Supabase, 2. Appliquer le schéma, 3. Activer la connexion (email et Google) (+34 more)

### Community 7 - "Globe.tsx"
Cohesion: 0.08
Nodes (24): CityPoint, globeHtml(), regionsHtml(), Globe(), WebViewView, GLOBE_COLOR, GlobeProps, RegionMap() (+16 more)

### Community 8 - "ExportCard.tsx"
Cohesion: 0.11
Nodes (31): shareInvite(), createShare(), getShareToken(), revokeShare(), addDays(), buildIcs(), compact(), endOf() (+23 more)

### Community 9 - "map/[id].tsx"
Cohesion: 0.13
Nodes (27): TripMap(), add(), extendCityNow(), useFavorites(), Bounds, boundsOf(), DAY_COLORS, dayColor() (+19 more)

### Community 10 - "trip/[id].tsx"
Cohesion: 0.10
Nodes (26): lodgingOf(), monthShort(), STATUS, styles, TABS, TripScreen(), invite(), submitDay() (+18 more)

### Community 11 - "wizard.ts"
Cohesion: 0.14
Nodes (28): flagEmoji(), BudgetLevelId, FLEXIBLE_DURATIONS, flexibleDates(), MAX_TRIP_DAYS, nightCount(), PARTY_SUFFIX, PartyType (+20 more)

### Community 12 - "StepProposals.tsx"
Cohesion: 0.16
Nodes (25): useCategories(), applyPlan(), loadCandidates(), Row, setDayCity(), dayCost(), PlannedDay, formatTime() (+17 more)

### Community 13 - "Text"
Cohesion: 0.16
Nodes (24): Settings(), addExpense(), createSimpleTrip(), setBudgetLine(), emptyDraft(), SimpleCreate(), create(), AddExpenseCard() (+16 more)

### Community 14 - "new-trip.tsx"
Cohesion: 0.14
Nodes (25): blocker(), CompleteWizard(), back(), create(), NewTrip(), ORDER, createTripFromWizard(), fillProgram() (+17 more)

### Community 15 - "build-web.mjs"
Cohesion: 0.08
Nodes (20): aTraiter, date, fichiers(), marqueurs, pkg, [proprio, nomDepot], racine, sortie (+12 more)

### Community 16 - "trips.ts"
Cohesion: 0.14
Nodes (23): capitalCovers(), CityCover, COVER_FIELDS, MediaRow, toCover(), saveOffline(), InvitePreview, listTrips() (+15 more)

### Community 17 - "domain/routes.ts"
Cohesion: 0.13
Nodes (23): cache, fetchRoute(), keyOf(), queue, useRealRoutes(), estimateOptions(), formatKm(), GOOGLE_MODE (+15 more)

### Community 18 - "osm.mjs"
Cohesion: 0.16
Nodes (21): address(), buildOverpassQuery(), CAPS, classify(), closedDaysFromOpeningHours(), DAYS, displayName(), DURATION_ESTIMATE (+13 more)

### Community 19 - "DayCard.tsx"
Cohesion: 0.17
Nodes (23): applyTimes(), addItem(), applyItemMoves(), clearItemExpenses(), copyItemsToPlan(), createTrip(), deleteItem(), leaveTrip() (+15 more)

### Community 20 - "package.json"
Cohesion: 0.08
Nodes (24): dependencies, @capacitor/android, @capacitor/core, description, devDependencies, @capacitor/cli, qrcode, engines (+16 more)

### Community 21 - "passes.test.mjs"
Cohesion: 0.14
Nodes (13): fetchRetry(), HttpError, sleep(), Throttle, USER_AGENT, createSupabase(), silent(), startFakeSupabase() (+5 more)

### Community 22 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, foregroundImage, adaptiveIcon, package, expo, android, backgroundColor, icon (+15 more)

### Community 23 - "domain/types.ts"
Cohesion: 0.13
Nodes (18): dayHours, DEFAULT_DEPART, DEFAULT_RETURN, HoursIssue, liveStatus, StepState, day(), places (+10 more)

### Community 24 - "planning.ts"
Cohesion: 0.17
Nodes (18): hoursIssues(), DayRef, HoursProblem, HoursReport, ProblemKind, slot(), tripHoursProblems(), organizeTimes() (+10 more)

### Community 25 - "domain/itinerary.ts"
Cohesion: 0.14
Nodes (20): ARRIVAL, badgesOf(), buildPlan(), Candidate, DAY_START, DINNER_AT, durationOf(), fillCities() (+12 more)

### Community 26 - "ChecklistCard.tsx"
Cohesion: 0.24
Nodes (17): addItems(), msg(), removeItem(), setDone(), useChecklist(), CheckItem, cleanLabel(), missingSuggestions() (+9 more)

### Community 27 - "DestinationsCard.tsx"
Cohesion: 0.24
Nodes (17): deleteItems(), findStaleItems(), saveDestinations(), addCity(), CityStay, dayCities(), Dest, moveCity() (+9 more)

### Community 28 - "Card"
Cohesion: 0.17
Nodes (14): JoinTrip(), join(), SharedTripPage(), safeNext(), SignIn(), addPlaceItem(), joinTrip(), loadSharedTrip() (+6 more)

### Community 29 - "expo/package.json"
Cohesion: 0.10
Nodes (19): description, main, name, private, version, expo, expo-constants, expo-font (+11 more)

### Community 30 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, expo, expo-constants, expo-font, @expo-google-fonts/fraunces, @expo-google-fonts/plus-jakarta-sans, expo-linking, expo-notifications (+13 more)

### Community 31 - "StepCities.tsx"
Cohesion: 0.23
Nodes (16): changeNights(), pickParty(), toggleCity(), WizardState, Choice(), RoundButton(), StepProps, StepTitle() (+8 more)

### Community 32 - "build-regions.py"
Cohesion: 0.16
Nodes (6): build(), clean(), codes(), rnd(), round_geom(), ring()

### Community 33 - "data/bookings.ts"
Cohesion: 0.21
Nodes (14): msg(), removeBooking(), saveBooking(), useBookings(), Booking, BOOKING_KINDS, BookingDraft, BookingKind (+6 more)

### Community 34 - "app/index.tsx"
Cohesion: 0.20
Nodes (12): Home(), horizon, IDEAS, styles, listTrash(), restoreTrip(), savedLabel(), tripStatus (+4 more)

### Community 35 - "cityCollection.ts"
Cohesion: 0.20
Nodes (14): collectCityNow(), collectCityOnce(), Collected, CollectOutcome, ensureCitiesCollected(), inflight, warmCity(), cityCollectionStatuses() (+6 more)

### Community 36 - "ref_node_assert"
Cohesion: 0.16
Nodes (5): rows, CityRun, cityRuns(), checkNewDay(), suggestNewDay()

### Community 37 - "cities.mjs"
Cohesion: 0.25
Nodes (9): CONTINENTS, flagEmoji(), GEONAMES_LICENSE, namesIn(), parseAdmin1(), parseCities(), parseCountryInfo(), readFirstZipEntry() (+1 more)

### Community 38 - "SimpleCreate.tsx"
Cohesion: 0.23
Nodes (12): CityOption, COUNTRIES, Country, COUNTRY_NAME, plain(), POPULAR, RAW, searchCountries() (+4 more)

### Community 39 - "cli.mjs"
Cohesion: 0.17
Nodes (11): APK Android de Waypoint, Avant de pousser un changement d'appli, Dépannage, Fonctionnement, Ne jamais, cfg, log(), main() (+3 more)

### Community 40 - "pipeline/package.json"
Cohesion: 0.13
Nodes (14): description, engines, node, name, private, scripts, cities, countries (+6 more)

### Community 41 - "useTheme"
Cohesion: 0.29
Nodes (13): setTripMemo(), fastest(), googlePlaceUrl(), travelOptions(), HoursCard(), LegRow(), MemoCard(), save() (+5 more)

### Community 42 - "images.mjs"
Cohesion: 0.33
Nodes (10): finishRun(), startRun(), countriesPass(), bestPhoto(), imagesPass(), norm(), photoToMedia(), scorePhoto() (+2 more)

### Community 43 - "AuthProvider.tsx"
Cohesion: 0.27
Nodes (10): RootLayout(), AuthContext, AuthProvider(), AuthValue, friendly(), sessionFromUrl(), clearOffline(), useAppFonts() (+2 more)

### Community 44 - "placeInfo.ts"
Cohesion: 0.32
Nodes (9): cache, frTitleFromWikidata(), loadPlaceInfo(), PlaceInfo, usePlaceInfo(), wikipediaSummary(), shortExtract(), WikiSource (+1 more)

### Community 45 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 46 - "supabase.ts"
Cohesion: 0.29
Nodes (6): GEOAPIFY_KEY, isConfigured, SUPABASE_ANON_KEY, SUPABASE_URL, WEB_URL, supabase

### Community 47 - "openingHours.ts"
Cohesion: 0.31
Nodes (8): checkOpening(), DAYS, NAMES, OpeningCheck, parseDays(), parseOpeningHours(), toMin(), WeekHours

### Community 48 - "domain/simple.ts"
Cohesion: 0.33
Nodes (6): dayName(), filterPlaces(), mapsUrl(), openingToday(), selectionBudget, SimplePlace

### Community 49 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowImportingTsExtensions, paths, strict, types, extends, include, expo/tsconfig.base

### Community 50 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 51 - "offline.ts"
Cohesion: 0.46
Nodes (5): loadOffline(), decodeSnapshot(), encodeSnapshot(), FR_MONTHS, Snapshot

### Community 52 - "data/simple.ts"
Cohesion: 0.43
Nodes (5): loadCityPlaces(), setTravelers(), BY_CATEGORY, estimatePrice(), withEstimatedPrice()

### Community 53 - "reorder.ts"
Cohesion: 0.36
Nodes (5): ItemMove, MovableItem, moveToIndex(), swapItems(), swapWithNeighbor()

### Community 54 - "cities.ts"
Cohesion: 0.39
Nodes (6): FILLERS, plain(), RankableCity, rankCities(), cities, titleWords()

### Community 55 - "Ponytail Help"
Cohesion: 0.25
Nodes (7): Configure Default Mode, Deactivate, Levels, More, Ponytail Help, Skills, Update

### Community 56 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, export:web, start, test, typecheck, web

### Community 57 - "data/categories.ts"
Cohesion: 0.52
Nodes (5): load(), buildCategories(), Categories, Category, EMPTY_CATEGORIES

### Community 58 - "altplan.ts"
Cohesion: 0.40
Nodes (4): AltKind, AltStop, MEALS, OUTDOOR

### Community 59 - "DragList.tsx"
Cohesion: 0.50
Nodes (4): Box, DragList(), Handle(), Props

### Community 60 - "ponytail-audit/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 61 - "ponytail-review/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 62 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, @types/node, @types/react, typescript

### Community 63 - "useBreakpoint.ts"
Cohesion: 0.67
Nodes (3): Breakpoint, breakpointFor(), useBreakpoint()

### Community 64 - "ponytail-debt/SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 65 - "Migrations Supabase (Waypoint)"
Cohesion: 0.50
Nodes (3): Interdits, Migrations Supabase (Waypoint), Étapes

## Knowledge Gaps
- **392 isolated node(s):** `session-start.sh script`, `name`, `slug`, `scheme`, `version` (+387 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 476 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `places.ts`, `settings.tsx`, `BudgetCard.tsx`, `domain/weather.ts`, `Globe.tsx`, `ExportCard.tsx`, `map/[id].tsx`, `trip/[id].tsx`, `wizard.ts`, `StepProposals.tsx`, `Text`, `new-trip.tsx`, `trips.ts`, `domain/routes.ts`, `DayCard.tsx`, `ChecklistCard.tsx`, `DestinationsCard.tsx`, `Card`, `expo/package.json`, `StepCities.tsx`, `data/bookings.ts`, `app/index.tsx`, `SimpleCreate.tsx`, `useTheme`, `AuthProvider.tsx`, `placeInfo.ts`, `supabase.ts`, `data/categories.ts`, `DragList.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `session-start.sh script`, `name`, `slug` to the rest of the system?**
  _392 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `places.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0841799709724238 - nodes in this community are weakly interconnected._
- **Why does `Waypoint · backend, collecte de données et application Expo` connect `Waypoint · backend, collecte de données et application Expo` to `cityCollection.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `settings.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06561085972850679 - nodes in this community are weakly interconnected._
- **Why does `Transports et trafic : où on en est` connect `cityCollection.ts` to `settings.tsx`, `BudgetCard.tsx`, `ref_node_assert`, `Waypoint · backend, collecte de données et application Expo`, `DragList.tsx`, `trips.ts`, `reorder.ts`, `planning.ts`, `DestinationsCard.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `cityCollect.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05957767722473605 - nodes in this community are weakly interconnected._