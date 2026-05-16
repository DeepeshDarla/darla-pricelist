# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Darla Sales & Agencies — a Firebase-hosted web app for product price lookup and quote building, used by interior design supply staff in Mysore, India. No build tooling; all files are plain HTML/CSS/JS deployed directly.

## Deploy Commands

```bash
# Deploy everything
firebase deploy

# Deploy only hosting (HTML/JS/CSS)
firebase deploy --only hosting

# Deploy only Firestore rules
firebase deploy --only firestore

# Deploy only Cloud Functions
firebase deploy --only functions

# Local emulation (no emulator config exists yet)
firebase emulators:start
```

## Seed Scripts

These are one-time admin scripts, run from the `scripts/` directory:

```bash
cd scripts && npm install

# Requires scripts/serviceAccountKey.json (download from Firebase Console)
node scripts/seed-staff.js

# No service account needed — uses web API key
node scripts/seed-rest.js
```

## Architecture

### Two SPAs

**`index.html`** — Product Lookup  
Renders a single-page app entirely via `innerHTML` into `<div id="app">`. Three main views:
- Home: category grid (fabric, hangers, blinds, wallpapers, beds, flooring, motors, rods)
- Search: cascading autocomplete dropdowns loading data from Firebase Realtime Database
- Product page: direct URL lookup via `?code=...&category=...`

**`quote.html`** — Quote Builder  
A staff-only quote builder with screens: login → customer → builder → summary. State lives in `APP.quote` (an in-memory JS object), auto-saved to `localStorage` as `darla_quote_draft` and synced to Google Sheets via a Google Apps Script web app URL (`ASU` in `quote-render.js`).

### Script Dependency

`quote.html` loads `quote-calc.js` before `quote-render.js`. `quote-calc.js` is pure calculation logic with no DOM access. `quote-render.js` depends on functions and globals from `quote-calc.js`.

### Firebase Globals

`firebase-init.js` exposes three globals used across all HTML files:
- `DB` — Firestore
- `AUTH` — Firebase Auth
- `FN` — Cloud Functions (`asia-southeast1` region)

### Product Data (Realtime Database)

Products are stored in RTDB under `/{category}/`:
- `/{category}/meta.json` — brand/catalog/sno hierarchy for populating autocomplete menus
- `/{category}/by_code/{CODE}` — lookup by product code
- `/{category}/by_brand/{brand}/{catalog}/{sno}` — cascading drill-down search

### Staff Authentication

Staff authenticate with Firebase Email/Password. The convention is:
- Email: `firstname.lastname@darla.in` (spaces → dots, lowercase)
- Password: `{4-digit PIN}!drla` (the `!drla` suffix satisfies Firebase's 6-char minimum)

The `staffDirectory` Firestore collection is publicly readable so the login dropdown populates before auth. The private `staff` collection requires manager/admin role.

### Quote ↔ Product Lookup Handoff

When a user selects a product inside quote mode, the app navigates from `quote.html` to `index.html?mode=quote&category=...`. The selected product is returned via `localStorage`:
- `darla_selected_product` — the chosen product object
- `quote_product_ctx` — `{ri, wi, ti, ci}` indices pointing where to attach it
- `darla_quote_draft` — serialised quote preserved across navigation
- `darla_scroll_pos` — scroll position to restore after returning

### Pricing Config

All pricing constants (stitching rates, tape prices, roman blind mechanism cost, etc.) are defined in the `PRICES` object at the top of `quote-calc.js`. Change prices there only.

### Cloud Functions (`functions/index.js`)

- `generateQuoteId` — atomic counter, produces IDs like `DRL26-101`
- `setStaffRole` — admin-only, sets custom claims on a Firebase Auth user
- `createStaffAccount` — admin-only, creates Auth user + Firestore docs
- `exportToSheets` — scheduled daily at 02:00 IST, writes recent quotes to Google Sheets (requires `sheets.id` Firebase config)

### Firestore Collections

| Collection | Purpose |
|---|---|
| `staffDirectory` | Public name list for login dropdowns |
| `staff/{uid}` | Private staff records (role, email, PIN metadata) |
| `quotes/{id}` | Saved quotes, tenanted to `darla` |
| `customers` | Customer records |
| `counters/quotes` | Atomic quote ID counter |

### Key localStorage Keys

| Key | Purpose |
|---|---|
| `darla_staff_v1` | Staff login flag (legacy) |
| `darla_search_v1` | Search access flag |
| `darla_staff_cache` | Cached staff directory list |
| `darla_quote_draft` | Current in-progress quote JSON |
| `darla_quotes_list` | Local list of all saved quotes (max 200) |
| `darla_quote_staff` | Active staff member for quote session |
| `darla_qnum` | Local quote counter (used when offline) |
