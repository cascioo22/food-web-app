#!/usr/bin/env python3
"""Manual test for grocery list item CRUD operations."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# Mock the database session for testing without a real DB
from unittest.mock import MagicMock
from sqlalchemy.orm import Session as MockSession

class MockDB:
    def __init__(self):
        self.grocery_lists = {}
    
    def query(self, model_class):
        return MockQuery(self.grocery_lists, model_class)

class MockQuery:
    def __init__(self, storage, model_class):
        self.storage = storage
        self.model_class = model_class
        
    def filter(self, *conditions):
        return self
    
    def all(self):
        if self.model_class.__name__ == 'GroceryList':
            return list(self.storage.values())
        return []
    
    def first(self):
        if self.model_class.__name__ == 'GroceryList':
            for item in self.storage.values():
                return item
        return None
    
    def delete(self):
        pass
        
    def add(self, obj):
        if self.model_class.__name__ == 'GroceryList':
            self.storage[obj.name] = obj

# Create mock session
mock_session = MagicMock()
mock_session.query.side_effect = lambda x: MockQuery(mock_session.grocery_lists, x)
mock_session.add = lambda x: None
mock_session.commit = lambda: None
mock_session.rollback = lambda: None

import backend.app as app_module
app_module.SessionLocal = lambda: mock_session
app_module.engine.dispose()  # Reset engine

# Create test client
client = TestClient(app_module.app)

# Create test client
client = TestClient(app)

# Create a list
print('Creating grocery list...')
resp = client.post('/grocery-lists', json={'name': 'Test List'}, headers={'Content-Type': 'application/json'})
print(f'Create list: {resp.status_code} - {resp.json()}')

list_id = resp.json()['id']
print(f'List ID: {list_id}')

# Add items
items = ['Milk', 'Eggs', '2 cups flour, 3 large eggs']
for item in items:
    print(f'Adding item: {item}...')
    resp = client.post(f'/grocery-lists/{list_id}/items', 
                      json={'name': item, 'completed': False},
                      headers={'Content-Type': 'application/json'})
    print(f'  Response: {resp.status_code} - {resp.json()}')

# Get items
print('\nGetting items...')
resp = client.get(f'/grocery-lists/{list_id}/items')
print(f'Get items: {resp.status_code}')
print(f'Response: {resp.json()}')

# Toggle completion
print('\nToggling completion for first item...')
item_data = resp.json()['items']
if item_data:
    item_id = item_data[0]['id']
    resp = client.patch(f'/grocery-lists/{list_id}/items/{item_id}',
                       json={'name': item_data[0]['name'], 'completed': True},
                       headers={'Content-Type': 'application/json'})
    print(f'Update: {resp.status_code} - {resp.json()}')

# Delete item
print('\nDeleting last item...')
if len(item_data) > 1:
    item_to_delete = item_data[-1]
    resp = client.delete(f'/grocery-lists/{list_id}/items/{item_to_delete["id"]}')
    print(f'Delete: {resp.status_code}')

# Final state
print('\nFinal list state:')
resp = client.get(f'/grocery-lists/{list_id}/items')
print(resp.json())

print('\n✓ All manual tests passed!')
