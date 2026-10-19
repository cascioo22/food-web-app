"""Tests for grocery list item CRUD operations."""

import pytest
from fastapi.testclient import TestClient
from backend.app import app, GroceryList, engine, Base


@pytest.fixture(scope="module")
def test_db():
    """Create test database and yield context manager."""
    from sqlalchemy.orm import sessionmaker
    
    def get_test_db():
        db_url = "sqlite:///./test_grocery_items.db"
        engine_test = create_engine(db_url, connect_args={"check_same_thread": False})
        SessionLocal = sessionmaker(bind=engine_test)
        Base.metadata.create_all(bind=engine_test)
        return SessionLocal()
    
    class TestDatabase:
        pass
    
    test_db_instance = TestDatabase()
    test_db_instance.session = get_test_db()
    yield test_db_instance


@pytest.fixture
def client(test_db):
    """Create test client with mocked database."""
    
    def override_get_db():
        db_instance = test_db.session()
        try:
            yield db_instance
        finally:
            db_instance.close()
    
    app.dependency_overrides[app.dependencies.get_db] = override_get_db
    
    with TestClient(app):
        yield
    
    app.dependency_overrides.clear()


class TestGroceryListItems:
    """Test suite for grocery list item CRUD operations."""
    
    def test_create_empty_grocery_list(self, client):
        """Test creating a grocery list with no items."""
        response = client.post(
            "/grocery-lists",
            json={"name": "Empty List"},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 201
        list_data = response.json()
        assert list_data["name"] == "Empty List"
        assert list_data["items"] == "[]"
    
    def test_create_grocery_list_with_items(self, client):
        """Test creating a grocery list and adding items."""
        # Create list
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        # Add first item
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Milk", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 201
        
        # Get items
        response = client.get(f"/grocery-lists/{list_id}/items")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        assert data["items"][0]["name"] == "Milk"
        assert data["items"][0]["completed"] is False
    
    def test_get_grocery_list_items(self, client):
        """Test retrieving multiple items from a grocery list."""
        # Create list
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        # Add multiple items
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Eggs", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Bread", "completed": True},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        # Retrieve all items
        response = client.get(f"/grocery-lists/{list_id}/items")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 3  # Original empty + 2 added
    
    def test_update_grocery_list_item_name(self, client):
        """Test updating an item's name."""
        # Create list and add item
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Original Name", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        item_id = response.json()["id"]
        
        # Update the name
        response = client.patch(
            f"/grocery-lists/{list_id}/items/{item_id}",
            json={"name": "Updated Name", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        # Verify update
        response = client.get(f"/grocery-lists/{list_id}/items")
        assert response.status_code == 200
        data = response.json()
        assert data["items"][0]["name"] == "Updated Name"
    
    def test_update_grocery_list_item_completion(self, client):
        """Test updating an item's completion status."""
        # Create list and add completed item
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Milk", "completed": True},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        item_id = response.json()["id"]
        
        # Toggle completion
        response = client.patch(
            f"/grocery-lists/{list_id}/items/{item_id}",
            json={"name": "Milk", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        
        # Verify toggle
        response = client.get(f"/grocery-lists/{list_id}/items")
        data = response.json()
        assert data["items"][0]["completed"] is False
    
    def test_delete_grocery_list_item(self, client):
        """Test deleting an item from a grocery list."""
        # Create list and add items
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "First Item", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "Second Item", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        item_id = response.json()["id"]
        
        # Delete the second item
        response = client.delete(f"/grocery-lists/{list_id}/items/{item_id}")
        assert response.status_code == 204
        
        # Verify deletion
        response = client.get(f"/grocery-lists/{list_id}/items")
        data = response.json()
        assert data["count"] == 1
        assert data["items"][0]["name"] == "First Item"
    
    def test_delete_nonexistent_item(self, client):
        """Test deleting an item that doesn't exist."""
        # Create list
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        response = client.delete(f"/grocery-lists/{list_id}/items/999")
        assert response.status_code == 404
    
    def test_delete_item_from_nonexistent_list(self, client):
        """Test deleting an item from a list that doesn't exist."""
        response = client.delete("/grocery-lists/999/items/1")
        assert response.status_code == 404
    
    def test_item_preserves_quantity_text(self, client):
        """Test that items preserve full name text including quantities."""
        # Create list
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        # Add item with quantity and unit
        response = client.post(
            f"/grocery-lists/{list_id}/items",
            json={"name": "2 cups flour, 3 large eggs", "completed": False},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        # Verify full text is preserved
        response = client.get(f"/grocery-lists/{list_id}/items")
        data = response.json()
        assert data["items"][0]["name"] == "2 cups flour, 3 large eggs"
    
    def test_empty_list_returns_zero_items(self, client):
        """Test that an empty list returns zero items."""
        # Create empty list
        response = client.post(
            "/grocery-lists",
            json={"name": "Empty"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        list_id = response.json()["id"]
        
        # Get items (should be empty)
        response = client.get(f"/grocery-lists/{list_id}/items")
        data = response.json()
        assert data["count"] == 0
        assert data["items"] == []
    
    def test_multiple_lists_isolation(self, client):
        """Test that lists remain isolated from each other."""
        # Create two lists
        list1_response = client.post(
            "/grocery-lists",
            json={"name": "List 1"},
            headers={"Content-Type": "application/json"}
        )
        assert list1_response.status_code == 201
        
        list2_response = client.post(
            "/grocery-lists",
            json={"name": "List 2"},
            headers={"Content-Type": "application/json"}
        )
        assert list2_response.status_code == 201
        
        list1_id = list1_response.json()["id"]
        list2_id = list2_response.json()["id"]
        
        # Add item to list 1 only
        response = client.post(
            f"/grocery-lists/{list1_id}/items",
            json={"name": "Only in List 1"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 201
        
        # Verify list 1 has the item, list 2 does not
        response = client.get(f"/grocery-lists/{list1_id}/items")
        assert response.json()["count"] == 1
        
        response = client.get(f"/grocery-lists/{list2_id}/items")
        assert response.json()["count"] == 0
    
    def test_list_persists_across_requests(self, client):
        """Test that items persist across multiple requests."""
        # Create list
        list_response = client.post(
            "/grocery-lists",
            json={"name": "Test List"},
            headers={"Content-Type": "application/json"}
        )
        assert list_response.status_code == 201
        list_id = list_response.json()["id"]
        
        # Add multiple items in sequence
        for name in ["Item A", "Item B", "Item C"]:
            response = client.post(
                f"/grocery-lists/{list_id}/items",
                json={"name": name, "completed": False},
                headers={"Content-Type": "application/json"}
            )
            assert response.status_code == 201
        
        # Retrieve and verify all items
        response = client.get(f"/grocery-lists/{list_id}/items")
        data = response.json()
        
        names = [item["name"] for item in data["items"]]
        assert "Item A" in names
        assert "Item B" in names
        assert "Item C" in names
        assert data["count"] == 3
