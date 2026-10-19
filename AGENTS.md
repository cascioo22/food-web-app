# Food Webapp — worker instructions

Work only in /opt/data/home/food-webapp-project and on the food-webapp board.
The owner has authorized implementation of the existing plan using local Qwen 3.5 only.
Never invoke GPT, Codex, Claude, remote inference, paid AI services, or cloud fallback models.
Use profile food-webapp-qwen: lmstudio / qwen/qwen3.5-9b at http://192.168.12.117:1234/v1.
Do not change another project's files, board, profiles, or global configuration.

## Scope and decisions
- MVP: recipe URL import with ingredients and ordered instructions; a sleek mobile-friendly cooking view; multiple persistent grocery lists with item CRUD/check-off; finished-food photos, optionally recipe-linked and visible on recipes.
- Stretch: preview/select and bulk-add recipe ingredients to a chosen grocery list.
- Stack was not selected by the owner. Record a minimal, reversible local-development recommendation and assumptions in docs/DECISIONS.md. You may choose reasonable local defaults to progress under the owner's implementation authorization; do not claim the owner approved a specific stack. No paid services, public deployment, destructive changes, or publishing without approval. Ask/block only when a genuine decision prevents safe local progress.
- Recipe import must preserve attribution and original ingredient text, reject unsafe/private URL destinations and redirects, enforce size/time limits, and allow manual correction or entry. Do not fabricate recipe content on fetch failure.
- Validate photo content/size; use safe filenames; strip location metadata. Define access controls before public hosting.

## Execution and evidence gates
1. Read your native task body, prerequisites and results. Preserve completed work. Load relevant skills.
2. Implement the whole assigned scope, not a prose outline. Add tests for behavior and failure cases before implementing where practical.
3. Run the real tests and applicable lint/build/type checks. Save commands and actual output in docs/evidence/FW-XX.md. For UI tasks include browser verification at phone and desktop sizes where available; otherwise report the exact blocker.
4. Never mark a task done unless every applicable acceptance criterion has real evidence. Block with exact missing decision/infrastructure when necessary; use review status for review, not done.
5. Native kanban completion must include changed files, test commands/results, unresolved limits, and a handoff to dependent tasks. Heartbeat periodically while working.
6. Do not create or assign additional workers. This shared workspace is serial. Do not change dependency or execution policy.
7. Local implementation is authorized, but paid hosting, public exposure, and final user acceptance are not implied. Stop at those gates.
