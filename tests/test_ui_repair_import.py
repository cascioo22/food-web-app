"""Synthetic JSON-LD and controlled-network fixtures, not live site evidence."""
import json
import unittest
from unittest.mock import patch
from import_service import extract_recipe, public_destination, fetch_recipe_html


def html(recipe):
    return '<script type="application/ld+json">' + json.dumps(recipe) + '</script>'


class ImportTests(unittest.TestCase):
    def test_graph_sections_preserve_lines_and_units(self):
        data = {'@graph': [{'@type': 'WebPage'}, {'@type': ['Recipe'], 'name': 'Test &amp; recipe',
                'recipeIngredient': ['2 cups flour, sifted', '1 egg'],
                'recipeInstructions': [{'@type': 'HowToSection', 'itemListElement': [{'text': 'Mix.'}, {'text': 'Bake.'}]}, 'Serve.'],
                'nutrition': {'calories': '240 kcal', 'proteinContent': '5 g', 'sodiumContent': '0.5 g'}}]}
        result = extract_recipe(html(data), 'https://example.com/original')
        self.assertEqual(result['ingredients_text'], '2 cups flour, sifted\n1 egg')
        self.assertEqual(result['steps_ordered'], 'Mix.\nBake.\nServe.')
        self.assertEqual(result['original_url'], 'https://example.com/original')
        self.assertEqual(result['nutrition']['protein_per_serving'], 5)
        self.assertEqual(result['nutrition']['sodium_per_serving'], 500)

    def test_unrelated_null_type_does_not_abort_valid_recipe(self):
        result = extract_recipe(html([{'@type': None}, {'@type': 'Recipe', 'name': 'Soup', 'recipeIngredient': ['Water'], 'recipeInstructions': ['Boil.']}]), 'https://example.com')
        self.assertEqual(result['title'], 'Soup')

    def test_incomplete_page_is_not_fabricated(self):
        with self.assertRaises(ValueError):
            extract_recipe('<h1>Not a recipe</h1>', 'https://example.com')

    def test_private_dns_resolution_is_rejected(self):
        with patch('socket.getaddrinfo', return_value=[(2, 1, 6, '', ('192.168.1.2', 80))]):
            with self.assertRaises(ValueError):
                public_destination('http://public-looking.example/recipe')

    def test_redirect_to_private_destination_is_rejected(self):
        class Response:
            status = 302
            def getheader(self, key):
                return 'http://127.0.0.1/secret' if key == 'Location' else None
        class Connection:
            def __init__(self, *args, **kwargs): pass
            def request(self, *args, **kwargs): pass
            def getresponse(self): return Response()
            def close(self): pass
        def resolve(host, *args, **kwargs):
            return [(2, 1, 6, '', ('127.0.0.1' if host == '127.0.0.1' else '93.184.216.34', 80))]
        with patch('socket.getaddrinfo', side_effect=resolve), patch('http.client.HTTPConnection', Connection):
            with self.assertRaisesRegex(ValueError, 'Private'):
                fetch_recipe_html('http://public.example/recipe')


if __name__ == '__main__':
    unittest.main()
