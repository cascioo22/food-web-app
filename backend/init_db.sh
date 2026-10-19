#!/bin/sh

# Initialize database if it doesn't exist
if [ ! -f /app/data/foodweb.db ]; then
    python3 << 'PYEOF'
from sqlalchemy import create_engine, text
import sys

DATABASE_URL = "sqlite:///./foodweb.db"
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # Create tables - replace with your actual schema
    print("Database initialized successfully", flush=True)
PYEOF
fi
