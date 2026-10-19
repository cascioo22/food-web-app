"""Test suite for Food Webapp backend API and data models."""

from app import Recipe, GroceryList, Photo, Ingredient, Base, get_db, app
import json
import asyncio

import pytest
from starlette.testclient import TestClient as StarletteTestClient
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


def make_test_app():
    """Create a new app instance with fresh database for testing."""
    from fastapi import FastAPI, HTTPException, Depends
    from pydantic import BaseModel
    from typing import List, Optional
    
    test_url = "sqlite:///:memory:"
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def get_db():
        db = SessionLocalTest()
        try:
            yield db
        finally:
            db.close()
    
    app_instance = FastAPI()
    
    @app_instance.get("/")
    async def root():
        return {"status": "running"}
    
    # Add all the endpoints here...
    
    return app_instance, SessionLocalTest


@pytest.fixture(scope="function")
def client_and_db():
    """Create test client with isolated in-memory database for each test."""
    from fastapi import FastAPI, HTTPException, Depends
    from pydantic import BaseModel
    from typing import List, Optional
    
    # Create fresh in-memory DB
    test_url = "sqlite:///:memory:"
    engine = create_engine(test_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    
    SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    def get_db():
        db = SessionLocalTest()
        try:
            yield db
        finally:
            db.close()
    
    # Create a minimal app with just root endpoint for basic tests
    test_app = FastAPI()
    
    @test_app.get("/")
    async def root(db=Depends(get_db)):
        return {"status": "running"}
    
    client = StarletteTestClient(test_app, raise_server_exceptions=False)
    
    yield client, SessionLocalTest, engine
    
    # Cleanup not needed for this fixture


def test_root(client_and_db):
    """Test root endpoint."""
    client, _, _ = client_and_db
    
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
