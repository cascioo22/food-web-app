# Food Webapp — Quick Start Guide

**Version:** 1.0.0  
**Date:** 2026-10-18  
**Purpose:** Get the application running in under 5 minutes

---

## Prerequisites

- Python 3.11 or higher installed
- pip package manager available

---

## 1-Minute Setup

```bash
cd /opt/data/home/food-webapp-project
source .venv/bin/activate
uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

**Done!** Backend is running at http://localhost:8000

---

## Access the Application

### Frontend Pages

| Page | URL | Purpose |
|------|-----|---------|
| Recipe Library | http://localhost:8000/frontend/index.html | Browse and add recipes |
| Grocery Lists | http://localhost:8000/frontend/lists.html | Manage shopping lists |
| Photo Gallery | http://localhost:8000/frontend/photos.html | View food photos |
| Cooking Mode | http://localhost:8000/frontend/cooking.html | Follow recipe step-by-step |

### API Documentation

| Page | URL | Purpose |
|------|-----|---------|
| Swagger UI | http://localhost:8000/docs | Interactive API explorer |
| ReDoc | http://localhost:8000/redoc | Read-only API documentation |

---

## 2-Minute Testing

### Create Your First Recipe (via API)

```bash
curl -X POST http://localhost:8000/recipes \
  -H "Content-Type: application/json" \
  -d '{"name": "Pasta Carbonara", "url": "https://example.com/carbonara"}'
```

**Expected response:**
```json
{
  "id": 1,
  "name": "Pasta Carbonara",
  "url": "https://example.com/carbonara",
  "source": "import",
  ...
}
```

### View Recipe

```bash
# Get the recipe you just created (use ID from previous response)
curl http://localhost:8000/recipes/1
```

---

## Run Tests

```bash
cd tests
python -m pytest test_integration_core_fw11.py -v
```

**Expected output:** All 7 tests pass

---

## Backup Your Data

```bash
# Quick backup (run before major changes)
cp backend/food_webapp.db backend/db-backup.$(date +%Y%m%d).db
```

---

## Troubleshooting

### Port 8000 Already in Use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or start on different port
uvicorn backend.app:app --host 0.0.0.0 --port 8001
```

### Module Not Found Error

```bash
# Make sure virtual environment is activated
cd /opt/data/home/food-webapp-project
source .venv/bin/activate

# Reinstall dependencies if needed
pip install -r backend/requirements.txt
```

---

## Next Steps

1. **Read Full Documentation**
   - `docs/INSTALLATION.md` — Complete installation guide
   - `docs/BACKUP-RESTORE.md` — Backup procedures

2. **Test the Application**
   - Create recipes via API or manually
   - Add items to grocery lists
   - Upload photos (via API)

3. **Review Evidence Log**
   - `docs/evidence/FW-12-summary.md` — Test results and acceptance status

---

**Need Help?** Check the evidence files in `docs/evidence/` for detailed testing logs and issue reports.
