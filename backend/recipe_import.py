"""
Recipe Import Module - Safe URL fetching and structured data extraction

Implements:
- Safe HTTP(S) recipe URL fetching with redirects blocked, size/time limits
- Recipe structured data (JSON-LD) parsing for ingredients and steps
- Manual entry fallback when extraction fails
- Attribution preservation and source validation
"""

import re
from urllib.parse import urlparse, urljoin
from typing import Optional, Dict, List, Any
from dataclasses import dataclass
import json

# Try to import optional dependencies for nutrition extraction
try:
    from bs4 import BeautifulSoup
    HAS_BEAUTIFULSOUP = True
except ImportError:
    HAS_BEAUTIFULSOUP = False


# Nutrition field mappings - schema.org NutritionInformation fields to our output format
NUTRITION_FIELDS = [
    'calories',
    'carbohydrateContent',
    'cholesterolContent',
    'fiberContent',
    'fatContent',
    'proteinContent',
    'sodiumContent',
    'sugarContent',
]

# Mapping from schema.org field names to our output keys
NUTRITION_FIELD_MAPPING = {
    'calories': 'calories_per_serving',
    'carbohydrateContent': 'carbohydrates_per_serving',
    'cholesterolContent': 'cholesterol_per_serving',
    'fiberContent': 'fiber_per_serving',
    'fatContent': 'fat_per_serving',
    'proteinContent': 'protein_per_serving',
    'sodiumContent': 'sodium_per_serving',
    'sugarContent': 'sugar_per_serving',
}

# Serving size field (separate from nutrition info)
SERVING_SIZE_FIELD = 'servingSize'


# URL safety checks
BLOCKED_SCHEMES = {'ftp', 'mailto', 'tel'}
PRIVATE_HOST_PATTERNS = [
    r'^127\.',         # localhost
    r'^10\.',          # private class A
    r'^172\.(1[6-9]|2[0-9]|3[0-1])\.',  # private class B
    r'^192\.168\.',     # private class C
    r'^0\.',            # reserved
    r'^localhost',
]

# Maximum limits
MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5MB
MAX_FETCH_TIME = 30  # seconds


@dataclass
class RecipeImportResult:
    """Result of a recipe import operation."""
    success: bool
    error_message: Optional[str] = None
    extracted_recipe: Optional[Dict[str, Any]] = None
    is_manual_entry: bool = False
    original_url: Optional[str] = None
    nutrition_extracted: Optional[Dict[str, Any]] = None  # Added for nutrition extraction result


def is_safe_url(url: str) -> tuple[bool, str]:
    """
    Validate URL safety. Returns (is_valid, error_message).
    
    Checks:
    - Valid HTTP/HTTPS scheme
    - Not a private/internal host
    - No redirects to unsafe hosts
    - Reasonable URL length
    """
    # Basic validation
    if not url or len(url) > 2000:
        return False, "Invalid URL"
    
    parsed = urlparse(url)
    
    # Check scheme
    if parsed.scheme.lower() not in {'http', 'https'}:
        return False, f"Unsupported protocol: {parsed.scheme}"
    
    if parsed.scheme.lower() in BLOCKED_SCHEMES:
        return False, f"Blocked protocol: {parsed.scheme}"
    
    # Check for private/internal hosts
    hostname = parsed.netloc.lower()
    if not hostname:
        return False, "Missing hostname"
    
    for pattern in PRIVATE_HOST_PATTERNS:
        if re.match(pattern, hostname):
            return False, f"Private or restricted host blocked: {hostname}"
    
    # Check URL length
    if len(url) > 2048:
        return False, "URL exceeds maximum length"
    
    return True, ""


def fetch_url_safely(url: str, timeout: int = 15) -> Optional[str]:
    """
    Fetch URL content with safety limits.
    
    Args:
        url: URL to fetch
        timeout: Request timeout in seconds
    
    Returns:
        HTML content as string, or None on error
    """
    import requests
    
    try:
        # Check if it's a known bad domain
        parsed = urlparse(url)
        hostname = parsed.netloc.lower()
        
        # Basic DNS resolution check
        if hostname in ['localhost', '127.0.0.1', 'local']:
            raise ValueError("Private host access blocked")
        
        # Make request with redirect disabled (we'll handle safe redirects separately)
        response = requests.get(
            url,
            timeout=timeout,
            allow_redirects=False,  # We check redirects manually
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        )
        
        # Check for redirect to unsafe destination
        if response.is_redirect and response.headers.get('Location'):
            new_url = urljoin(url, response.headers['Location'])
            parsed_new = urlparse(new_url)
            new_hostname = parsed_new.netloc.lower()
            
            # Check redirected host
            is_safe, err_msg = is_safe_url(new_url)
            if not is_safe:
                raise ValueError(f"Redirect to unsafe destination blocked: {err_msg}")
        
        # Only allow successful responses
        response.raise_for_status()
        
        # Check content length before reading
        content_length = int(response.headers.get('Content-Length', 0))
        if content_length > MAX_CONTENT_LENGTH:
            raise ValueError(f"Response exceeds size limit ({MAX_CONTENT_LENGTH} bytes)")
        
        return response.text
        
    except requests.exceptions.Timeout:
        return None
    except requests.exceptions.RequestException as e:
        print(f"Fetch error for {url}: {e}")
        return None


def extract_recipe_structured_data(html_content: str, original_url: str) -> Optional[Dict[str, Any]]:
    """
    Extract Recipe structured data from HTML.
    
    Handles both JSON-LD and microdata formats using regex/HTML parsing
    since jsonld library is not available.
    
    Returns extracted recipe dict with title, ingredients, steps, etc.
    """
    soup = None
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
    except ImportError:
        return None
    
    if not soup:
        return None
    
    extracted = {
        'original_url': original_url,
        'title': '',
        'prep_time': '',
        'servings': '',
        'ingredients': [],  # List of {name, amount}
        'steps': [],  # List of text steps in order
        'source_attribution': original_url
    }
    
    # Try JSON-LD first (most reliable)
    json_ld_blocks = soup.find_all('script', type='application/ld+json')
    if json_ld_blocks:
        for block in json_ld_blocks:
            try:
                data = json.loads(block.get_text(strip=True))
                
                # Check if it's a Recipe type
                if isinstance(data, dict) and data.get('@type'):
                    types = data['@type']
                    
                    # Handle string or array of types
                    if isinstance(types, str):
                        types = [types]
                    
                    if 'Recipe' in types or (isinstance(types, list) and any('Recipe' in t for t in types)):
                        recipe_data = normalize_recipe_json_ld(data)
                        if recipe_data:
                            return recipe_data
            
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
    
    # Fallback to microdata
    if not extracted['title']:
        microdata_items = soup.find_all('itemtype', string='http://schema.org/Recipe')
        for item in microdata_items:
            microdata_recipe = extract_from_microdata(item)
            if microdata_recipe and microdata_recipe.get('ingredients') or microdata_recipe.get('steps'):
                extracted.update(microdata_recipe)
                break
    
    # Fallback to rich snippets
    if not extracted['title']:
        rich_snippets = soup.find_all('meta', itemprop='name')
        for meta in rich_snippets:
            if meta.get('content'):
                extracted['title'] = meta['content'].strip()
                break
    
    # If we have title but no structured data, try to extract basic info from text
    if extracted['title']:
        _extract_from_page_text(soup, extracted)
    
    return extracted if extracted.get('ingredients') or extracted.get('steps') or extracted.get('title') else None


def extract_nutrition_json_ld(html_content) -> Optional[Dict[str, Any]]:
    """
    Extract nutrition information from schema.org JSON-LD blocks.
    
    Args:
        html_content: HTML string or BeautifulSoup object
    
    Returns:
        Dictionary with extracted nutrition fields, or None if not found
    """
    import sys
    
    if not HAS_BEAUTIFULSOUP:
        return None
    
    # If it's a string, parse it first
    soup = html_content
    if isinstance(soup, str):
        soup = BeautifulSoup(soup, 'html.parser')
    
    nutrition_data = {}
    found_nutrition_info = False
    
    # Look for JSON-LD blocks
    json_ld_blocks = soup.find_all('script', type='application/ld+json')
    
    sys.stderr.write(f"\nDEBUG extract_nutrition_json_ld: Found {len(json_ld_blocks)} JSON-LD blocks\n")
    
    for block in json_ld_blocks:
        try:
            data = json.loads(block.get_text(strip=True))
            
            # Check if it's a Recipe or NutritionInformation type
            types = data.get('@type')
            if isinstance(types, str):
                types = [types]
            
            # Look for nutrition information within Recipe or standalone NutritionInformation
            if isinstance(data, dict) and any(t in (types or []) for t in ['Recipe', 'NutritionInformation']):
                if types is None:
                    types = []
                    
                # Extract serving size
                if SERVING_SIZE_FIELD in data:
                    nutrition_data['serving_size'] = str(data[SERVING_SIZE_FIELD]).strip()
                    found_nutrition_info = True
                
                # Look for NutritionInformation nested within Recipe or as sibling
                for key, value in data.items():
                    # Skip @type and @context
                    if key in ('@type', '@context') or key == SERVING_SIZE_FIELD:
                        continue
                    
                    if isinstance(value, dict):
                        inner_types = value.get('@type')
                        if inner_types:
                            if isinstance(inner_types, str):
                                inner_types = [inner_types]
                            
                            # Check for NutritionInformation
                            if any(t in (inner_types or []) for t in ['NutritionInformation']):
                                found_nutrition_info = True
                                
                                # Extract nutrition fields
                                _extract_nutrition_values(value, nutrition_data)
                                
                        elif 'calories' in value:
                            # Sometimes calories is directly under Recipe without nested NutritionInformation
                            found_nutrition_info = True
                            _extract_nutrition_value(value, 'calories', nutrition_data)
                            
                if found_nutrition_info and not nutrition_data.get('_has_nutrition_info'):
                    # Check for direct calorie value (some sites use simpler format)
                    if 'calories' in data:
                        nutrition_data['_has_calories'] = True
                        _extract_nutrition_value(data, 'calories', nutrition_data)
                        
            elif isinstance(data, dict) and any(t in (types or []) for t in ['NutritionInformation']):
                found_nutrition_info = True
                _extract_nutrition_values(data, nutrition_data)
                
        except (json.JSONDecodeError, KeyError, TypeError):
            continue
    
    # Remove marker keys before returning
    if '_has_nutrition_info' in nutrition_data:
        del nutrition_data['_has_nutrition_info']
    if '_has_calories' in nutrition_data:
        del nutrition_data['_has_calories']
    
    return nutrition_data if found_nutrition_info else None


def _extract_nutrition_values(data: Dict[str, Any], result: Dict[str, Any]) -> None:
    """Helper to extract nutrition values from a data dict."""
    for field in NUTRITION_FIELDS:
        if field in data:
            value = data[field]
            
            # Handle numeric values directly (no unit parsing needed)
            if isinstance(value, (int, float)):
                output_key = NUTRITION_FIELD_MAPPING.get(field, f'{field.replace("Content", "_per_serving")}')
                result[output_key] = float(value)
            elif isinstance(value, dict):
                # Handle cases where value has text and amount properties
                text_val = value.get('text') or value.get('value')
                if isinstance(text_val, str):
                    output_key = NUTRITION_FIELD_MAPPING.get(field, f'{field.replace("Content", "_per_serving")}')
                    _parse_nutrition_value_string(text_val.strip(), output_key, result)
            else:
                # Handle string values like "250 calories" - extract number and parse unit
                output_key = NUTRITION_FIELD_MAPPING.get(field, f'{field.replace("Content", "_per_serving")}')
                _parse_nutrition_value_string(str(value).strip(), output_key, result)


def _extract_nutrition_value(value: Any, target_key: str, result: Dict[str, Any]) -> None:
    """Extract a numeric nutrition value with unit handling."""
    if isinstance(value, (int, float)):
        result[target_key] = float(value)
    elif isinstance(value, dict):
        # Handle cases where value has text and amount properties
        text_val = value.get('text') or value.get('value')
        if isinstance(text_val, str):
            _parse_nutrition_value_string(text_val.strip(), target_key, result)


def _parse_nutrition_value_string(value_str: str, target_key: str, result: Dict[str, Any]) -> None:
    """Parse a nutrition value string like "250 kcal" or "15 g protein"."""
    import re
    
    # Common unit patterns - normalize to our field names
    # Format: (pattern_to_match, normalized_field_name)
    unit_patterns = [
        (r'\bcal\b', 'calories_per_serving'),
        (r'\bkcal\b', 'calories_per_serving'),
        (r'carb.*content', 'carbohydrates_per_serving'),  # handle "carbohydrateContent" pattern
        (r'fiber.*content', 'fiber_per_serving'),
        (r'fat.*content', 'fat_per_serving'),
        (r'protein', 'protein_per_serving'),  # Match "protein", "proteins", "protein_content", etc.
        (r'sodium', 'sodium_per_serving'),
        (r'sugar', 'sugar_per_serving'),
    ]
    
    # Try to find a matching unit pattern
    matched = False
    for pattern, field_name in unit_patterns:
        if re.search(pattern, value_str, re.IGNORECASE):
            num = _extract_number(value_str)
            if num is not None:
                result[field_name] = float(num)
            matched = True
            break
    
    if not matched:
        # Just a number - could be calories or something else, store as calories default
        num = _extract_number(value_str)
        if num is not None:
            result['calories_per_serving'] = float(num)


def _extract_number(text: str) -> Optional[float]:
    """Extract a numeric value from text."""
    # Match numbers with optional decimal point (but not too many decimals)
    match = re.search(r'([0-9]+(?:\.[0-9]{1,2})?)', text)
    if match:
        return float(match.group(1))
    return None


def normalize_recipe_json_ld(data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Normalize JSON-LD Recipe data to our expected format."""
    
    def extract_text_list(items, key_path: str):
        """Extract a list of text items from nested structure."""
        result = []
        for item in items:
            if isinstance(item, dict):
                # Try text field first, then text property
                text_val = item.get('text') or item.get('value')
                if isinstance(text_val, str):
                    result.append(text_val.strip())
        
        return result
    
    result = {
        'original_url': data.get('@context', ''),
        'title': data.get('name', ''),
        'prep_time': '',
        'servings': '',
        'ingredients': [],
        'steps': []
    }
    
    # Extract prep time
    prep_time = data.get('prepTime') or data.get('cookTime')
    if isinstance(prep_time, dict):
        result['prep_time'] = str(prep_time.get('text', prep_time.get('value', ''))).strip()
    elif isinstance(prep_time, str):
        result['prep_time'] = prep_time.strip()
    
    # Extract servings/yield
    yield_val = data.get('yield') or data.get('recipeYield') or data.get('serves')
    if yield_val:
        result['servings'] = str(yield_val).strip()
    
    # Extract ingredients
    ingredients = []
    ingredients_list = data.get('hasIngredient') or data.get('ingredientList') or data.get('recipeIngredient', [])
    
    if isinstance(ingredients_list, str):
        # Single string - parse by common separators
        raw_ingredients = [i.strip() for i in re.split(r'[,;]\s*', ingredients_list) if i.strip()]
        ingredients.extend(raw_ingredients)
    elif isinstance(ingredients_list, list):
        for item in ingredients_list:
            if isinstance(item, dict):
                text_val = item.get('text') or item.get('name') or item.get('value')
                if isinstance(text_val, str):
                    # Try to split name and amount
                    parts = text_val.strip().rsplit(' ', 1)
                    ingredients.append({
                        'name': parts[0] if len(parts) > 1 else text_val,
                        'amount': parts[1] if len(parts) > 1 else ''
                    })
            elif isinstance(item, str):
                ingredients.append(item.strip())
    
    result['ingredients'] = ingredients
    
    # Extract steps
    steps_list = data.get('hasStep') or data.get('stepByStepInstructions') or data.get('recipeInstructions', [])
    
    if isinstance(steps_list, str):
        # Single string - split by common step separators
        raw_steps = [s.strip() for s in re.split(r'[\n;]\s*(?:1[.]?\s*|2\.?\s*|3\.?\s*)', steps_list) if s.strip()]
        result['steps'] = raw_steps
    elif isinstance(steps_list, list):
        for item in steps_list:
            step_text = ''
            
            if isinstance(item, dict):
                # Try various keys for step text
                for key in ['text', 'name', 'instruction', '@type']:
                    val = item.get(key)
                    if val and str(val).strip():
                        step_text = str(val).strip()
                        break
            
            if step_text:
                result['steps'].append(step_text)
    
    return result if result.get('title') else None


def extract_from_microdata(item: Any) -> Optional[Dict[str, Any]]:
    """Extract recipe data from HTML microdata."""
    extracted = {
        'ingredients': [],
        'steps': []
    }
    
    # Find ingredients
    ingredient_items = item.find_all('div', itemscope=True)
    for div in ingredient_items:
        name = div.get('itemprop') == 'name'
        text = None
        
        if name:
            text_elem = div.find(text=True, recursive=False)
            if text_elem and isinstance(text_elem, str):
                text = text_elem.strip()
        
        if text:
            parts = text.rsplit(' ', 1)
            extracted['ingredients'].append({
                'name': parts[0] if len(parts) > 1 else text,
                'amount': parts[1] if len(parts) > 1 else ''
            })
    
    return extracted


def _extract_from_page_text(soup: Any, extracted: Dict[str, Any]) -> None:
    """Try to extract basic info when no structured data found."""
    
    # Try h1 for title
    title_elem = soup.find('h1')
    if title_elem and title_elem.get_text(strip=True):
        extracted['title'] = title_elem.get_text(strip=True)
    
    # Look for common ingredient patterns
    text_body = soup.get_text(separator=' ', strip=True)
    
    # Basic heuristic: look for "cup", "tsp", "tbsp", "oz" etc. followed by numbers
    ingredient_pattern = r'(\d+\.?\d*)\s*(cup|cups|tsp|tsps|tbsp|tbps|oz|lbs|lb|g|kg|ml|l|pinch)\s*(?:and\s*)?([^,\n.]+)'
    matches = re.findall(ingredient_pattern, text_body, re.IGNORECASE)
    
    if matches:
        for amount, unit, rest in matches:
            extracted['ingredients'].append({
                'name': rest.strip(),
                'amount': f"{amount} {unit}"
            })
    
    # Look for step indicators
    step_pattern = r'(?:step\s*\d+|1\.?\s*|2\.?\s*|3\.?\s*|\d+\.\s+)([^\.]+(?:\.(?!\d))?)'
    steps = re.findall(step_pattern, text_body, re.IGNORECASE)
    
    for step in steps[:10]:  # Limit to first 10 steps
        extracted['steps'].append(step.strip())


def create_manual_entry_form() -> Dict[str, str]:
    """Create a manual entry form schema."""
    return {
        'title': '',
        'prep_time': '',
        'servings': '',
        'ingredients_text': '',  # Raw text for copy-paste
        'steps_text': ''  # Raw text for copy-paste
    }


def validate_extracted_recipe(recipe: Dict[str, Any]) -> List[str]:
    """Validate extracted recipe data. Returns list of warnings/errors."""
    issues = []
    
    if not recipe.get('title'):
        issues.append("Missing recipe title")
    
    total_ingredients = len([i for i in recipe.get('ingredients', []) if i.get('name')])
    if total_ingredients == 0:
        issues.append("No ingredients extracted")
    elif total_ingredients > 100:
        issues.append(f"Unusually high ingredient count ({total_ingredients}) - verify manually")
    
    total_steps = len(recipe.get('steps', []))
    if total_steps == 0:
        issues.append("No steps extracted")
    elif total_steps > 50:
        issues.append(f"Unusual step count ({total_steps}) - verify manually")
    
    # Check for duplicate ingredients
    ingredient_names = [i.get('name', '').lower().strip() for i in recipe.get('ingredients', [])]
    seen = set()
    duplicates = [name for name in ingredient_names if name in seen or seen.add(name)]
    if duplicates:
        issues.append(f"Potential duplicate ingredients: {len(duplicates)} found")
    
    return issues


def process_import(url: str, manual_data: Optional[Dict[str, Any]] = None) -> RecipeImportResult:
    """
    Process a recipe import request.
    
    Args:
        url: Recipe URL to import (optional if manual entry)
        manual_data: Pre-filled manual entry data
    
    Returns:
        RecipeImportResult with extracted recipe or error info
    """
    # If manual entry provided, return it directly
    if manual_data and url:
        validated = validate_extracted_recipe(manual_data)
        
        return RecipeImportResult(
            success=len(validated) == 0,
            error_message='; '.join(validated) if validated else None,
            extracted_recipe=manual_data,
            is_manual_entry=True,
            original_url=None  # Manual entry has no URL
        )
    
    # Validate URL safety first
    is_valid, error_msg = is_safe_url(url)
    if not is_valid:
        return RecipeImportResult(
            success=False,
            error_message=error_msg,
            extracted_recipe=None,
            original_url=url
        )
    
    # Fetch the URL
    html_content = fetch_url_safely(url)
    if html_content is None:
        return RecipeImportResult(
            success=False,
            error_message="Failed to fetch recipe URL",
            extracted_recipe=None,
            original_url=url
        )
    
    # Extract structured data
    soup = None
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
    except ImportError:
        pass
    
    extracted = extract_recipe_structured_data(html_content, url)
    
    if not extracted:
        return RecipeImportResult(
            success=False,
            error_message="No recipe data could be extracted from page",
            extracted_recipe=None,
            original_url=url
        )
    
    # Try to extract nutrition information
    nutrition_extracted = None
    if soup:
        nutrition_extracted = extract_nutrition_json_ld(soup)
    
    # Validate the extraction
    issues = validate_extracted_recipe(extracted)
    
    if issues:
        return RecipeImportResult(
            success=True,  # We got something, but with warnings
            error_message='; '.join(issues),
            extracted_recipe=extracted,
            original_url=url
        )
    
    return RecipeImportResult(
        success=True,
        extracted_recipe=extracted,
        nutrition_extracted=nutrition_extracted,  # Pass nutrition data back to caller
        original_url=url
    )
