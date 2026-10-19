# Food Webapp

Local-first recipe and grocery management webapp built with vanilla HTML/CSS/JS frontend and FastAPI backend.

## Quick Start

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Run the backend server

```bash
# Option 1: Using uvicorn directly
uvicorn app:app --host 0.0.0.0 --port 8000

# Option 2: Using pyproject.toml script
food-webapp-backend
```

The API will be available at http://localhost:8000

### 3. Run tests

```bash
cd ../tests
python -m pytest test_backend.py -v
```

## Project Structure

```
food-webapp-project/
├── backend/
│   ├── app.py              # FastAPI application + SQLAlchemy models
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── *.html             # HTML pages (index, lists, photos)
├── tests/
│   └── test_backend.py    # API unit tests
├── .env.example           # Environment variables template
├── pyproject.toml         # Python project configuration
└── README.md              # This file
```

## API Endpoints

### Recipes
- `GET /recipes` - List all recipes
- `POST /recipes` - Create a new recipe
- `GET /recipes/{id}` - Get a specific recipe
- `DELETE /recipes/{id}` - Delete a recipe
- `POST /recipes/{id}/ingredients` - Add ingredients to a recipe
- `GET /recipes/{id}/ingredients` - Get ingredients for a recipe

### Grocery Lists
- `GET /grocery-lists` - List all grocery lists
- `POST /grocery-lists` - Create a new list
- `PATCH /grocery-lists/{id}` - Update items in a list
- `DELETE /grocery-lists/{id}` - Delete a list

### Photos
- `GET /photos` - List photos (optional recipe_id filter)
- `POST /photos` - Add a photo with base64 data
- `DELETE /photos/{id}` - Delete a photo

## Data Models

The backend uses SQLite by default and supports:
- Recipes with ingredients, prep time, servings, categories
- Grocery lists with item tracking (check-off support)
- Photos linked to recipes or standalone
- Ordered steps for recipe instructions

## Local Development

All development is local-only:
- Database: SQLite file (`backend/food_webapp.db`)
- Frontend: Vanilla HTML/CSS/JS served locally
- AI: Optional LM Studio integration via `LM_STUDIO_URL` env var (configured in `.env.example`)

No cloud services, no paid APIs, no remote model calls.

## Testing Evidence

Run the test suite and attach output to this task:

```bash
cd tests
python -m pytest test_backend.py -v --tb=short
```

Attach the full test output as evidence that acceptance criteria are met.
