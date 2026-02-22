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
  - enchaine login -> presign -> upload -> complete -> reading.


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
