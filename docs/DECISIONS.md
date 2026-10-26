# Food Webapp — decisions

## Current UI architecture — October 25, 2026

The owner explicitly authorized replacing the vanilla frontend with React, Vite and Material UI, then requested a cutesy design with light pastels and small illustrated food icons. The current implementation follows that direction; see `DESIGN.md`, `UX-CONTRACT.md` and `docs/REACT_REDESIGN.md`.

- React owns the UI; Vite produces versioned production assets. Material UI owns controls/overlays, and dnd-kit owns accessible sorting.
- Existing FastAPI, SQLAlchemy, SQLite, API associations/IDs, uploads, nutrition and persistent ordering remain authoritative. This UI change introduces no database migration.
- Preserve legacy `.html` links using SPA fallback. Ship only the Vite output through the existing Nginx/Docker deployment.
- The older browser-only/localStorage assumptions below are historical and do not describe the running backend.

## Historical MVP notes (October 18)

Date: 2026-10-18
Owner authorization: October 18, 2026 (local implementation only)

## Scope Summary

MVP includes: recipe URL import (ingredients + ordered instructions), mobile-first cooking view, multiple grocery lists with CRUD/check-off, finished-food photo gallery linked to recipes. No stretch features yet.

## Local Stack Assumptions

- Frontend: Plain HTML/CSS/JS (vanilla). Mobile-first, responsive via CSS grid/flexbox. Zero framework dependencies for local dev and easy testing.
- Backend: None required at MVP. Recipe fetch, grocery list state, and photo uploads handled client-side with localStorage or in-memory only. Serverless by default; can be wired to a local Python/Flask server later if needed.
- Database: None. All data persists in browser localStorage for MVP (no auth, no multi-device sync).
- Hosting: Local file server only. No paid services, no public deployment, no database hosting.

## Model Constraints

- Only Qwen 3.5 via LM Studio locally at http://192.168.12.17:1234/v1.
- No GPT/OpenAI, no paid fallbacks, no remote model calls beyond the local endpoint.

## Design & UX Notes

- Mobile-first recipe library grid with search and filter chips.
- Recipe detail/cooking mode: collapsible steps, ingredient checkboxes, timer overlay.
- Grocery lists: unlimited lists per session, drag-and-drop reordering optional stretch.
- Photo gallery: client-side crop + compression before localStorage to fit.

## Evidence Gates (per AGENTS.md)

- Real UI artifacts (HTML/CSS/JS files).
- Browser console tests for responsive layouts at phone and desktop sizes.
- localStorage persistence demo for recipe import, grocery lists, photos.
