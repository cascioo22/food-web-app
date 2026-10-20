# Pre-push verification

## Included scope

- Backend and frontend repairs, persistent Docker storage, Cloudflare tunnel Compose configuration, credential-free deployment documentation, token-retrieval helper source, regression tests and QA evidence.
- Existing meaningful `backend/app_new.py` fixes were preserved and included.
- `.env.example` contains blank credential values, not live credentials.

## Excluded local material

- The live `.env`, Cloudflare connector token, decoded tunnel secret, passwords, API credentials, database files/backups, local dependencies/tool binaries and new runtime uploads.
- The unused `frontend/js/recipe_library_backup.js` scratch backup is preserved locally and ignored; it has a pre-existing syntax error and is not loaded by the app.
- 108 initially detected permission-only filesystem changes were not staged. Original tracked executable bits were preserved in the index rather than publishing WSL permission noise. Local permission-only differences may therefore remain after the content commit.
- Previously committed synthetic upload-image fixtures remain unchanged; no live runtime upload data was added.

## Secret checks

Gitleaks 8.30.1 was downloaded from its official GitHub release and its archive SHA-256 was verified against that release's checksum file. The redacted staged-change scan and full exported-index scan reported no leaks. A separate exact-match check compared the exported index with actual live project credentials, including the decoded Cloudflare tunnel secret, without printing or recording their values; no matches were found.

The final index is scanned again after adding this report. Scanner binaries, full scanner reports and staging manifests stay under gitignored `.qa/security/` rather than being published.

## Execution checks

The staged repository snapshot was exported and its backend image built in isolation. A disposable container with its own SQLite database and no published host ports ran:

```sh
PYTHONPATH=/qa/backend FOOD_TEST_URL=http://127.0.0.1:8000 \
  python -m unittest discover -s tests -p 'test_ui_repair*.py' -v
```

Result: **12 tests passed** in the fresh container. The container was removed after verification; the running public app and its database were not used for these tests.

Also passed:

- Syntax validation for the active recipe, list, photo and cooking JavaScript modules and browser harness.
- Python compilation for changed backend modules, connector-token helper and new regression/persistence scripts.
- `docker compose -p food-web-app --profile tunnel config --quiet` without printing expanded secrets.
- Source/config whitespace validation. Raw terminal evidence is excluded from that formatting gate because it contains terminal progress carriage returns and trailing whitespace; test outcomes were not rewritten. Two short evidence files had cosmetic trailing spaces removed.

The prior public-hostname browser verification passed **62 assertions** across desktop/mobile runs, including a delayed-response nutrition regression. Evidence is in `docs/evidence/pantry-public/`.

## Known limits

The legacy full suite still has the six collection blockers documented in `UI-REPAIR.md`; this is not a full-suite-green claim. Review was performed serially without spawning additional workers, as required by the repository instructions. No new remote CI success is claimed by this local verification report.
