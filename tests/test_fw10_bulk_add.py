"""Tests for FW-10: Bulk Add Recipe Ingredients feature."""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_parse_simple_line():
    """Test parsing a simple ingredient line."""
    from backend.app import parse_ingredients_text
    
    result = parse_ingredients_text("2 cups flour")
    
    assert len(result) == 1
    assert result[0]["name"] == "cups"
    assert result[0]["amount"] == "flour"


def test_parse_multiple_lines():
    """Test parsing multiple ingredient lines."""
    from backend.app import parse_ingredients_text
    
    text = """2 cups flour
3 large eggs
1 tsp salt"""
    
    result = parse_ingredients_text(text)
    
    assert len(result) == 3
    assert result[0]["name"] == "cups"
    assert result[0]["amount"] == "flour"


def test_parse_empty_string():
    """Test parsing empty string returns empty list."""
    from backend.app import parse_ingredients_text
    
    result = parse_ingredients_text("")
    
    assert result == []

