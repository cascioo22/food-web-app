"""Serve the real Vite build with a disposable FastAPI backend for browser QA."""
import os
from pathlib import Path
import sys
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'backend'))
from app import app as backend

app = FastAPI()
@app.get('/favicon.ico')
def favicon():
    return Response(status_code=204)

app.mount('/api', backend)
app.mount('/uploads/photos', StaticFiles(directory=os.environ['PHOTO_UPLOAD_DIR']), name='photos')

class SPABuild(StaticFiles):
    async def get_response(self, path, scope):
        if path in ('lists.html', 'photos.html', 'cooking.html'):
            path = 'index.html'
        return await super().get_response(path, scope)

app.mount('/', SPABuild(directory=str(root / 'frontend/dist'), html=True))

@app.on_event('startup')
def startup():
    # Mounted app lifespans are not automatically run by FastAPI.
    from app import startup as initialize
    initialize()
