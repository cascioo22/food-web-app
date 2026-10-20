"""HTTP regressions; use a disposable server/database, never production data.
Run: FOOD_TEST_URL=http://host.docker.internal:18000 python -m unittest discover -s tests -p test_ui_repair_api.py -v
"""
import json
import os
import unittest
import urllib.error
import urllib.request
from typing import Any

BASE = os.environ.get('FOOD_TEST_URL', 'http://host.docker.internal:18000')


def request(method, path, data=None, headers=None) -> tuple[int, Any]:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, method=method,
                                 headers=headers or {'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw and response.headers.get_content_type() == 'application/json' else raw
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, raw.decode()


class RecipeRepairTests(unittest.TestCase):
    def test_manual_recipe_round_trip(self):
        payload = dict(title='UI regression recipe', ingredients_text='2 cups flour\n1 egg',
                       steps_ordered='Mix.\nBake.', prep_time='20 min', servings='2', category='dinner')
        status, saved = request('POST', '/recipes/manual-entry/save', payload)
        self.assertIn(status, (200, 201), saved)
        rid = saved['id']
        try:
            status, recipe = request('GET', f'/recipes/{rid}')
            self.assertEqual(status, 200, recipe)
            for key, value in payload.items():
                self.assertEqual(recipe[key], value, key)
            status, edited = request('PUT', f'/recipes/{rid}', {'title': 'Edited recipe', 'steps_ordered': 'Stir.\nServe.'})
            self.assertEqual(status, 200, edited)
            self.assertEqual(request('GET', f'/recipes/{rid}')[1]['title'], 'Edited recipe')
            self.assertEqual(request('GET', f'/recipes/{rid}/ingredients')[1][0]['name'], '2 cups flour')
        finally:
            request('DELETE', f'/recipes/{rid}')
        self.assertEqual(request('GET', f'/recipes/{rid}')[0], 404)


class GroceryRepairTests(unittest.TestCase):
    def test_list_and_item_crud_persist(self):
        status, saved = request('POST', '/grocery-lists', {'name': 'UI regression list'})
        self.assertEqual(status, 201, saved)
        lid = saved['id']
        try:
            self.assertIn(lid, [x['id'] for x in request('GET', '/grocery-lists')[1]])
            self.assertEqual(request('PATCH', f'/grocery-lists/{lid}', {'name': 'Renamed'})[0], 200)
            status, item = request('POST', f'/grocery-lists/{lid}/items', {'name': 'Milk'})
            self.assertEqual(status, 201, item)
            iid = item['id']
            self.assertEqual(request('PATCH', f'/grocery-lists/{lid}/items/{iid}', {'name': 'Oat milk', 'completed': True})[0], 200)
            stored = request('GET', f'/grocery-lists/{lid}')[1]
            self.assertEqual(stored['name'], 'Renamed')
            self.assertEqual(stored['items'][0]['name'], 'Oat milk')
            self.assertTrue(stored['items'][0]['completed'])
            self.assertEqual(request('DELETE', f'/grocery-lists/{lid}/items/{iid}')[0], 204)
            self.assertEqual(request('GET', f'/grocery-lists/{lid}')[1]['items'], [])
        finally:
            request('DELETE', f'/grocery-lists/{lid}')
        self.assertEqual(request('GET', f'/grocery-lists/{lid}')[0], 404)


class BulkRepairTests(unittest.TestCase):
    def test_bulk_add_writes_selected_items_and_deduplicates(self):
        _, recipe = request('POST', '/recipes/manual-entry/save', {'title': 'Bulk test', 'ingredients_text': '2 cups flour\n1 egg', 'steps_ordered': 'Mix.'})
        _, grocery = request('POST', '/grocery-lists', {'name': 'Bulk test'})
        rid, lid = recipe['id'], grocery['id']
        try:
            ingredients = request('GET', f'/recipes/{rid}/ingredients')[1]
            payload = {'recipe_id': rid, 'grocery_list_id': lid, 'ingredient_ids': [ingredients[1]['id']]}
            status, result = request('POST', f'/recipes/{rid}/ingredients/add-to-list', payload)
            self.assertEqual(status, 200, result)
            self.assertEqual(result['added_count'], 1)
            self.assertEqual(request('GET', f'/grocery-lists/{lid}')[1]['items'][0]['name'], '1 egg')
            self.assertEqual(request('POST', f'/recipes/{rid}/ingredients/add-to-list', payload)[1]['skipped_duplicates'], 1)
        finally:
            request('DELETE', f'/recipes/{rid}')
            request('DELETE', f'/grocery-lists/{lid}')


class PhotoRepairTests(unittest.TestCase):
    def test_photo_upload_image_caption_link_and_delete(self):
        import urllib.parse
        # Valid 1x1 PNG fixture (no external source or user photo).
        png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9qkAAAAASUVORK5CYII='
        _, recipe = request('POST', '/recipes/manual-entry/save', {'title': 'Photo test'})
        rid = recipe['id']
        photo_id = None
        try:
            req = urllib.request.Request(BASE + '/photos', data=urllib.parse.urlencode({'image_data': png, 'caption': 'Test dish', 'recipe_id': rid}).encode(), method='POST')
            try:
                with urllib.request.urlopen(req) as response:
                    photo = json.load(response)
                    status = response.status
            except urllib.error.HTTPError as error:
                self.fail(f'Photo upload returned {error.code}: {error.read().decode()}')
            self.assertEqual(status, 201, photo)
            photo_id = photo['id']
            self.assertEqual(request('GET', f'/recipes/{rid}/photos')[1][0]['id'], photo_id)
            with urllib.request.urlopen(BASE + photo['url']) as image:
                self.assertTrue(image.headers.get_content_type().startswith('image/'))
                self.assertTrue(image.read())
            self.assertEqual(request('PUT', f'/photos/{photo_id}', {'caption': 'Edited dish', 'recipe_id': None})[0], 200)
            stored = request('GET', '/photos')[1]['photos']
            stored = next(x for x in stored if x['id'] == photo_id)
            self.assertEqual(stored['caption'], 'Edited dish')
            self.assertIsNone(stored['recipe_id'])
            self.assertEqual(request('GET', f'/recipes/{rid}/photos')[1], [])
        finally:
            if photo_id:
                self.assertEqual(request('DELETE', f'/photos/{photo_id}')[0], 204)
                self.assertEqual(request('GET', f'/photos/{photo_id}')[0], 404)
            request('DELETE', f'/recipes/{rid}')


class ImportRepairTests(unittest.TestCase):
    def test_private_url_rejected_without_saving(self):
        for url in ['http://127.0.0.1/recipe', 'http://[::1]/recipe', 'file:///etc/passwd', 'http://user@localhost/recipe']:
            status, body = request('POST', '/recipes/import-url', {'url': url})
            self.assertEqual(status, 400, body)


class NutritionRepairTests(unittest.TestCase):
    def setUp(self):
        _, self.recipe = request('POST', '/recipes/manual-entry/save', {'title': 'Nutrition test'})
        self.path = f"/recipes/{self.recipe['id']}/nutrition"

    def tearDown(self):
        request('DELETE', f"/recipes/{self.recipe['id']}")

    def test_negative_update_rejected(self):
        self.assertIn(request('PUT', self.path, {'calories_per_serving': 100})[0], (200, 201))
        self.assertEqual(request('PUT', self.path, {'calories_per_serving': -1})[0], 400)
        self.assertEqual(request('GET', self.path)[1]['calories_per_serving'], 100)

    def test_clear_optional_value_and_recipe_deletion_cleanup(self):
        request('PUT', self.path, {'calories_per_serving': 100, 'protein_per_serving': 5})
        self.assertEqual(request('PUT', self.path, {'calories_per_serving': None})[0], 200)
        self.assertIsNone(request('GET', self.path)[1]['calories_per_serving'])
        self.assertEqual(request('GET', self.path)[1]['protein_per_serving'], 5)
        request('DELETE', f"/recipes/{self.recipe['id']}")
        self.assertEqual(request('GET', self.path)[0], 404)


if __name__ == '__main__':
    unittest.main()
