#!/usr/bin/env python3
import re

def _extract_number(text):
    """Extract a numeric value from text."""
    match = re.search(r'([0-9]+(?:\.[0-9]{1,2})?)', text)
    if match:
        return float(match.group(1))
    return None

def test_patterns(value_str):
    unit_patterns = [
        (r'\bcal\b', 'calories_per_serving'),
        (r'\bkcal\b', 'calories_per_serving'),
        (r'carb.*content', 'carbohydrates_per_serving'),
        (r'fiber.*content', 'fiber_per_serving'),
        (r'fat.*content', 'fat_per_serving'),
        (r'protein.*content', 'protein_per_serving'),
        (r'sodium.*content', 'sodium_per_serving'),
        (r'sugar.*content', 'sugar_per_serving'),
    ]
    
    matched = False
    for pattern, field_name in unit_patterns:
        match_result = re.search(pattern, value_str, re.IGNORECASE)
        print(f"  Testing '{pattern}' against '{value_str}': {match_result}")
        if match_result:
            num = _extract_number(value_str)
            print(f"    MATCH! Number extracted: {num}")
            matched = True
            break
    
    if not matched:
        num = _extract_number(value_str)
        print(f"No match, but number extracted: {num}")

test_patterns("500 calories")
test_patterns("30 grams of protein")
test_patterns("25 g sugar")
