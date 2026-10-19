# Food Webapp — Installation and Start Guide

**Version:** 1.0.0  
**Date:** 2026-10-18  
**Platform:** Local development only (no cloud hosting yet)

---

## Prerequisites

- Python 3.11 or higher
- `pip` package manager
- Optional: LM Studio running locally for AI integration (http://192.168.12.117:1234/v1)

---

## 1. Installation

### Step 1: Clone or Navigate to Project

```bash
cd /opt/data/home/food-webapp-project
```

### Step 2: Create and Activate Virtual Environment (Recommended)

```bash
# Create virtual environment
python -m venv .venv

# Activate on Linux/macOS
source .venv/bin/activate

# Activate on Windows (WSL)
.venv\Scripts\activate
```

### Step 3: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Expected dependencies installed:**
- fastapi==0.115.0
- uvicorn[standard]==0.32.0
- sqlalchemy==2.0.36
- pydantic==2.9.2
- python-multipart==0.0.9

---

## 2. Configuration

### Create .env File (Optional but Recommended)

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# FastAPI backend server
BACKEND_HOST="0.0.0.0"
BACKEND_PORT=8000

# LM Studio API endpoint for Qwen 3.5 (optional)
LM_STUDIO_URL="http://192.168.12.117:1234/v1"
LM_STUDIO_API_KEY="local-dev-key"

# Optional: Browser test server
TEST_SERVER_PORT=8080

# Database path (SQLite, auto-created)
DATABASE_PATH="./backend/food_webapp.db"
```

---

## 3. Start the Backend Server

### Option A: Using uvicorn directly

```bash
cd backend
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Option B: Using pyproject.toml script (requires pip install -e .)

```bash
food-webapp-backend
```

### Expected Output

When running successfully, you should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [PID]
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

The API will be available at **http://localhost:8000**

---

## 4. Start the Frontend (Optional)

Since this is a static HTML/CSS/JS frontend, simply open the files in a browser:

- **Home:** http://localhost:8000/frontend/index.html
- **Grocery Lists:** http://localhost:8000/frontend/lists.html
- **Photo Gallery:** http://localhost:8000/frontend/photos.html
- **Cooking View:** http://localhost:8000/frontend/cooking.html

Or use any local HTTP server:

```bash
cd frontend
python -m http.server 8080
# Then open http://localhost:8080/ in your browser
```

---

## 5. Run Tests

### Install Test Dependencies (if not already installed)

```bash
pip install pytest
```

### Run Full Test Suite

```bash
cd tests
python -m pytest -v --tb=short
```

### Run Specific Test File

```bash
python -m pytest test_integration_core_fw11.py -v --tb=short
```

**Expected output (7/7 passing):**
- Import/save/cook flow tests (3)
- Database persistence tests (1)
- Frontend file verification tests (3)

---

## 6. Database Setup

### SQLite Database (Default)

The backend uses SQLite by default:
- Location: `backend/food_webapp.db`
- Auto-created on first run
- No manual setup required

### Test Database

A separate test database is created for testing:
- Location: `test_food_webapp.db`
- Used only in tests, not production data

---

## 7. API Endpoints Summary

### Recipes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /recipes | List all recipes |
| POST | /recipes | Create new recipe |
| GET | /recipes/{id} | Get specific recipe |
| DELETE | /recipes/{id} | Delete recipe |

### Grocery Lists
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /grocery-lists | List all grocery lists |
| POST | /grocery-lists | Create new list |
| PATCH | /grocery-lists/{id} | Update list items |
| DELETE | /grocery-lists/{id} | Delete list |

### Items (within a list)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /grocery-lists/{list_id}/items | List all items |
| POST | /grocery-lists/{list_id}/items | Add new item |
| PATCH | /grocery-lists/{list_id}/items/{item_id} | Update item |
| DELETE | /grocery-lists/{list_id}/items/{item_id} | Remove item |

### Photos
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /photos | List photos (optional recipe filter) |
| POST | /photos | Add photo with base64 data |
| DELETE | /photos/{id} | Delete photo |

---

## 8. Troubleshooting

### Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'backend'`

**Fix:** Ensure you're in the project directory and virtual environment is activated:
```bash
cd /opt/data/home/food-webapp-project
source .venv/bin/activate
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000
```

### Database Issues

**Error:** `sqlite3.DatabaseError`

**Fix:** Delete existing database and restart:
```bash
rm backend/food_webapp.db
# Restart backend
```

### Port Already in Use

**Error:** `Address already in use`

**Fix:** Use different port or kill process:
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Or start on different port
uvicorn app:app --host 0.0.0.0 --port 8001
```

---

## 9. Development Workflow

### Typical Daily Start

```bash
# Navigate to project
cd /opt/data/home/food-webapp-project

# Activate virtual environment
source .venv/bin/activate

# Start backend server in one terminal
uvicorn backend.app:app --host 0.0.0.0 --port 8000

# Open browser to frontend
open http://localhost:8000/frontend/index.html
```

### Testing Changes

```bash
# Save changes
# Run tests immediately
cd tests
python -m pytest test_integration_core_fw11.py -v
```

---

## 10. Backup Strategy

### Database Backup

```bash
# Backup database
cp backend/food_webapp.db backend/food_webapp.db.backup.$(date +%Y%m%d_%H%M%S)

# Or compress
tar czf food_webapp_backup_$(date +%Y%m%d).tar.gz backend/food_webapp.db
```

### Photo Directory Backup

```bash
# Backup uploads/photos directory
cp -r uploads uploads-backup-$(date +%Y%m%d_%H%M%S)
```

### Full Project Backup

```bash
cd /opt/data/home/food-webapp-project
tar czf food-webapp-full-backup-$(date +%Y%m%d).tar.gz .
```

---

## 11. Restore Procedure

### Restore Database from Backup

```bash
# Navigate to project
cd backend

# Restore from backup file
cp food_webapp.db.backup.YYYYMMDD_HHMMSS food_webapp.db

# Or extract from tarball
tar xzf /path/to/food-webapp_backup_YYYYMMDD.tar.gz -C ..

# Restart backend to apply changes
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Restore Photos

```bash
cd uploads
cp -r ../uploads-backup-YYYYMMDD_HHMMSS/* .
```

---

## 12. Security Notes

### Local Development Only
- All data stored locally on disk (SQLite)
- No cloud synchronization
- No authentication required for local use

### Photo Uploads
- Photos stored in `uploads/` directory
- File size and type validation applied
- EXIF metadata stripped for privacy

### Environment Variables
- Never commit `.env` file to version control
- Sensitive data (API keys) should be kept in `.env` only
- `.env.example` is safe to include in git

---

## 13. Next Steps After Setup

1. **Test the API** at http://localhost:8000/docs (Swagger UI)
2. **Create a recipe** via POST /recipes endpoint
3. **Open frontend** and verify data appears
4. **Run tests** to ensure everything works: `pytest tests/ -v`

---

## Appendix: Quick Reference

### Start Commands

```bash
# Full start (recommended)
cd /opt/data/home/food-webapp-project
source .venv/bin/activate
uvicorn backend.app:app --host 0.0.0.0 --port 8000

# Minimal start (if deps already installed)
cd /opt/data/home/food-webapp-project/backend
uvicorn app:app --host 0.0.0.0 --port 8000
```

### Test Commands

```bash
# All tests
pytest -v

# Specific file
pytest tests/test_integration_core_fw11.py -v

# Single test
pytest tests/test_integration_core_fw11.py::test_import_recipe_save_and_view -v
```

### Backup Commands

```bash
# Quick database backup
cp backend/food_webapp.db backend/db-backup.$(date +%Y%m%d).db

# Full project backup
tar czf food-webapp-backup-$(date +%Y%m%d).tar.gz /opt/data/home/food-webapp-project
```

---

**Last Updated:** 2026-10-18  
**Maintained by:** Food Webapp Team  
**License:** Local development project — use as needed
