"""Bounded, public-only recipe fetching and JSON-LD extraction."""
import http.client
import ipaddress
import json
import re
import socket
import time
from urllib.parse import urljoin, urlsplit
from bs4 import BeautifulSoup

MAX_BYTES = 5 * 1024 * 1024


def public_destination(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password or len(url) > 2048:
        raise ValueError('A public HTTP(S) recipe URL is required')
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    except OSError as exc:
        raise ValueError('Recipe hostname could not be resolved') from exc
    ips = {entry[4][0] for entry in addresses}
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError('Private or restricted recipe destinations are blocked')
    return parsed, sorted(ips)[0]


def fetch_recipe_html(url):
    deadline = time.monotonic() + 30
    for _ in range(5):
        parsed, ip = public_destination(url)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ValueError('Recipe fetch timed out')
        connection_type = http.client.HTTPSConnection if parsed.scheme == 'https' else http.client.HTTPConnection
        port = parsed.port or (443 if parsed.scheme == 'https' else 80)
        connection = connection_type(parsed.hostname, port, timeout=min(10, remaining))
        # Pin the validated address but preserve hostname for TLS/SNI and Host.
        connection._create_connection = lambda address, timeout, source_address=None: socket.create_connection((ip, port), timeout, source_address)
        try:
            path = parsed.path or '/'
            if parsed.query:
                path += '?' + parsed.query
            connection.request('GET', path, headers={'User-Agent': 'FoodWebapp/1.0 recipe importer', 'Accept': 'text/html'})
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location:
                    raise ValueError('Recipe redirect has no destination')
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError(f'Recipe website returned HTTP {response.status}; use manual entry')
            if int(response.getheader('Content-Length') or 0) > MAX_BYTES:
                raise ValueError('Recipe page exceeds the 5 MB limit')
            chunks, size = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise ValueError('Recipe fetch timed out')
                connection.sock.settimeout(min(10, remaining)) if connection.sock else None
                chunk = response.read1(min(65536, MAX_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    raise ValueError('Recipe page exceeds the 5 MB limit')
                chunks.append(chunk)
            return b''.join(chunks).decode('utf-8', errors='replace')
        finally:
            connection.close()
    raise ValueError('Too many recipe redirects')


def extract_recipe(html, original_url):
    soup = BeautifulSoup(html, 'html.parser')

    def objects(value):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from objects(child)
        elif isinstance(value, list):
            for child in value:
                yield from objects(child)

    def text(value):
        return BeautifulSoup(str(value or ''), 'html.parser').get_text(' ', strip=True)

    def instructions(value):
        if isinstance(value, str):
            return [text(line) for line in value.splitlines() if line.strip()]
        if isinstance(value, list):
            return [line for child in value for line in instructions(child)]
        if isinstance(value, dict):
            if value.get('itemListElement'):
                return instructions(value['itemListElement'])
            return instructions(value.get('text') or value.get('name') or '')
        return []

    for block in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(block.string or block.get_text())
        except (ValueError, TypeError):
            continue
        for recipe in objects(data):
            types = recipe.get('@type') or []
            types = [types] if isinstance(types, str) else types
            if 'Recipe' not in types:
                continue
            ingredients = recipe.get('recipeIngredient') or []
            ingredients = ingredients.splitlines() if isinstance(ingredients, str) else ingredients
            steps = instructions(recipe.get('recipeInstructions'))
            if not recipe.get('name') or not ingredients or not steps:
                continue
            result = {'title': text(recipe['name']), 'ingredients_text': '\n'.join(text(i) for i in ingredients),
                      'steps_ordered': '\n'.join(steps), 'original_url': original_url,
                      'prep_time': text(recipe.get('prepTime') or recipe.get('totalTime')),
                      'cook_time': text(recipe.get('cookTime')), 'description': text(recipe.get('description')),
                      'servings': text(recipe.get('recipeYield')), 'category': text(recipe.get('recipeCategory'))}
            nutrition = recipe.get('nutrition') or {}
            if not isinstance(nutrition, dict):
                nutrition = {}
            fields = {'calories': 'calories_per_serving', 'proteinContent': 'protein_per_serving',
                      'carbohydrateContent': 'carbohydrates_per_serving', 'fatContent': 'fat_per_serving',
                      'fiberContent': 'fiber_per_serving', 'sugarContent': 'sugar_per_serving', 'sodiumContent': 'sodium_per_serving'}
            parsed_nutrition = {}
            for source, target in fields.items():
                value = str(nutrition.get(source, ''))
                match = re.search(r'[-+]?\d+(?:\.\d+)?', value)
                if match:
                    number = float(match.group())
                    if number < 0 or (target == 'calories_per_serving' and re.search(r'kj', value, re.I) and not re.search(r'kcal', value, re.I)):
                        continue
                    if target == 'sodium_per_serving' and re.search(r'(?<!m)g\b', value, re.I):
                        number *= 1000
                    elif target != 'calories_per_serving' and target != 'sodium_per_serving' and re.search(r'mg\b', value, re.I):
                        number /= 1000
                    parsed_nutrition[target] = number
            if nutrition.get('servingSize'):
                parsed_nutrition['serving_size'] = text(nutrition['servingSize'])
            result['nutrition'] = parsed_nutrition
            return result
    raise ValueError('No complete structured recipe found. Please enter or correct the recipe manually.')
