# Food Web App - Docker Setup

## Quick Start

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Services

- **Backend API** (port 8000): FastAPI server with your application logic
- **Frontend** (port 3000): Static file server for HTML/CSS/JS files

## Environment Variables

The backend uses SQLite by default. To change the database:
```bash
docker-compose up -d --build
```

To use a different database:
```yaml
# docker-compose.yml
environment:
  - DATABASE_URL=postgresql://user:pass@db:5432/foodweb
```

## Build from Scratch

```bash
docker-compose build
docker-compose up -d
```

## Common Commands

- `docker-compose ps` - View running containers
- `docker-compose logs backend` - Backend logs
- `docker-compose logs frontend` - Frontend logs
- `docker-compose restart` - Restart services
- `docker-compose down -v` - Stop and remove volumes (includes data)

## Data Persistence

Your SQLite database is persisted in the `backend_data` volume. Uploaded files are mounted from your host directory at `/opt/data/home/food-webapp-project/uploads`.
