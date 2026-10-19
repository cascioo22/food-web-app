# FW-03 Python environment recovery

## Root cause and scope

The previous worker used the default `python3`, which is Python 3.14.7 in this environment. Its pinned pydantic-core dependency could not build there. The system also has `/usr/bin/python` (Python 3.13.5). No global interpreter, profile configuration, model routing, or application source was changed.

Created project-local `.venv` using Python 3.13.5 and `.python-version` selecting 3.13 for compatible environment managers. The version file does not change the shell's `python3`; use the explicit environment paths below.

## Commands and actual results

From `/opt/data/home/food-webapp-project`:

```sh
python -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt pytest httpx
.venv/bin/python -m pip check
PYTHONPATH=backend .venv/bin/python -m pytest tests/test_backend.py -q
```

Installation succeeded; full output: `docs/evidence/FW-03-install.log`.

`pip check`: `No broken requirements found.`

Installed versions verified via importlib.metadata: FastAPI 0.115.0, Pydantic 2.9.2, pydantic-core 2.23.4, SQLAlchemy 2.0.36, pytest 9.1.1, HTTPX 0.28.1.

A real FastAPI TestClient request to `/` returned HTTP 200 with `{'message': 'Food Webapp API', 'status': 'running'}`.

Tests ran rather than failing dependency installation. They did not pass: `1 failed, 3 warnings, 25 errors in 0.99s`; 13 test cases collected. Full output: `docs/evidence/FW-03-tests.log`.

## Remaining implementation work for the existing Qwen worker

Do not mark FW-03 complete on the basis of successful dependency installation. Existing tests expose independent scaffold/fixture issues, including `app.get_db` missing, removed SQLAlchemy `Engine.execute`, `app.test_client()` usage, and treating sessionmaker as an iterator. Fix under the existing local Qwen-only policy and rerun all acceptance checks. Check the full test log for details. Update documented setup commands to use this environment, reconcile dependency declarations, and verify all original FW-03 criteria, including migrations and lint/type checks. No additional workers or execution-policy changes are needed.
