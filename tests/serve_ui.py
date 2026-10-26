"""Disposable same-origin QA server; production keeps Nginx as static host."""
import os
from pathlib import Path
import sys
root = Path(os.environ.get('FOOD_SOURCE_ROOT', str(Path(__file__).resolve().parents[1])))
sys.path.insert(0, str(root / 'backend'))
from app import app
from fastapi.staticfiles import StaticFiles
app.mount('/', StaticFiles(directory=str(root / 'frontend'), html=True))
