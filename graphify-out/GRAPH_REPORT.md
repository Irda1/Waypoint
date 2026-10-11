# Graph Report - Waypoint  (2026-10-11)

## Corpus Check
- 490 files · ~590,597 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 52 file(s) not represented in the graph (top: .csv 35, (none) 14, .zip 2)

## Summary
- 2665 nodes · 6172 edges · 146 communities (144 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 49 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f0dce5f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- StayCard.tsx
- domain/reminders.ts
- cityCollect.ts
- react
- budget.ts
- domain/weather.ts
- Waypoint · backend, collecte de données et application Expo
- RegionMap.tsx
- exportTrip.ts
- map.ts
- trip/[id].tsx
- wizard.ts
- map/[id].tsx
- Button
- core.py
- design_system.py
- useTrip.ts
- domain/routes.ts
- passes.test.mjs
- DayCard
- validate_data.py
- brandkit/SKILL.md
- expo
- DayCard.tsx
- planning.ts
- domain/itinerary.ts
- ChecklistCard
- Hardening Controls
- trips.ts
- expo/package.json
- dependencies
- useTheme
- build-regions.py
- data/bookings.ts
- Card
- cityCollection.ts
- ref_node_assert
- CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE
- CORE DIRECTIVE: PREMIUM MOBILE APP IMAGE DIRECTION
- APK Android de Waypoint
- pipeline/package.json
- Worked example: Agent Teams for competing-hypothesis debugging
- Code Review and Quality
- AuthProvider.tsx
- placeInfo.ts
- compilerOptions
- supabase.ts
- formatTime
- Test-Driven Development
- compilerOptions
- Ponytail
- offline.ts
- supabase
- reorder.ts
- cities.ts
- Ponytail Help
- scripts
- data/categories.ts
- Performance Checklist
- Git Workflow and Versioning
- ponytail-audit/SKILL.md
- ponytail-review/SKILL.md
- devDependencies
- Optimization Patterns
- ponytail-debt/SKILL.md
- Migrations Supabase (Waypoint)
- Local Storage
- session-start.sh
- run-local.sh
- Shipping and Launch
- Frontend UI Engineering
- DesignSystemGenerator
- CI/CD and Automation
- Incremental Implementation
- 3. Heal
- Code Simplification
- Debugging and Error Recovery
- settings.tsx
- Browser Session Management
- Design Audit
- Globe.tsx
- Interview Me
- Security Checklist
- UI/UX Pro Max - Design Intelligence
- flights.ts
- Accessibility Checklist
- CORE DIRECTIVE: AWWWARDS-LEVEL IMAGE ART DIRECTION
- Tracing
- osm.ts
- StepDeparture.tsx
- Browser Automation with playwright-cli
- tasteskill: Anti-Slop Frontend Skill
- Appendix B - Canonical Sources (read these before reinventing)
- Settings
- data/cityPhoto.ts
- Testing Patterns Reference (JavaScript/TypeScript)
- 2. THE COMBINATORIAL VARIATION ENGINE
- playwright-cli/SKILL.md
- Running Custom Playwright Code
- Pre-Delivery Checklist (canonical — the only one)
- Quick Reference
- cityCollect.test.ts
- Commands
- 4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)
- MapCanvas.tsx
- The Standing Checklist
- Observability Checklist
- rates.ts
- 22. STYLE VARIATION ENGINE
- Video Recording
- 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)
- ExportCard.tsx
- 11. COMPONENT EXECUTION GUIDELINES
- 18. EXTRA CREATIVITY & IMPLEMENTATION EDGE
- Cookies
- json
- Waypoint — contexte complet du projet (à jour v1.11.17, 11/10/2026)
- 12. THE COMBINATORIAL VARIATION ENGINE
- 8. ANTI-AI-SLOP RULES
- Advanced Mocking with run-code
- 9. AI TELLS (Forbidden Patterns)
- airports.ts
- ShareCard
- 33. CATEGORY-SPECIFIC BIAS
- 13. COLOR & MATERIAL RULES
- 4. HERO MINIMALISM RULES
- APPENDICES - Real Source-Backed Reference Material
- 11. REDESIGN PROTOCOL
- 3. DEFAULT ARCHITECTURE & CONVENTIONS
- 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS
- 29. ANTI-AI-SLOP RULES
- 5. IMAGE COUNT & PAGE SLICING
- _resolve_color_mode
- 21. MOBILE ANTI-AI-TELLS RULE
- Attaching Screenshots and Videos to Pull Requests
- 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)
- 5. CONTEXT-AWARE PROACTIVITY
- 8. DARK MODE PROTOCOL
- 33. DEFAULT SECTION PACKS
- 14. HERO MINIMALISM RULES
- 37. EXAMPLE INTERPRETATIONS
- 2. PLATFORM MODE RULE
- 37. EXAMPLE INTERPRETATIONS
- 15. DEFAULT SITE PACKS
- 20. EXAMPLE INTERPRETATIONS
- 7. DIAL DEFINITIONS (Technical Reference)

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 107 edges
2. `Text()` - 94 edges
3. `react` - 76 edges
4. `TripScreen()` - 69 edges
5. `react-native` - 63 edges
6. `DayCard()` - 62 edges
7. `Button()` - 62 edges
8. `Icon()` - 60 edges
9. `Card()` - 56 edges
10. `ErrorNote()` - 53 edges

## Surprising Connections (you probably didn't know these)
- `Pièges` --references--> `globeHtml()`  [INFERRED]
  CLAUDE.md → apps/expo/src/domain/globe.ts
- `Journal des versions de l'application` --references--> `accentTolerantTerm()`  [INFERRED]
  docs/BACKEND.md → apps/expo/src/lib/search.ts
- `Interaction (App)` --references--> `Button()`  [INFERRED]
  .claude/skills/ui-ux-pro-max/references/pro-rules.md → apps/expo/src/ui/index.tsx
- `Transports et trafic : où on en est` --references--> `collectCityNow()`  [INFERRED]
  docs/BACKEND.md → apps/expo/src/data/cityCollection.ts
- `Transports et trafic : où on en est` --references--> `warmCity()`  [INFERRED]
  docs/BACKEND.md → apps/expo/src/data/cityCollection.ts

## Import Cycles
- None detected.

## Communities (146 total, 2 thin omitted)

### Community 0 - "StayCard.tsx"
Cohesion: 0.18
Nodes (23): PlaceHit, addManualStay(), addStay(), removeStay(), setStayNights(), updateStay(), addExpense(), DayRef (+15 more)

### Community 1 - "domain/reminders.ts"
Cohesion: 0.12
Nodes (13): BOOKING_HOUR, buildReminders(), DEFAULT_PREFS, EVE_HOUR, listNames(), local(), MAX_REMINDERS, MINUTES_CHOICES (+5 more)

### Community 2 - "cityCollect.ts"
Cohesion: 0.11
Nodes (23): CityInput, collectCityPlaces(), CollectResult, FetchLike, FILTERED_GROUPS, GEOAPIFY_CATEGORIES, geoapifyElements(), GeoapifyFeature (+15 more)

### Community 3 - "react"
Cohesion: 0.18
Nodes (20): styles, NEXT, Props, CHOICES, MODES, ICON, SHORT, MEMO_MAX (+12 more)

### Community 4 - "budget.ts"
Cohesion: 0.13
Nodes (32): markReceived(), ActivityLine, activityLines(), amountDue(), applyPayments(), Balance, budgetSummary(), computeBalances() (+24 more)

### Community 5 - "domain/weather.ts"
Cohesion: 0.08
Nodes (38): cache, fetchForecast(), Spot, useForecasts(), AdviceInput, AdviceStop, BUSY_MINUTES, dayTips() (+30 more)

### Community 6 - "Waypoint · backend, collecte de données et application Expo"
Cohesion: 0.04
Nodes (43): Carte du code (Graphify), Commandes, Façon de travailler, Pièges, Structure, Waypoint, 1. Créer le projet Supabase, 2. Appliquer le schéma (+35 more)

### Community 7 - "RegionMap.tsx"
Cohesion: 0.21
Nodes (9): CityPoint, regionsHtml(), RegionMap(), WebViewView, RegionMapProps, REGIONS_BASE_NATIVE, REGIONS_COLOR, WEB_BASE (+1 more)

### Community 8 - "exportTrip.ts"
Cohesion: 0.19
Nodes (17): addDays(), buildIcs(), compact(), endOf(), esc(), ExportDay, exportEntries(), ExportEntry (+9 more)

### Community 9 - "map.ts"
Cohesion: 0.18
Nodes (14): Bounds, boundsOf(), DAY_COLORS, dayColor(), discoverPoints(), Filters, foldText(), legendDays() (+6 more)

### Community 10 - "trip/[id].tsx"
Cohesion: 0.10
Nodes (36): lodgingOf(), STATUS, styles, TABS, TripScreen(), weekdayShort(), pickSource(), setTravelers() (+28 more)

### Community 11 - "wizard.ts"
Cohesion: 0.05
Nodes (77): blocker(), CompleteWizard(), back(), create(), submitDay(), createTripFromWizard(), fillProgram(), COUNTRIES (+69 more)

### Community 12 - "map/[id].tsx"
Cohesion: 0.10
Nodes (41): TripMap(), add(), useCategories(), useFavorites(), loadCandidates(), addPlaceItem(), CityOption, CityRow (+33 more)

### Community 13 - "Button"
Cohesion: 0.15
Nodes (25): findStaleItems(), saveDestinations(), TripData, convert(), formatApprox(), POSTES, AddExpenseCard(), NOMS (+17 more)

### Community 14 - "core.py"
Cohesion: 0.06
Nodes (31): BM25, _contains_phrase(), detect_domain(), _domain_keywords(), _exact_match_diagnostic(), _exact_row_identity(), _exact_stack_identifier(), _file_signature() (+23 more)

### Community 15 - "design_system.py"
Cohesion: 0.05
Nodes (23): ansi_ljust(), _button_outline_text_color(), _contrast_ratio(), _derive_dark_palette(), _detect_page_type(), format_ascii_box(), add_wrapped(), wrap_text() (+15 more)

### Community 16 - "useTrip.ts"
Cohesion: 0.14
Nodes (21): capitalCovers(), CityCover, COVER_FIELDS, MediaRow, toCover(), City, saveOffline(), listTrips() (+13 more)

### Community 17 - "domain/routes.ts"
Cohesion: 0.11
Nodes (26): cache, fetchRoute(), keyOf(), queue, useRealRoutes(), formatKm(), GOOGLE_MODE, googlePlaceUrl() (+18 more)

### Community 18 - "passes.test.mjs"
Cohesion: 0.05
Nodes (64): cfg, log(), main(), { values: flags, positionals }, loadConfig(), requireSupabase(), CONTINENTS, flagEmoji() (+56 more)

### Community 19 - "DayCard"
Cohesion: 0.14
Nodes (21): applyTimes(), addItem(), copyItemsToPlan(), setDayHours(), setItemTime(), AltKind, AltStop, deriveAltPlan() (+13 more)

### Community 20 - "validate_data.py"
Cohesion: 0.09
Nodes (38): _catalog_date(), _check_app_interface_contract(), _check_catalog_contract(), _check_catalog_summary(), _check_chart_contract(), _check_color_contract(), _check_core_data_contract(), _check_file() (+30 more)

### Community 21 - "brandkit/SKILL.md"
Cohesion: 0.05
Nodes (43): 1. Logo Cover, 1. Monogram + Meaning, 2 × 3 REFERENCE-STYLE LAYOUT, 2. Logo Construction, 2. Product Action, 3. Digital Application, 3. Metaphor Fusion, 4. Brand Essence (+35 more)

### Community 22 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, foregroundImage, adaptiveIcon, package, expo, android, backgroundColor, icon (+15 more)

### Community 23 - "DayCard.tsx"
Cohesion: 0.26
Nodes (11): Row, Day, OrderableItem, PlannedDay, PlannedItem, ScheduledItem, Expense, Place (+3 more)

### Community 24 - "planning.ts"
Cohesion: 0.14
Nodes (19): dayHours, DEFAULT_DEPART, DEFAULT_RETURN, HoursIssue, hoursIssues(), liveStatus, StepState, day() (+11 more)

### Community 25 - "domain/itinerary.ts"
Cohesion: 0.12
Nodes (23): ARRIVAL, ARRIVAL_TITLES, badgesOf(), buildPlan(), Candidate, DAY_START, dayCost(), DINNER_AT (+15 more)

### Community 26 - "ChecklistCard"
Cohesion: 0.21
Nodes (17): addItems(), msg(), removeItem(), setDone(), useChecklist(), CheckItem, cleanLabel(), missingSuggestions() (+9 more)

### Community 27 - "Hardening Controls"
Cohesion: 0.05
Nodes (42): Broken Access Control, Broken Authentication, Cross-Site Scripting (XSS), Data Classification, Dependency Audit Triage, Destructive Operations on Derived Paths, File Upload Safety, Hardening Patterns (+34 more)

### Community 28 - "trips.ts"
Cohesion: 0.11
Nodes (29): join(), invite(), addDay(), addDestination(), applyItemMoves(), clearItemExpenses(), createInvite(), createSimpleTrip() (+21 more)

### Community 29 - "expo/package.json"
Cohesion: 0.12
Nodes (18): description, main, name, private, version, expo, expo-constants, expo-font (+10 more)

### Community 30 - "dependencies"
Cohesion: 0.09
Nodes (22): dependencies, expo, expo-constants, expo-font, @expo-google-fonts/fraunces, @expo-google-fonts/plus-jakarta-sans, expo-linking, expo-notifications (+14 more)

### Community 31 - "useTheme"
Cohesion: 0.20
Nodes (30): NewTrip(), ORDER, STEP_NAME, COUNTRY_NAME, WizardState, ModeChoice(), TripMode, Picked (+22 more)

### Community 32 - "build-regions.py"
Cohesion: 0.18
Nodes (6): build(), clean(), codes(), rnd(), round_geom(), ring()

### Community 33 - "data/bookings.ts"
Cohesion: 0.18
Nodes (16): msg(), removeBooking(), saveBooking(), useBookings(), Booking, BOOKING_KINDS, BookingDraft, BookingKind (+8 more)

### Community 34 - "Card"
Cohesion: 0.11
Nodes (28): Home(), IDEAS, styles, JoinTrip(), SharedTripPage(), safeNext(), SignIn(), useAuth() (+20 more)

### Community 35 - "cityCollection.ts"
Cohesion: 0.18
Nodes (15): collectCityNow(), collectCityOnce(), Collected, CollectOutcome, ensureCitiesCollected(), extendCityNow(), inflight, warmCity() (+7 more)

### Community 36 - "ref_node_assert"
Cohesion: 0.16
Nodes (7): CityRun, cityRuns(), contrastRatio(), luminance(), Mode, accents, modes

### Community 37 - "CORE DIRECTIVE: IMAGE-FIRST WEBSITE DESIGN TO CODE"
Cohesion: 0.06
Nodes (34): 10. IMAGE-FIRST CODEX WEBSITE WORKFLOW, 11. WHEN TO TRIGGER IMAGE GENERATION FIRST, 13. WEBSITE REFERENCE RULE, 15. RESPONSIVE FIRST-VIEW RULE, 16. ANTI-NESTED-BOX RULE, 17. REDUCE MICRO-UI CLUTTER RULE, 18. SECTION IMAGE GENERATION RULE, 19. WEBSITE IMAGE SYSTEM RULE (+26 more)

### Community 38 - "CORE DIRECTIVE: PREMIUM MOBILE APP IMAGE DIRECTION"
Cohesion: 0.06
Nodes (34): 10. DEVICE MOCKUP FRAME RULE, 11. ONBOARDING FLOW RULE, 12. FIRST SCREEN CLEANLINESS RULE, 13. SAFE AREA AND SYSTEM REGION RULE, 14. NAVIGATION RULE, 15. CLEAN LAYOUT RULE, 16. CREATIVE IMAGE DIRECTION RULE, 17. BACKGROUND TEXTURE AND SURFACE RULE (+26 more)

### Community 39 - "APK Android de Waypoint"
Cohesion: 0.33
Nodes (5): APK Android de Waypoint, Avant de pousser un changement d'appli, Dépannage, Fonctionnement, Ne jamais

### Community 40 - "pipeline/package.json"
Cohesion: 0.13
Nodes (14): description, engines, node, name, private, scripts, cities, countries (+6 more)

### Community 41 - "Worked example: Agent Teams for competing-hypothesis debugging"
Cohesion: 0.06
Nodes (31): 1. Direct invocation (no orchestration), 2. Single-persona slash command, 3. Parallel fan-out with merge, 4. Sequential pipeline as user-driven slash commands, 5. Research isolation (context preservation), A. Router persona ("meta-orchestrator"), Anti-pattern in this scenario, Anti-patterns (+23 more)

### Community 42 - "Code Review and Quality"
Cohesion: 0.07
Nodes (29): 1. Correctness, 2. Readability & Simplicity, 3. Architecture, 4. Security, 5. Performance, Change Descriptions, Change Sizing, Code Review and Quality (+21 more)

### Community 43 - "AuthProvider.tsx"
Cohesion: 0.23
Nodes (12): RootLayout(), AuthContext, AuthProvider(), AuthValue, friendly(), sessionFromUrl(), clearOffline(), clearAllReminders() (+4 more)

### Community 44 - "placeInfo.ts"
Cohesion: 0.32
Nodes (9): cache, frTitleFromWikidata(), loadPlaceInfo(), PlaceInfo, usePlaceInfo(), wikipediaSummary(), shortExtract(), WikiSource (+1 more)

### Community 45 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, allowImportingTsExtensions, module, moduleResolution, noEmit, skipLibCheck, strict, target (+2 more)

### Community 46 - "supabase.ts"
Cohesion: 0.32
Nodes (6): BUILD_ID, isConfigured, SUPABASE_ANON_KEY, SUPABASE_URL, WEB_URL, react-native-url-polyfill

### Community 47 - "formatTime"
Cohesion: 0.10
Nodes (23): applyPlan(), DayRef, HoursProblem, HoursReport, ProblemKind, slot(), tripHoursProblems(), checkOpening() (+15 more)

### Community 48 - "Test-Driven Development"
Cohesion: 0.07
Nodes (29): Browser Testing with DevTools, Common Rationalizations, DAMP Over DRY in Tests, Decision Guide, Discover the Stack First, Name Tests Descriptively, One Assertion Per Concept, Overview (+21 more)

### Community 49 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, allowImportingTsExtensions, paths, strict, types, extends, include, expo/tsconfig.base

### Community 50 - "Ponytail"
Cohesion: 0.22
Nodes (8): Boundaries, Intensity, Output, Persistence, Ponytail, Rules, The ladder, When NOT to be lazy

### Community 51 - "offline.ts"
Cohesion: 0.46
Nodes (5): loadOffline(), decodeSnapshot(), encodeSnapshot(), FR_MONTHS, Snapshot

### Community 52 - "supabase"
Cohesion: 0.43
Nodes (5): loadCityPlaces(), BY_CATEGORY, estimatePrice(), withEstimatedPrice(), supabase

### Community 53 - "reorder.ts"
Cohesion: 0.31
Nodes (6): ItemMove, MovableItem, moveToIndex(), swapItems(), swapWithNeighbor(), dragMove()

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
Cohesion: 0.39
Nodes (6): load(), buildCategories(), Categories, Category, EMPTY_CATEGORIES, rows

### Community 58 - "Performance Checklist"
Cohesion: 0.07
Nodes (26): API, Backend Checklist, Cache checklist, Caching Strategies, Common Anti-Patterns, Connection pooling, Core Web Vitals Targets, CSS (+18 more)

### Community 59 - "Git Workflow and Versioning"
Cohesion: 0.07
Nodes (26): 1. Commit Early, Commit Often, 2. Atomic Commits, 3. Descriptive Messages, 4. Keep Concerns Separate, 5. Size Your Changes, Branch Naming, Branching Strategy, Change Summaries (+18 more)

### Community 60 - "ponytail-audit/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Hunt, Output, Tags

### Community 61 - "ponytail-review/SKILL.md"
Cohesion: 0.40
Nodes (4): Boundaries, Examples, Format, Scoring

### Community 62 - "devDependencies"
Cohesion: 0.50
Nodes (4): devDependencies, @types/node, @types/react, typescript

### Community 63 - "Optimization Patterns"
Cohesion: 0.07
Nodes (25): Connection Pool Exhaustion, Large Bundle Size, Missing Caching (Backend), Missing Image Optimization (Frontend), N+1 Queries (Backend), Optimization Patterns, Queries That Ignore Their Index, Unbounded Data Fetching (+17 more)

### Community 64 - "ponytail-debt/SKILL.md"
Cohesion: 0.50
Nodes (3): Boundaries, Output, Scan

### Community 65 - "Migrations Supabase (Waypoint)"
Cohesion: 0.50
Nodes (3): Interdits, Migrations Supabase (Waypoint), Étapes

### Community 66 - "Local Storage"
Cohesion: 0.07
Nodes (26): Advanced: Multiple Operations, Authentication State Reuse, Clear All localStorage, Clear sessionStorage, Common Patterns, Delete Database, Delete Single Item, Delete Single Item (+18 more)

### Community 69 - "Shipping and Launch"
Cohesion: 0.08
Nodes (25): Accessibility, Code Quality, Common Rationalizations, Documentation, Error Budget Release Gate, Error Reporting, Feature Flag Strategy, Infrastructure (+17 more)

### Community 70 - "Frontend UI Engineering"
Cohesion: 0.08
Nodes (24): Accessibility (WCAG 2.1 AA), ARIA Labels, Avoid the AI Aesthetic, Color, Common Rationalizations, Component Architecture, Component Patterns, Design System Adherence (+16 more)

### Community 71 - "DesignSystemGenerator"
Cohesion: 0.12
Nodes (3): DesignSystemGenerator, _filter_anti_patterns_for_mode(), _resolve_dial()

### Community 72 - "CI/CD and Automation"
Cohesion: 0.08
Nodes (23): Automation Beyond CI, Basic CI Pipeline, Build Cop Role, CI/CD and Automation, CI Optimization, Common Rationalizations, Dependabot / Renovate, Deployment Strategies (+15 more)

### Community 73 - "Incremental Implementation"
Cohesion: 0.09
Nodes (22): Common Rationalizations, Contract-First Slicing, Implementation Rules, Increment Checklist, Incremental Implementation, Overview, Red Flags, Risk-First Slicing (+14 more)

### Community 74 - "3. Heal"
Cohesion: 0.09
Nodes (23): 0. How generation works, 1.1 Prerequisite: workspace, 1.2 Prerequisite: seed test, 1.3 Explore the app, 1.4 Write the spec file, 1. Planning, 2.1 Inputs, 2.2 Generate one scenario (+15 more)

### Community 75 - "Code Simplification"
Cohesion: 0.09
Nodes (21): 1. Preserve Behavior Exactly, 2. Follow Project Conventions, 3. Prefer Clarity Over Cleverness, 4. Maintain Balance, 5. Scope to What Changed, Code Simplification, Common Rationalizations, Language-Specific Guidance (+13 more)

### Community 76 - "Debugging and Error Recovery"
Cohesion: 0.09
Nodes (21): Build Failure Triage, Common Rationalizations, Debugging and Error Recovery, Error-Specific Patterns, Instrumentation Guidelines, Overview, Red Flags, Runtime Error Triage (+13 more)

### Community 77 - "settings.tsx"
Cohesion: 0.18
Nodes (16): ACCENT_LABELS, ICON_LABELS, MODE_LABELS, ACCENTS, Appearance, DEFAULT_APPEARANCE, ICON_STYLES, IconStyle (+8 more)

### Community 78 - "Browser Session Management"
Cohesion: 0.10
Nodes (20): 1. Name Browser Sessions Semantically, 2. Always Clean Up, 3. Delete Stale Browser Data, A/B Testing Sessions, Attach by channel name, Attach via browser extension, Attach via CDP endpoint, Attaching to a Running Browser (+12 more)

### Community 79 - "Design Audit"
Cohesion: 0.10
Nodes (19): Code Quality, Color and Surfaces, Component Patterns, Content, Design Audit, Fix Priority, How This Works, Iconography (+11 more)

### Community 80 - "Globe.tsx"
Cohesion: 0.19
Nodes (12): globeHtml(), F, FOV_HALF_TAN, ROUTE_BG, routeFrame(), routeGlobeOnScreen(), routeHtml(), routeParam() (+4 more)

### Community 81 - "Interview Me"
Cohesion: 0.11
Nodes (18): Common Rationalizations, Example, Interaction with Other Skills, Interview Me, Loading Constraints, Output, Overview, Red Flags (+10 more)

### Community 82 - "Security Checklist"
Cohesion: 0.11
Nodes (17): AI / LLM Security, Authentication, Authorization, CORS Configuration, Data Protection, Dependency Security, Destructive Path Operations, Error Handling (+9 more)

### Community 83 - "UI/UX Pro Max - Design Intelligence"
Cohesion: 0.11
Nodes (17): Before Delivering App UI, Example Workflow, If a search returns 0 results, Output Formats, Query Contract, Rule Categories by Priority, Running the search tool, Step 1: Analyze User Requirements (+9 more)

### Community 84 - "flights.ts"
Cohesion: 0.21
Nodes (14): bytes(), estimateFlight(), FlightEstimate, FlightLink, flightLinks(), FlightPlan, googleFlightsUrl(), Leg (+6 more)

### Community 85 - "Accessibility Checklist"
Cohesion: 0.12
Nodes (16): Accessibility Checklist, Accessible Lists, ARIA Roles, Buttons vs. Links, Common Anti-Patterns, Common HTML Patterns, Content, Essential Checks (+8 more)

### Community 86 - "CORE DIRECTIVE: AWWWARDS-LEVEL IMAGE ART DIRECTION"
Cohesion: 0.12
Nodes (16): 10. SECTION RHYTHM RULE, 12. DENSITY & SPACING DISCIPLINE, 14. IMAGE / MEDIA DIRECTION, 16. MULTI-IMAGE CONSISTENCY RULE, 17. CLARITY CHECK, 19. RESPONSE BEHAVIOR, 1. ACTIVE BASELINE CONFIGURATION, 21. FINAL GOAL (+8 more)

### Community 87 - "Tracing"
Cohesion: 0.12
Nodes (16): 1. Start Tracing Before the Problem, 2. Clean Up Old Traces, Analyzing Performance, Basic Usage, Best Practices, Capturing Evidence, Debugging Failed Actions, Limitations (+8 more)

### Community 88 - "osm.ts"
Cohesion: 0.17
Nodes (15): address(), CAPS, classify(), closedDaysFromOpeningHours(), DAYS, displayName(), DURATION_ESTIMATE, elementToPlace() (+7 more)

### Community 89 - "StepDeparture.tsx"
Cohesion: 0.26
Nodes (13): cityCoords(), HomeCity, searchHomeCities(), airportNear(), flightMinutes(), airportFor(), FlightsCard(), Home (+5 more)

### Community 90 - "Browser Automation with playwright-cli"
Cohesion: 0.13
Nodes (15): Attaching screenshots and videos to pull requests, Browser Automation with playwright-cli, Browser Sessions, Example: Debugging with DevTools, Example: Form submission, Example: Interactive session, Example: Multi-tab workflow, Installation (+7 more)

### Community 91 - "tasteskill: Anti-Slop Frontend Skill"
Cohesion: 0.13
Nodes (15): 0.A Read these signals first, 0.B Output a one-line "Design Read" before generating, 0. BRIEF INFERENCE (Read the Room Before Anything Else), 0.C If the brief is ambiguous, ask one question, do not guess, 0.D Anti-Default Discipline, 13. OUT OF SCOPE, 14. FINAL PRE-FLIGHT CHECK, 1.A Dial Inference (design read → dial values) (+7 more)

### Community 92 - "Appendix B - Canonical Sources (read these before reinventing)"
Cohesion: 0.13
Nodes (15): Appendix B - Canonical Sources (read these before reinventing), Apple Liquid Glass (Apple platforms only), Atlassian, Bootstrap, Carbon, Fluent UI, GOV.UK, Material Web (+7 more)

### Community 93 - "Settings"
Cohesion: 0.21
Nodes (11): Settings(), changePrefs(), toggleReminders(), NotifPrefs, loadNotifPrefs(), remindersEnabled(), remindersSupported, saveNotifPrefs() (+3 more)

### Community 94 - "data/cityPhoto.ts"
Cohesion: 0.26
Nodes (11): Cached, lookup(), useCityPhotos(), bare(), FoundPhoto, km(), photoFromSummary(), resizeThumb() (+3 more)

### Community 95 - "Testing Patterns Reference (JavaScript/TypeScript)"
Cohesion: 0.14
Nodes (13): API / Integration Testing, Common Assertions, E2E Testing (Playwright), Mock at Boundaries Only, Mock Functions, Mock Modules, Mocking Patterns, React/Component Testing (+5 more)

### Community 96 - "2. THE COMBINATORIAL VARIATION ENGINE"
Cohesion: 0.14
Nodes (14): 2. THE COMBINATORIAL VARIATION ENGINE, Background Character, Background Mode (per-section), Composition Anchor (per-section), CTA Variation, Hero Architecture, Hero Scale (per-page), Motion-Implied Language (+6 more)

### Community 97 - "playwright-cli/SKILL.md"
Cohesion: 0.21
Nodes (4): Examples, Inspecting Element Attributes, Debugging Playwright Tests, Running Playwright Tests

### Community 98 - "Running Custom Playwright Code"
Cohesion: 0.15
Nodes (13): Clipboard, Complex Workflows, Error Handling, File Downloads, Frames and Iframes, Geolocation, JavaScript Execution, Media Emulation (+5 more)

### Community 99 - "Pre-Delivery Checklist (canonical — the only one)"
Cohesion: 0.15
Nodes (12): Accessibility, Common Rules for Professional UI + Pre-Delivery Checklist, Icons & Visual Elements, Interaction, Interaction (App), Layout, Layout & Spacing, Light/Dark Mode (+4 more)

### Community 100 - "Quick Reference"
Cohesion: 0.15
Nodes (12): 10. Charts & Data (LOW), 1. Accessibility (CRITICAL), 2. Touch & Interaction (CRITICAL), 3. Performance (HIGH), 4. Style Selection (HIGH), 5. Layout & Responsive (HIGH), 6. Typography & Color (MEDIUM), 7. Animation (MEDIUM) (+4 more)

### Community 101 - "cityCollect.test.ts"
Cohesion: 0.18
Nodes (9): buildFastQuery(), args, city, diner, geoMuseum, museum, obscure, toPayload() (+1 more)

### Community 102 - "Commands"
Cohesion: 0.17
Nodes (12): Commands, Core, DevTools, Emulation, Keyboard, Mouse, Navigation, Network (+4 more)

### Community 103 - "4. DESIGN ENGINEERING DIRECTIVES (Bias Correction)"
Cohesion: 0.17
Nodes (12): 4.10 Quotes & Testimonials, 4.11 Page Theme Lock (Light / Dark Mode Consistency), 4.1 Typography, 4.2 Color Calibration, 4.3 Layout Diversification, 4.4 Materiality, Shadows, Cards, 4.5 Interactive UI States, 4.6 Data & Form Patterns (+4 more)

### Community 104 - "MapCanvas.tsx"
Cohesion: 0.31
Nodes (6): mapHtml(), MapPoint, safeJson(), MapCanvas(), WebViewView, MapCanvasProps

### Community 105 - "The Standing Checklist"
Cohesion: 0.18
Nodes (10): Correctness, Definition of Done, Definition of Done vs. Acceptance Criteria, Documentation, How to Apply, Integration, Quality, Red Flags (+2 more)

### Community 106 - "Observability Checklist"
Cohesion: 0.18
Nodes (10): Alerting, Dashboards, Distributed Tracing, Metrics, Observability Checklist, On-Call Questions (Start Here), Pre-Launch Gate, Structured Logging (+2 more)

### Community 107 - "rates.ts"
Cohesion: 0.38
Nodes (7): loadCountryCurrency(), loadRates(), useLocalMoney(), buildRateTable(), EMPTY_RATES, RateTable, table

### Community 108 - "22. STYLE VARIATION ENGINE"
Cohesion: 0.20
Nodes (10): 22. STYLE VARIATION ENGINE, Decorative Asset Set, Image Art Direction Bias, Motion-Implied Language, Palette Logic, Signature Component Set, Structure Bias, Texture / Surface Treatment (+2 more)

### Community 109 - "Video Recording"
Cohesion: 0.20
Nodes (10): 1. Use Descriptive Filenames, 2. Record entire hero scripts., 3. Attach the recording to the pull request, Basic Recording, Best Practices, Cursor, Target Highlight and Click Point, Limitations, Overlay API Summary (+2 more)

### Community 110 - "10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know)"
Cohesion: 0.20
Nodes (10): 10. REFERENCE VOCABULARY (Pattern Names the Agent Should Know), Animation Library Choice, Cards & Containers, Galleries & Media, Hero Paradigms, Layout & Grids, Micro-Interactions & Effects, Navigation & Menus (+2 more)

### Community 111 - "ExportCard.tsx"
Cohesion: 0.39
Nodes (6): shareInvite(), ExportCard(), calendar(), share(), downloadTextFile(), shareText()

### Community 112 - "11. COMPONENT EXECUTION GUIDELINES"
Cohesion: 0.22
Nodes (9): 11. COMPONENT EXECUTION GUIDELINES, 3D Cascading Card Deck, Diagonal Staggered Square Masonry, Hover-Accordion Slice Layout, Off-Grid Editorial Layout, Pristine Gapless Bento Grid, Product UI Panel Stack, Turning Polaroid Arc (+1 more)

### Community 113 - "18. EXTRA CREATIVITY & IMPLEMENTATION EDGE"
Cohesion: 0.22
Nodes (9): 18. EXTRA CREATIVITY & IMPLEMENTATION EDGE, Composition variety check, Conversion focus, Cross-section contrast, CTA specificity, Cultural / tonal alignment, Data-viz restraint, Image variety inside one comp (+1 more)

### Community 114 - "Cookies"
Cohesion: 0.22
Nodes (9): Advanced: Multiple Cookies or Custom Options, Clear All Cookies, Cookies, Delete a Cookie, Filter Cookies by Domain, Filter Cookies by Path, Get Specific Cookie, List All Cookies (+1 more)

### Community 115 - "json"
Cohesion: 0.31
Nodes (4): apply_decision_rules(), _object_without_duplicates(), parse_decision_rules(), _validate_action()

### Community 116 - "Waypoint — contexte complet du projet (à jour v1.11.17, 11/10/2026)"
Cohesion: 0.22
Nodes (8): 1. L'utilisateur et la façon de travailler, 2. Produit, 4. Architecture, 5. Lancer en local (PC d'Adrien), 6. Vérifié / non vérifié, 7. Licences, 8. Reste à faire, Waypoint — contexte complet du projet (à jour v1.11.17, 11/10/2026)

### Community 117 - "12. THE COMBINATORIAL VARIATION ENGINE"
Cohesion: 0.25
Nodes (8): 12. THE COMBINATORIAL VARIATION ENGINE, Background Character, Hero Architecture, Motion-Implied Language, Section System, Signature Component Set, Theme Paradigm, Typography Character

### Community 118 - "8. ANTI-AI-SLOP RULES"
Cohesion: 0.25
Nodes (8): 8. ANTI-AI-SLOP RULES, Carousel / marquee slop (layout), Content slop, Data / KPI slop, Density slop, Layout slop, Typography slop, Visual slop

### Community 119 - "Advanced Mocking with run-code"
Cohesion: 0.25
Nodes (8): Advanced Mocking with run-code, CLI Route Commands, Conditional Response Based on Request, Delayed Response, Modify Real Response, Request Mocking, Simulate Network Failures, URL Patterns

### Community 120 - "9. AI TELLS (Forbidden Patterns)"
Cohesion: 0.25
Nodes (8): 9.A Visual & CSS, 9. AI TELLS (Forbidden Patterns), 9.B Typography, 9.C Layout & Spacing, 9.D Content & Data ("Jane Doe" Effect), 9.E External Resources & Components, 9.F Production-Test Tells (banned outright), 9.G EM-DASH BAN (the single most-violated Tell)

### Community 121 - "airports.ts"
Cohesion: 0.43
Nodes (5): listCountryCityPoints(), AIRPORTS, airportCities(), km(), nearest()

### Community 122 - "ShareCard"
Cohesion: 0.43
Nodes (7): createShare(), revokeShare(), ShareCard(), create(), send(), stop(), shareUrl()

### Community 123 - "33. CATEGORY-SPECIFIC BIAS"
Cohesion: 0.29
Nodes (7): 33. CATEGORY-SPECIFIC BIAS, Commerce, Fintech, Health / Fitness, Productivity, Social, Wellness / Lifestyle

### Community 124 - "13. COLOR & MATERIAL RULES"
Cohesion: 0.29
Nodes (7): 13. COLOR & MATERIAL RULES, Background Confidence Rule, Background-image harmony, Gradient Discipline, Materiality, Palette Discipline, Strong guidance

### Community 125 - "4. HERO MINIMALISM RULES"
Cohesion: 0.29
Nodes (7): 4. HERO MINIMALISM RULES, Absolute Hero Rules, Graphic Restraint, Headline Rule, Hero Composition Bias, Pre-output check, Typography Execution

### Community 126 - "APPENDICES - Real Source-Backed Reference Material"
Cohesion: 0.29
Nodes (6): APPENDICES - Real Source-Backed Reference Material, Appendix A - Install Commands per Design System, Appendix C - Apple Liquid Glass: Honest Web Approximation, Safer web approximation skeleton, What is NOT official, What is official

### Community 127 - "11. REDESIGN PROTOCOL"
Cohesion: 0.29
Nodes (7): 11.A Detect the Mode (first action), 11.B Audit Before Touching, 11.C Preservation Rules, 11.D Modernisation Levers (priority order), 11.E Decision Tree: Targeted Evolution vs Full Redesign, 11.F What Never Changes Silently, 11. REDESIGN PROTOCOL

### Community 128 - "3. DEFAULT ARCHITECTURE & CONVENTIONS"
Cohesion: 0.29
Nodes (7): 3.A Stack, 3.B State, 3.C Icons, 3.D Emoji Policy, 3. DEFAULT ARCHITECTURE & CONVENTIONS, 3.E Responsiveness & Layout Mechanics, 3.F Dependency Verification (mandatory)

### Community 129 - "6. PERFORMANCE & ACCESSIBILITY GUARDRAILS"
Cohesion: 0.29
Nodes (7): 6.A Hardware Acceleration, 6.B Reduced Motion (mandatory), 6.C Dark Mode (mandatory for any consumer-facing page), 6.D Core Web Vitals Targets, 6.E DOM Cost, 6.F Z-Index Restraint, 6. PERFORMANCE & ACCESSIBILITY GUARDRAILS

### Community 130 - "29. ANTI-AI-SLOP RULES"
Cohesion: 0.33
Nodes (6): 29. ANTI-AI-SLOP RULES, Content slop, Density slop, Layout slop, Typography slop, Visual slop

### Community 131 - "5. IMAGE COUNT & PAGE SLICING"
Cohesion: 0.33
Nodes (6): 5. IMAGE COUNT & PAGE SLICING, Continuity Rule, Counting rule, Format, Section size variety, THIS IS THE PRIMARY OUTPUT RULE

### Community 132 - "_resolve_color_mode"
Cohesion: 0.33
Nodes (3): _query_wants_dark(), _resolve_color_mode(), _style_is_dark_primary()

### Community 133 - "21. MOBILE ANTI-AI-TELLS RULE"
Cohesion: 0.40
Nodes (5): 21. MOBILE ANTI-AI-TELLS RULE, Copy AI tells, Layout AI tells, UI clutter tells, Visual AI tells

### Community 134 - "Attaching Screenshots and Videos to Pull Requests"
Cohesion: 0.40
Nodes (5): Attaching Screenshots and Videos to Pull Requests, From a local session, From CI, Limits, When to attach

### Community 135 - "12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)"
Cohesion: 0.40
Nodes (5): 12.A File Location, 12.B Required Frontmatter, 12.C Required Body Sections, 12.D Block-Library Discipline, 12. THE BLOCK LIBRARY (Contract - Implementations Land Here Iteratively)

### Community 136 - "5. CONTEXT-AWARE PROACTIVITY"
Cohesion: 0.40
Nodes (5): 5.A Sticky-Stack - Canonical Skeleton, 5.B Horizontal-Pan - Canonical Skeleton, 5.C Scroll-Reveal Stagger - Canonical Skeleton (lighter alternative), 5. CONTEXT-AWARE PROACTIVITY, 5.D Forbidden Animation Patterns

### Community 137 - "8. DARK MODE PROTOCOL"
Cohesion: 0.40
Nodes (5): 8.A Token Strategy (pick one, stick to it), 8.B Do Not Prescribe Specific Colors Here, 8.C Default Mode, 8.D Test in Both Modes Before Finishing, 8. DARK MODE PROTOCOL

### Community 138 - "33. DEFAULT SECTION PACKS"
Cohesion: 0.50
Nodes (4): 12-section pack, 33. DEFAULT SECTION PACKS, 4-section pack, 8-section pack

### Community 139 - "14. HERO MINIMALISM RULES"
Cohesion: 0.50
Nodes (4): 14. HERO MINIMALISM RULES, Absolute Hero Rules, Headline Rule, Hero Cleanliness Rule

### Community 140 - "37. EXAMPLE INTERPRETATIONS"
Cohesion: 0.50
Nodes (4): 37. EXAMPLE INTERPRETATIONS, Example 1, Example 2, Example 3

### Community 141 - "2. PLATFORM MODE RULE"
Cohesion: 0.50
Nodes (4): 2. PLATFORM MODE RULE, Android-native premium, Cross-platform premium neutral, iOS-native premium

### Community 142 - "37. EXAMPLE INTERPRETATIONS"
Cohesion: 0.50
Nodes (4): 37. EXAMPLE INTERPRETATIONS, Example 1, Example 2, Example 3

### Community 143 - "15. DEFAULT SITE PACKS"
Cohesion: 0.50
Nodes (4): 12-section pack, 15. DEFAULT SITE PACKS, 4-section pack, 8-section pack

### Community 144 - "20. EXAMPLE INTERPRETATIONS"
Cohesion: 0.50
Nodes (4): 20. EXAMPLE INTERPRETATIONS, Example 1, Example 2, Example 3

### Community 145 - "7. DIAL DEFINITIONS (Technical Reference)"
Cohesion: 0.50
Nodes (4): 7. DIAL DEFINITIONS (Technical Reference), DESIGN_VARIANCE (Level 1-10), MOTION_INTENSITY (Level 1-10), VISUAL_DENSITY (Level 1-10)

## Knowledge Gaps
- **9 isolated node(s):** `expo`, `expo-constants`, `react-dom`, `react-native-screens`, `react-native-web` (+4 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1419 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Transports et trafic : où on en est` connect `budget.ts` to `cityCollection.ts`, `ref_node_assert`, `Waypoint · backend, collecte de données et application Expo`, `trip/[id].tsx`, `wizard.ts`, `Button`, `core.py`, `useTrip.ts`, `Globe.tsx`, `passes.test.mjs`, `DayCard`, `reorder.ts`, `airports.ts`, `Settings`, `domain/itinerary.ts`, `useTheme`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **What connects `expo`, `expo-constants`, `react-dom` to the rest of the system?**
  _9 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `domain/reminders.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
- **Should `cityCollect.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10507246376811594 - nodes in this community are weakly interconnected._
- **Should `budget.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12698412698412698 - nodes in this community are weakly interconnected._
- **Should `domain/weather.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07716701902748414 - nodes in this community are weakly interconnected._
- **Should `Waypoint · backend, collecte de données et application Expo` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._