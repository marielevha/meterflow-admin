# TailAdmin Next.js - Free Next.js Tailwind Admin Dashboard Template

TailAdmin is a free and open-source admin dashboard template built on **Next.js and Tailwind CSS** providing developers with everything they need to create a feature-rich and data-driven: back-end, dashboard, or admin panel solution for any sort of web project.

![TailAdmin - Next.js Dashboard Preview](./banner.png)

With TailAdmin Next.js, you get access to all the necessary dashboard UI components, elements, and pages required to build a high-quality and complete dashboard or admin panel. Whether you're building a dashboard or admin panel for a complex web application or a simple website.

TailAdmin utilizes the powerful features of **Next.js 16** and common features of Next.js such as server-side rendering (SSR), static site generation (SSG), and seamless API route integration. Combined with the advancements of **React 19** and the robustness of **TypeScript**, TailAdmin is the perfect solution to help get your project up and running quickly.

## MeterFlow - Implementations Realisees

Ce repository a ete adapte pour le projet **MeterFlow** (plateforme digitale de gestion des releves de compteurs electriques).

### 1) Base de donnees et Prisma

- Schema Prisma complet pour les entites metier:
  - `users`, `roles`, `permissions`, `user_roles`, `role_permissions`
  - `meters`, `meter_states`
  - `readings`, `reading_events`
  - `tasks`, `task_items`, `task_comments`, `task_attachments`
  - `auth_sessions`, `otp_codes`
- UUID comme identifiants par defaut.
- Colonnes de tracabilite sur les tables metier:
  - `created_at`, `updated_at`, `deleted_at` (soft delete)
- `users.activated_at` ajoute pour tracer la date d'activation de compte.
- Migrations Prisma ajoutees pour RBAC, auth, activation OTP et evolutions du modele.

### 2) RBAC (roles/permissions)

- Roles metier: `CLIENT`, `AGENT`, `SUPERVISOR`, `ADMIN`.
- Mapping roles/permissions via tables dediees.
- Controle d'acces applique dans les endpoints sensibles (mobile client vs staff/admin).

### 3) Authentification Web et Mobile

- Web staff:
  - `POST /api/v1/auth/login` (identifiant: `username` ou `email`)
  - autorise seulement `AGENT`, `SUPERVISOR`, `ADMIN`
  - `POST /api/v1/auth/logout`
- Mobile:
  - `POST /api/v1/mobile/auth/login` (identifiant: `phone` ou `username` ou `email`)
  - `POST /api/v1/mobile/auth/refresh` (rotation refresh/access token, evite relogin force)
  - `POST /api/v1/mobile/auth/signup` (creation `CLIENT` en statut `PENDING`)
  - `POST /api/v1/mobile/auth/activate` (OTP -> compte `ACTIVE` + `activated_at`)
  - `POST /api/v1/mobile/auth/resend-otp`
  - `POST /api/v1/mobile/auth/forgot-password/request`
  - `POST /api/v1/mobile/auth/forgot-password/confirm`
- Protection d'acces dashboard:
  - routes `/admin/**` protegees
  - utilisateur non connecte redirige vers `/signin`

### 4) API mobile - compte client

- `GET /api/v1/mobile/me`
- `PATCH /api/v1/mobile/me`
- `PATCH /api/v1/mobile/me/password`

### 5) API mobile - compteurs client

- `GET /api/v1/mobile/meters`
- `GET /api/v1/mobile/meters/:meterId`
- `GET /api/v1/mobile/meters/:meterId/states`

### 6) API mobile - releves (coeur metier)

- `POST /api/v1/mobile/readings`
- `GET /api/v1/mobile/readings`
- `GET /api/v1/mobile/readings/:readingId`
- `POST /api/v1/mobile/readings/:readingId/resubmit`
- Generation d'evenements d'audit (`reading_events`) sur les transitions clefs.

### 7) API mobile - upload fichiers (S3/MinIO)

- `POST /api/v1/mobile/uploads/presign`
- `POST /api/v1/mobile/uploads/complete`
- Flow supporte:
  1. Demande URL signee
  2. Upload direct objet vers bucket
  3. Confirmation metadata (hash/taille/mime)
- Dependances ajoutees:
  - `@aws-sdk/client-s3`
  - `@aws-sdk/s3-request-presigner`

### 8) API backoffice - traitement des releves

- `GET /api/v1/readings/pending`
- `POST /api/v1/readings/:id/validate`
- `POST /api/v1/readings/:id/flag`
- `POST /api/v1/readings/:id/reject`
- `POST /api/v1/readings/:id/tasks`

### 9) API backoffice - taches terrain

- `GET /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `PATCH /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/comments`
- `POST /api/v1/tasks/:id/attachments`

### 10) API audit + anti-fraude MVP

- `POST /api/v1/readings/:id/checks` (coherence index + distance GPS)
- `GET /api/v1/readings/:id/events`
- `GET /api/v1/alerts`

### 11) API dashboard admin

- `GET /api/v1/dashboard/kpis`
- `GET /api/v1/dashboard/top-agents`
- `GET /api/v1/dashboard/suspicions/gps`
- Acces reserve au role `ADMIN`.

### 12) Seeds et outils de test

- Seeds users (profils differents, contexte Congo-Brazzaville / Senegal-Dakar).
- Seeds coherents `meters` + `meter_states`.
- Mot de passe demo des seeds: `ChangeMe@123`.
- Script d'integration API:
  - `scripts/mobile_reading_flow.sh`

### 13) Application mobile React Native (Expo)

- Workspace mobile initialise dans `mobileapp/meterflow`.
- Routing Expo Router structure autour de:
  - splash
  - onboarding
  - auth
  - tabs client
  - pages de detail
- Theming mobile:
  - mode clair / sombre / systeme
  - preference persistante cote mobile
- Splash branding:
  - ecran type fintech avec logo mobile dedie
- Onboarding:
  - parcours en 4 ecrans
  - memorisation locale pour ne plus le rejouer apres completion

### 14) Auth mobile - UX et session

- Ecrans dedies:
  - `login`
  - `register`
  - `forgot-password`
  - `reset-password`
  - `verify-otp`
- Login mobile connecte au backend:
  - `POST /api/v1/mobile/auth/login`
- Session mobile:
  - access token + refresh token stockes localement
  - restauration automatique au lancement
  - refresh automatique via `POST /api/v1/mobile/auth/refresh`
- Toggle mot de passe visible/masque sur les formulaires sensibles.

### 15) Navigation mobile et preferences locales

- Drawer mobile avec pages:
  - `Accueil`
  - `Notifications`
  - `Mes compteurs`
  - `Profil`
  - `Parametres`
  - `A propos`
- Topbar fixe unifiee:
  - mode `menu` sur les ecrans racine
  - mode `back` sur les ecrans de detail
- Preferences utilisateur locales:
  - theme
  - rester connecte
  - afficher / masquer l'aide camera
  - revoir l'onboarding

### 16) App mobile - ecrans client branches au backend

- `Historique` branche sur:
  - `GET /api/v1/mobile/readings`
- Detail d'un releve branche sur:
  - `GET /api/v1/mobile/readings/:readingId`
- `Mes compteurs` branche sur:
  - `GET /api/v1/mobile/meters`
- Detail d'un compteur branche sur:
  - `GET /api/v1/mobile/meters/:meterId`

### 17) App mobile - parcours de soumission d'un releve

- Ecran `Releves` en mode camera plein ecran.
- Capture photo en premier, puis:
  - recuperation GPS (`lat`, `lng`, precision)
  - preview photo minimaliste
  - choix du compteur
  - saisie index principal / secondaire
  - soumission finale au backend
- Upload photo mobile branche sur le flow backend:
  1. `POST /api/v1/mobile/uploads/presign`
  2. upload direct objet vers MinIO/S3
  3. `POST /api/v1/mobile/uploads/complete`
  4. `POST /api/v1/mobile/readings`

### 18) Correctifs stockage S3 / MinIO pour le mobile

- Ajout de la notion d'endpoint public de stockage:
  - `S3_PUBLIC_ENDPOINT`
  - `STORAGE_PUBLIC_BASE_URL`
- Correction de generation des URLs signees pour eviter les URLs `localhost` non utilisables depuis le mobile.
- Ajustement upload mobile pour compatibilite MinIO:
  - suppression des headers non signes
  - upload binaire via `expo-file-system`
- Endpoint securise pour afficher l'image d'un releve:
  - `GET /api/v1/mobile/readings/:readingId/image`
  - utile quand l'objet n'est pas expose publiquement par MinIO.
  - enchaine login -> presign -> upload -> complete -> reading.

### 13) Dashboard users + RBAC (admin)

- Menu dashboard:
  - `User management`
  - `Users`
  - `Rules & Permissions`
- Pages users:
  - `/admin/users` (liste, KPIs, recherche/filtres auto, pagination, actions)
  - `/admin/users/:id` (detail utilisateur)
  - `/admin/users/:id/edit` (edition profil + affectation multi-roles)
- Pages RBAC:
  - `/admin/rules-permissions` (roles + permission matrix, filtres auto, pagination dediee par tableau)
  - `/admin/rules-permissions/roles/:id` (gestion des permissions d'un role via checkboxes)
- Endpoints RBAC admin:
  - `GET /api/v1/roles/:id/permissions`
  - `PATCH /api/v1/roles/:id/permissions` (sync des permissions du role)
  - `GET /api/v1/users/:id/roles`
  - `PATCH /api/v1/users/:id/roles` (sync des roles du user)
- Service metier partage:
  - `src/lib/backoffice/rbac.ts`
  - `syncRolePermissions`
  - `syncUserRoles`

### 14) Import users (Excel-compatible)

- Page `/admin/users`:
  - bouton `Import users`
  - modal d'import avec verification automatique a la selection du fichier
  - previsualisation des lignes valides/invalides avant import
  - import final des lignes valides vers la base
- Template pret a remplir:
  - telechargement via `GET /api/v1/users/import/template`
  - format CSV compatible Excel (ouvrable/modifiable dans Excel)
- API import:
  - `POST /api/v1/users/import/preview` (verification coherence + dedoublonnage + preview)
  - `POST /api/v1/users/import/commit` (creation users + affectation roles)
- Service metier import:
  - `src/lib/backoffice/usersImport.ts`
  - `previewUsersImportFromCsv`
  - `importUsersRows`

### 15) Operations dashboard (meters/readings/history/consumption)

- Nouveau bloc menu `Operations` avec sous-options:
  - `Meters`
  - `Add meter`
  - `Readings`
  - `History`
  - `Consumption`
- Meters:
  - `/admin/meters` avec colonne `Actions` (icones `view` et `edit`)
  - `/admin/meters/:id` page detail compteur (identite, affectations, localisation, derniers states/readings)
  - `/admin/meters/:id/edit` page edition complete
  - `/admin/meters/create` page creation complete
  - `Customer` et `Assigned agent` en select searchable (recherche nom/telephone + selection par id)
- History:
  - `/admin/history` avec filtres + pagination distincts par tableau
  - `Meter states history`: recherche serial, filtre source (`with/without`), per-page, pagination
  - `Reading events audit trail`: recherche serial/acteur/phone, filtre type event, per-page, pagination
- Consumption:
  - `/admin/consumption` section `Consumption by meter` amelioree
  - filtres auto-appliques (recherche, ville, zone)
  - pagination + per-page en bas du tableau
- UX sidebar:
  - correction de l'etat actif pour eviter double activation (`/admin/meters` et `/admin/meters/create`).

### 16) Dashboard Overview (pilotage activite)

- Menu `Dashboard` enrichi:
  - `Ecommerce`
  - `Overview` (`/admin/overview`)
- Page `Overview` connectee a la base Prisma avec un dashboard orienté pilotage:
  - cards KPI en tete avec style modernise (icone + valeur + variation)
  - graphique Apex `Taux de validation des releves` avec switch:
    - `Monthly` (journalier sur 30 jours)
    - `Quarterly` (hebdo sur 12 semaines)
    - `Annual` (mensuel sur 12 mois)
  - bloc charts multi-KPI (Apex):
    - tendance activite releves (total/pending/validated/flagged/rejected)
    - mix des statuts releves (donut)
    - distribution des users par role (donut)
    - taches par statut (bar)
    - top agents (bar horizontal)
    - zones a risque (bar %)
  - bloc `KPIs operationnels` en bas de page avec formats varies:
    - Delai moyen de traitement (`reading_at` -> `reviewed_at`)
    - Backlog des releves en attente (`PENDING`)
    - Taux d'anomalies/suspicions (`flagged + rejected + GPS suspect`) / total soumis
    - Volume de releves soumis
    - switch commun `Monthly / Quarterly / Annual`
  - tables operationnelles:
    - `Recent readings`
    - `Recent tasks`
- Robustesse / correctifs runtime:
  - suppression des doublons de declarations de variables (build error)
  - correction des acces potentiellement `undefined` (`meter`, `gpsDistanceMeters`)
  - conversion numerique defensive sur les valeurs decimales Prisma

### 17) Settings centralises (DB + API + UI)

- Ajout d'une table de configuration applicative:
  - `app_settings` (Prisma model: `AppSetting`)
  - colonnes: `id`, `key`, `value(JSON)`, `created_at`, `updated_at`, `deleted_at`
  - migration SQL ajoutee: `20260222121500_add_app_settings`
- Nouveau service serveur:
  - `src/lib/settings/serverSettings.ts`
  - `getAppSettings()` pour lecture avec fallback sur defaults
  - `saveAppSettings()` pour merge + upsert en base
- Normalisation stricte des settings:
  - `src/lib/settings/appSettings.ts`
  - `normalizeAppSettings()` pour typer/sanitzer les valeurs JSON
- API backoffice des settings:
  - `GET /api/v1/settings` (staff connecte)
  - `PATCH /api/v1/settings` (ADMIN uniquement)
- Page `/admin/settings` branchee sur la base:
  - chargement initial server-side des valeurs
  - sauvegarde via API (plus de persistance locale uniquement)
- Page `/admin/overview` branchee sur les settings DB:
  - affichage/masquage des graphiques selon les cases cochees dans settings
  - seuil GPS anti-fraude utilise depuis `maxGpsDistanceMeters` configure en settings

### 18) Module billing complet (campagnes, tarifs, factures)

- Nouveau bloc menu `Billing` avec sous-pages:
  - `/admin/billing`
  - `/admin/billing/tariffs`
  - `/admin/billing/campaigns`
  - `/admin/billing/invoices`
  - `/admin/billing/invoices/:id`
- Backend billing:
  - service metier `src/lib/backoffice/billing.ts`
  - server actions billing `src/app/(admin)/admin/billing/actions.ts`
  - APIs REST:
    - `GET/POST /api/v1/billing/tariffs`
    - `PATCH /api/v1/billing/tariffs/:id`
    - `GET/POST /api/v1/billing/campaigns`
    - `POST /api/v1/billing/campaigns/:id/generate`
    - `POST /api/v1/billing/campaigns/:id/issue`
    - `GET /api/v1/billing/invoices`
    - `GET /api/v1/billing/invoices/:id`
    - `POST /api/v1/billing/invoices/:id/issue`
    - `POST /api/v1/billing/invoices/:id/deliveries`
    - `POST /api/v1/billing/invoices/:id/payments`
    - `POST /api/v1/billing/invoices/:id/cancel`
- Modele billing Prisma (migrations inclues):
  - `billing_campaigns`, `tariff_plans`, `tariff_tiers`, `invoices`, `invoice_lines`, `invoice_events`, `invoice_deliveries`, `payments`
  - robustesse cycle: references `fromReadingId` / `toReadingId` + indexes source/cible et finalisation de cycle
  - garde-fou: unicite facture par compteur et campagne (`@@unique([campaignId, meterId])`)

### 19) Rappels automatiques de releve (cron + WhatsApp/Email/Push)

- Fenetre de releve configurable dans settings:
  - `readingWindowStartDay`, `readingWindowEndDay`, `readingReminderHour`, `readingReminderTimezone`, `readingReminderCadence`
  - cadence `DAILY`, `EVERY_2_DAYS`, `EVERY_3_DAYS`
- Limites anti-spam configurees:
  - `readingReminderMinIntervalHours`
  - `readingReminderMaxPerWindow`
- Canaux configurables:
  - `readingReminderUseWhatsapp`, `readingReminderUseEmail`, `readingReminderUsePush`
  - `whatsappNotificationsEnabled`, `emailNotificationsEnabled`, `pushNotificationsEnabled`
- Provider email API configurable depuis settings:
  - `emailApiProvider`: `RESEND` ou `MAILTRAP`
  - UI settings mise a jour en radio boutons (Resend/Mailtrap)
- Compatibilite retroactive settings:
  - fallback auto des anciennes cles `readingReminderUseSms` et `smsNotificationsEnabled`
- Nouveau job metier:
  - `src/lib/reminders/readingReminders.ts`
  - calcule clients eligibles (CLIENT actifs avec compteurs actifs non releves dans la fenetre)
  - envoi + journalisation dans `reading_reminder_logs`
- Endpoint cron securise:
  - `POST /api/v1/cron/reading-reminders`
  - auth via `x-cron-secret` ou `Authorization: Bearer <CRON_SECRET>`
  - body optionnel: `{ "force": true, "runAt": "ISO_DATE" }`
- Envoi WhatsApp Twilio:
  - canal Twilio Messages avec prefixe `whatsapp:`
  - variables `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- Envoi Email/Push:
  - email via Resend ou Mailtrap (`RESEND_API_KEY` ou `MAILTRAP_API_KEY`, plus `REMINDER_EMAIL_FROM`)
  - push via webhook (`REMINDER_PUSH_WEBHOOK_URL`)

### 20) Module Tasks management + refonte Readings (admin)

- Tasks management (backoffice):
  - bloc menu dedie `Tasks management` (avec icone metier) dans la sidebar
  - pages:
    - `/admin/tasks` (liste, KPIs, filtres auto, pagination)
    - `/admin/tasks/create` (creation)
    - `/admin/tasks/:id` (detail complet: statut rapide, checklist, commentaires, pieces jointes, timeline)
    - `/admin/tasks/:id/edit` (edition orientee workflow)
  - APIs completees:
    - `GET/POST /api/v1/tasks`
    - `GET/PATCH /api/v1/tasks/:id`
    - `GET /api/v1/tasks/stats`
    - `POST /api/v1/tasks/:id/comments`
    - `POST /api/v1/tasks/:id/attachments`
    - `POST /api/v1/tasks/:id/items`
    - `PATCH /api/v1/tasks/:id/items/:itemId`
  - audit: ecriture d'evenements `reading_events` quand une tache liee a un releve est modifiee.

- Readings admin UX:
  - `/admin/readings` refait avec:
    - recherche + filtres (status/date) auto-appliques (sans bouton Apply)
    - pagination + per-page
    - colonne `Actions` en icones `voir` / `editer`
  - nouvelles pages:
    - `/admin/readings/:id` (detail complet du releve: preuve image, acteurs, compteur, taches liees, audit trail)
    - `/admin/readings/:id/edit` (edition releve + journalisation d'audit)
  - audit trail du detail releve:
    - remplacement du JSON brut par une presentation lisible (cle/valeur formatee pour utilisateur final).

### 21) P0/P1/P2 robustesse, observabilite et exploitation

- Stabilite navigation/sidebar:
  - correction d'un risque de boucle de rendu dans `AppSidebar` (gestion d'ouverture des sous-menus, etat actif par chemin le plus specifique).
  - activation du sous-menu coherent sur les pages detail/edit (users/meters/readings/tasks).

- Renforcement workflows metier:
  - machine d'etats centralisee pour transitions (`src/lib/workflows/stateMachines.ts`).
  - garde-fous sur transitions Tasks/Readings pour limiter les regressions de statut.
  - audit harmonise sur modifications manuelles.

- Observabilite API:
  - wrapper d'instrumentation `withRouteInstrumentation`:
    - generation/propagation `x-request-id`
    - mesure de latence
    - logs de succes/erreur standardises.
  - integration sur endpoints critiques auth/readings/tasks/dashboard/billing.

- Logging serveur avec rotation type rolling files:
  - logger JSON structure (`src/lib/observability/logger.ts`)
  - ecriture disque:
    - `logs/application.log`
    - `logs/error.log`
  - rotation par taille + retention fichiers archives (`.1`, `.2`, ...).
  - variables de config:
    - `LOG_DIR`
    - `LOG_MAX_FILE_SIZE_MB`
    - `LOG_MAX_FILES`
    - `LOG_LEVEL`
    - `LOG_TO_CONSOLE`

- Exploitation / readiness:
  - endpoint health:
    - `GET /api/health` (etat app + connectivite DB, `ok`/`degraded`).
  - smoke checks P2:
    - script `scripts/p2_smoke_checks.sh`
    - commande `npm run smoke:p2`
    - verification rapide: health -> login -> endpoint protege + presence `x-request-id`.

- Scalabilite requetes admin:
  - extraction de la logique Overview vers un service dedie `src/lib/backoffice/overview.ts`.
  - cache serveur (`unstable_cache`, revalidate 60s) pour reduire la charge SQL.
  - indexes Prisma/SQL ajoutes:
    - `meter_states(deleted_at, effective_at)`
    - `readings(deleted_at, created_at)`
    - `readings(deleted_at, status, created_at)`
    - `reading_events(deleted_at, created_at)`
    - `tasks(deleted_at, created_at)`
  - migration: `prisma/migrations/20260224164000_add_perf_indexes`.

- Branding applicatif centralise:
  - suppression de l'usage hardcode du nom produit dans les rappels.
  - les messages reminders utilisent maintenant `settings.companyName` (DB settings) comme source unique.
  - les titres de pages utilisent maintenant `companyName` via le layout global Next.js (`generateMetadata`) au lieu d'un suffixe `MeterFlow` hardcode.

### 22) Correctifs billing et resilience overview

- Diagnostic billing plus precis:
  - remplacement du message generique "module non initialise" par une analyse d'erreur Prisma plus utile.
  - distinction entre:
    - tables manquantes
    - colonnes manquantes / schema mismatch
    - probleme de connexion Prisma
    - erreur inattendue
  - fichiers:
    - `src/lib/backoffice/billingPageErrors.ts`
    - `src/components/billing/BillingSchemaNotice.tsx`

- Reparation de drift du schema billing:
  - ajout d'une migration corrective idempotente:
    - `prisma/migrations/20260315120000_repair_billing_schema_alignment`
  - couvre les colonnes manquantes frequentes sur:
    - `billing_campaigns`
    - `invoices`
  - inclut aussi indexes/FK pour les champs de cycle strict (`from_reading_id`, `to_reading_id`).

- Tolerance partielle des pages billing aux schemas incomplets:
  - la page `/admin/billing/campaigns` ne charge plus implicitement toutes les colonnes de `billing_campaigns`.
  - selection Prisma reduite aux champs reellement affiches pour eviter qu'une colonne non utilisee fasse tomber toute la liste.
  - meme logique appliquee au service partage `listBillingCampaigns`.

- Robustesse runtime de l'overview:
  - correction de `formatDate()` pour accepter `Date | string | null`.
  - evite le crash `value.toISOString is not a function` lorsque les dates reviennent serializees depuis le cache serveur.

### 23) Mobile - consommation, upload simplifie et navigation unifiee

- Simplification du stockage photo cote mobile:
  - nouveau endpoint direct `POST /api/v1/mobile/uploads`
  - le mobile envoie maintenant l'image au backend en `multipart/form-data`
  - le serveur se charge du stockage MinIO/S3 et renvoie les metadonnees du fichier
  - les anciens endpoints `presign/complete` restent disponibles, mais le flux mobile privilegie maintenant l'upload backend direct

- Affichage securise des images de releve:
  - mobile:
    - `GET /api/v1/mobile/readings/:readingId/image`
  - admin:
    - `GET /api/v1/readings/:id/image`
  - les vues mobile/admin n'ont plus besoin d'un objet MinIO publiquement lisible pour afficher la photo

- GPS et anti-fraude harmonises:
  - calcul de distance GPS cote mobile pour l'alerte UX lors de la soumission
  - calcul officiel de `gpsDistanceMeters` cote backend a la creation du releve
  - seuil GPS centralise dans les settings applicatifs (`maxGpsDistanceMeters`)
  - exposition mobile en lecture via `GET /api/v1/mobile/app-config`
  - affichage de l'ecart GPS dans:
    - le detail releve mobile
    - le detail releve admin
    - la page mobile `Parametres` (info utilisateur)

- Navigation mobile consolidee:
  - stabilisation du drawer mobile (reset propre apres changement de route / logout / login)
  - topbar fixe homogene sur les ecrans applicatifs, bouton retour sur les ecrans detail
  - ajout des pages drawer:
    - `Notifications`
    - `A propos`
    - `Profil`
    - `Parametres`
    - `Releves` (historique de soumission)
  - reorganisation des tabs:
    - `Accueil`
    - `Releves` (camera / soumission)
    - `Consommation`

- API mobile consommation:
  - `GET /api/v1/mobile/consumption`
    - historique mensuel agrege par compteur a partir des `meter_states`
  - `GET /api/v1/mobile/consumption/:meterId?periodKey=YYYY-MM`
    - detail d'une periode avec les etats utilises pour le calcul

- UX mobile consommation:
  - nouvelle page tab `Consommation`
  - nouvelle page de detail de consommation par compteur/periode
  - l'ancienne page `Historique` devient `Releves` via `readings-history`
  - l'accueil affiche maintenant les dernieres consommations du compteur courant du carousel, plutot que les derniers releves
  - pour les compteurs double index, l'accueil affiche directement la consommation totale en kWh

- Composant de chargement partage:
  - ajout de `mobileapp/meterflow/components/app/circular-loading.tsx`
  - reutilise sur:
    - accueil
    - historique des releves
    - consommation
    - liste/detail compteurs
    - detail releve
    - etapes utiles du parcours de soumission

### 24) Revue admin des releves, notifications client et fondations push

- Revue admin plus rigoureuse des releves:
  - motifs normalises de signalement/rejet (`flagReason`, `rejectionReason`)
  - champ motif obligatoire lorsque l'agent choisit `FLAGGED` ou `REJECTED`
  - catalogues partages de motifs et messages client dans:
    - `src/lib/readings/reviewReasons.ts`
    - `mobileapp/meterflow/lib/readings/review-reasons.ts`

- Detail et edition admin des releves:
  - la page d'edition remplace les champs libres par des listes de motifs controlees
  - la page detail admin affiche des libelles lisibles plutot que les codes internes
  - les editions manuelles admin generent aussi des evenements metier de decision, pas seulement un audit technique

- Notifications client in-app:
  - nouvelle API mobile:
    - `GET /api/v1/mobile/notifications`
  - implementation basee sur `reading_events` pour eviter d'ajouter une table de notifications dediee trop tot
  - la page mobile `Notifications` affiche maintenant:
    - les validations
    - les signalements
    - les rejets
    - avec titre, message metier, compteur concerne et lien vers le detail releve
  - le detail releve mobile affiche une carte `Decision agent` avec un message plus clair pour le client

- Fondations des notifications push mobiles:
  - ajout de `expo-notifications` dans l'app mobile
  - ajout du modele Prisma `MobilePushDevice`
  - endpoints mobiles:
    - `POST /api/v1/mobile/push/register`
    - `POST /api/v1/mobile/push/unregister`
  - service backend d'envoi Expo Push:
    - `src/lib/notifications/expoPush.ts`
  - envoi push declenche lors des transitions:
    - validation
    - signalement
    - rejet
  - le flux push est implemente en mode `best effort`:
    - un echec du service push ne doit jamais casser la decision agent

- Limite actuelle de test:
  - les push distantes Expo ne sont pas considerees comme valides de bout en bout dans `Expo Go`
  - il faut un `development build` sur vrai appareil pour verifier correctement les push natives
  - en attendant, le centre de notifications in-app reste la source fiable cote client

### 25) Stabilisation MVP mobile, profil complet et internationalisation

- Stabilisation du workflow mobile de releve:
  - anti double action sur les soumissions critiques
  - messages d'erreur/succes homogenises cote mobile
  - meilleure robustesse camera / GPS avant envoi
  - resoumission plus fluide apres rejet avec navigation et etats mieux geres
  - actualisation plus intelligente des ecrans apres action metier:
    - accueil
    - releves
    - consommation
    - notifications

- Notifications in-app consolidees:
  - badge non lu dans la topbar et le drawer
  - marquage fin comme lu a l'ouverture du detail du releve
  - bouton `Tout marquer comme lu`
  - pagination par curseur sur `GET /api/v1/mobile/notifications`
  - composant d'etat partage pour les cas vides / erreurs:
    - `mobileapp/meterflow/components/app/app-state-card.tsx`

- Page `Profil` transformee en vrai ecran compte client:
  - chargement des vraies donnees via `GET /api/v1/mobile/me`
  - edition des informations personnelles (`firstName`, `lastName`, `region`, `city`, `zone`)
  - resume compte simplifie (`Compteurs`, `Releves`)
  - section securite avec changement de mot de passe
  - support backend:
    - `PATCH /api/v1/mobile/me`
    - `PATCH /api/v1/mobile/me/password`
  - deconnexion forcee apres changement de mot de passe, conformement a l'invalidation des sessions cote serveur

- Navigation mobile plus propre:
  - prevention de l'empilement des pages identiques (`safePush`)
  - topbar partage simplifie:
    - un seul titre visible
    - bouton menu ou retour selon le contexte
  - drawer stabilise sur login/logout et changements de route

- Internationalisation mobile:
  - infrastructure i18n legere ajoutee:
    - `mobileapp/meterflow/lib/i18n/translations.ts`
    - `mobileapp/meterflow/hooks/use-i18n.ts`
  - preference de langue persistante dans `app-preferences`
  - choix de langue dans la page `Parametres`
  - langues actuellement supportees:
    - francais (`fr`)
    - anglais (`en`)
    - lingala (`ln`)
  - couverture i18n deja branchee sur les principaux ecrans clients:
    - accueil
    - notifications
    - profil
    - compteurs
    - consommation
    - a propos
    - drawer / tabs / parametres

- Cloisonnement des roles cote mobile:
  - l'app mobile client est maintenant reservee aux profils `CLIENT`
  - verrou applique sur:
    - `POST /api/v1/mobile/auth/login`
    - `POST /api/v1/mobile/auth/refresh`
  - les profils `AGENT`, `SUPERVISOR` et `ADMIN` ne peuvent plus ouvrir de session dans cette app
  - cette separation prepare la future app mobile dediee aux agents sans dupliquer tout le backend


## Overview

TailAdmin provides essential UI components and layouts for building feature-rich, data-driven admin dashboards and control panels. It's built on:

* Next.js 16.x
* React 19
* TypeScript
* Tailwind CSS V4

### Quick Links

* [✨ Visit Website](https://tailadmin.com)
* [📄 Documentation](https://tailadmin.com/docs)
* [⬇️ Download](https://tailadmin.com/download)
* [🖌️ Figma Design File (Community Edition)](https://www.figma.com/community/file/1463141366275764364)
* [⚡ Get PRO Version](https://tailadmin.com/pricing)

### Demos

* [Free Version](https://nextjs-free-demo.tailadmin.com)
* [Pro Version](https://nextjs-demo.tailadmin.com)

### Other Versions

- [Next.js Version](https://github.com/TailAdmin/free-nextjs-admin-dashboard)
- [React.js Version](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard)
- [Vue.js Version](https://github.com/TailAdmin/vue-tailwind-admin-dashboard)
- [Angular Version](https://github.com/TailAdmin/free-angular-tailwind-dashboard)
- [Laravel Version](https://github.com/TailAdmin/tailadmin-laravel)

## Installation

### Prerequisites

To get started with TailAdmin, ensure you have the following prerequisites installed and set up:

* Node.js 18.x or later (recommended to use Node.js 20.x or later)

### Cloning the Repository

Clone the repository using the following command:

```bash
git clone https://github.com/TailAdmin/free-nextjs-admin-dashboard.git
```

> Windows Users: place the repository near the root of your drive if you face issues while cloning.

1. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

   > Use `--legacy-peer-deps` flag if you face peer-dependency error during installation.

2. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Components

TailAdmin is a pre-designed starting point for building a web-based dashboard using Next.js and Tailwind CSS. The template includes:

* Sophisticated and accessible sidebar
* Data visualization components
* Profile management and custom 404 page
* Tables and Charts(Line and Bar)
* Authentication forms and input elements
* Alerts, Dropdowns, Modals, Buttons and more
* Can't forget Dark Mode 🕶️

All components are built with React and styled using Tailwind CSS for easy customization.

## Feature Comparison

### Free Version

* 1 Unique Dashboard
* 30+ dashboard components
* 50+ UI elements
* Basic Figma design files
* Community support

### Pro Version

* 7 Unique Dashboards: Analytics, Ecommerce, Marketing, CRM, SaaS, Stocks, Logistics (more coming soon)
* 500+ dashboard components and UI elements
* Complete Figma design file
* Email support

To learn more about pro version features and pricing, visit our [pricing page](https://tailadmin.com/pricing).

## Changelog

### Version 2.2.2 - [December 30, 2025]

* Fixed date picker positioning and functionality in Statistics Chart.


### Version 2.1.0 - [November 15, 2025]

* Updated to Next.js 16.x
* Fixed all reported minor bugs

### Version 2.0.2 - [March 25, 2025]

* Upgraded to Next.js 16.x for [CVE-2025-29927](https://nextjs.org/blog/cve-2025-29927) concerns
* Included overrides vectormap for packages to prevent peer dependency errors during installation.
* Migrated from react-flatpickr to flatpickr package for React 19 support

### Version 2.0.1 - [February 27, 2025]

#### Update Overview

* Upgraded to Tailwind CSS v4 for better performance and efficiency.
* Updated class usage to match the latest syntax and features.
* Replaced deprecated class and optimized styles.

#### Next Steps

* Run npm install or yarn install to update dependencies.
* Check for any style changes or compatibility issues.
* Refer to the Tailwind CSS v4 [Migration Guide](https://tailwindcss.com/docs/upgrade-guide) on this release. if needed.
* This update keeps the project up to date with the latest Tailwind improvements. 🚀

### v2.0.0 (February 2025)

A major update focused on Next.js 16 implementation and comprehensive redesign.

#### Major Improvements

* Complete redesign using Next.js 16 App Router and React Server Components
* Enhanced user interface with Next.js-optimized components
* Improved responsiveness and accessibility
* New features including collapsible sidebar, chat screens, and calendar
* Redesigned authentication using Next.js App Router and server actions
* Updated data visualization using ApexCharts for React

#### Breaking Changes

* Migrated from Next.js 14 to Next.js 16
* Chart components now use ApexCharts for React
* Authentication flow updated to use Server Actions and middleware

[Read more](https://tailadmin.com/docs/update-logs/nextjs) on this release.

### v1.3.4 (July 01, 2024)

* Fixed JSvectormap rendering issues

### v1.3.3 (June 20, 2024)

* Fixed build error related to Loader component

### v1.3.2 (June 19, 2024)

* Added ClickOutside component for dropdown menus
* Refactored sidebar components
* Updated Jsvectormap package

### v1.3.1 (Feb 12, 2024)

* Fixed layout naming consistency
* Updated styles

### v1.3.0 (Feb 05, 2024)

* Upgraded to Next.js 14
* Added Flatpickr integration
* Improved form elements
* Enhanced multiselect functionality
* Added default layout component

## License

TailAdmin Next.js Free Version is released under the MIT License.

## Support
If you find this project helpful, please consider giving it a star on GitHub. Your support helps us continue developing and maintaining this template.
