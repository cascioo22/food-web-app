"""Production-app regression tests, each using a new disposable SQLite database."""
import importlib
import json
import sqlite3
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
a = importlib.import_module('app')


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine(f'sqlite:///{tmp_path}/test.db', connect_args={'check_same_thread': False})
    monkeypatch.setattr(a, 'engine', engine)
    monkeypatch.setattr(a, 'PHOTO_UPLOAD_DIR', str(tmp_path / 'photos'))
    with TestClient(a.app) as c:
        yield c
    engine.dispose()


def new_list(c, name='Weekly groceries'):
    r = c.post('/grocery-lists', json={'name': name})
    assert r.status_code == 201, r.text
    return r.json()


def add(c, lid, **fields):
    r = c.post(f'/grocery-lists/{lid}/items', json={'name': 'Milk', **fields})
    assert r.status_code == 201, r.text
    return r.json()


def read(c, lid):
    return c.get(f'/grocery-lists/{lid}').json()


def test_crud_optional_fields_and_associations(client):
    c = client
    l = new_list(c)
    assert c.patch(f"/grocery-lists/{l['id']}", json={'name': 'Renamed'}).json()['name'] == 'Renamed'
    i = add(c, l['id'], quantity='a handful', unit='', category='Produce', notes='ripe')
    path = f"/grocery-lists/{l['id']}/items/{i['id']}"
    assert c.patch(path, json={'name': 'Avocado', 'completed': True, 'expected_version': i['version']}).status_code == 200
    assert c.patch(path, json={'name': 'Stale', 'expected_version': i['version']}).status_code == 409
    assert c.patch(path, json={'name': '   '}).status_code == 400
    other = new_list(c, 'Other')
    assert c.patch(f"/grocery-lists/{other['id']}/items/{i['id']}", json={'completed': False}).status_code == 404
    stored = read(c, l['id'])['items'][0]
    assert stored['completed'] and stored['quantity'] == 'a handful' and stored['notes'] == 'ripe'
    assert c.delete(f"/grocery-lists/{l['id']}").status_code == 204
    assert c.get(f"/grocery-lists/{l['id']}").status_code == 404


def test_list_and_item_order_is_durable_and_conflict_checked(client):
    c = client
    one, two = new_list(c, 'One'), new_list(c, 'Two')
    ids = [two['id'], one['id']]
    assert c.put('/grocery-lists/order', json={'ids': ids, 'expected_ids': ids[::-1]}).status_code == 200
    assert [l['id'] for l in c.get('/grocery-lists').json()] == ids
    assert c.put('/grocery-lists/order', json={'ids': ids[::-1], 'expected_ids': ids[::-1]}).status_code == 409
    items = [add(c, one['id'], name=name, completed=name == 'Eggs') for name in ['Milk','Eggs','Bread']]
    l = read(c, one['id'])
    reverse = [i['id'] for i in items[::-1]]
    path = f"/grocery-lists/{one['id']}/items/order"
    assert c.put(path, json={'ids': reverse,'expected_revision': l['revision']}).status_code == 200
    assert [i['id'] for i in read(c, one['id'])['items']] == reverse
    assert read(c, one['id'])['items'][1]['completed']
    assert c.put(path, json={'ids': reverse[::-1],'expected_revision': l['revision']}).status_code == 409
    assert c.put(path, json={'ids': [reverse[0], reverse[0]]}).status_code == 409
    # Dispose connections and read using a newly created engine: no in-memory order state.
    a.engine.dispose()
    assert [i['id'] for i in read(c, one['id'])['items']] == reverse


def test_bulk_atomic_retry_duplicate_keep_merge_and_validation(client):
    c = client
    l = new_list(c)
    path = f"/grocery-lists/{l['id']}/items/bulk"
    data = {'operation_id': 'one', 'items': [{'name': 'Milk'},{'name': 'Milk'},{'name': 'Eggs'}]}
    assert c.post(path, json=data).json()['added_count'] == 3
    assert c.post(path, json=data).json()['added_count'] == 3
    assert len(read(c,l['id'])['items']) == 3
    data['items'][0]['name'] = 'Changed'
    assert c.post(path,json=data).status_code == 409
    assert c.post(path,json={'operation_id':'invalid','items':[{'name':'Rice'},{'name':''}]}).status_code == 422
    assert len(read(c,l['id'])['items']) == 3
    add(c,l['id'],name='Rice',quantity='2',unit='lb')
    result = c.post(path,json={'operation_id':'merge','duplicate_policy':'merge','items':[{'name':'Rice','quantity':'3','unit':'lb'}]}).json()
    assert result['merged_count'] == 1 and result['list']['items'][-1]['quantity'] == '5'
    result = c.post(path,json={'operation_id':'ambiguous','duplicate_policy':'merge','items':[{'name':'Rice','quantity':'a handful','unit':'lb'}]}).json()
    assert result['added_count'] == 1


def test_delete_undo_clear_reset_duplicate_and_transfer(client):
    c=client
    l=new_list(c);target=new_list(c,'Target')
    one=add(c,l['id'],name='Milk',completed=True,quantity='1',notes='organic')
    two=add(c,l['id'],name='Bread')
    path=f"/grocery-lists/{l['id']}"
    assert c.delete(f"{path}/items/{one['id']}").status_code == 204
    assert len(read(c,l['id'])['items']) == 1
    restored=c.post(path+'/restore',json={'ids':[one['id']]}).json()
    assert [i['id'] for i in restored['items']] == [one['id'],two['id']]
    duplicate=c.post(path+'/duplicate').json()
    assert not any(i['completed'] for i in duplicate['items'])
    assert duplicate['items'][0]['notes'] == 'organic'
    result=c.post(path+'/clear-completed',json={'expected_revision':restored['revision']}).json()
    assert result['ids'] == [one['id']]
    restored=c.post(path+'/restore',json={'ids':result['ids']}).json()
    reset=c.post(path+'/reset',json={'expected_revision':restored['revision']}).json()['list']
    assert not any(i['completed'] for i in reset['items'])
    payload={'ids':[two['id']], 'target_list_id':target['id'],'copy':True,'expected_revision':reset['revision']}
    assert c.post(path+'/transfer',json=payload).status_code == 200
    assert len(read(c,l['id'])['items']) == 2 and len(read(c,target['id'])['items']) == 1
    payload.update(copy=False,expected_revision=read(c,l['id'])['revision'])
    assert c.post(path+'/transfer',json=payload).status_code == 200
    assert len(read(c,l['id'])['items']) == 1 and len(read(c,target['id'])['items']) == 2


def test_migrate_populated_database_backup_and_idempotence(tmp_path):
    from migrations import migrate
    path=tmp_path/'legacy.db'
    with sqlite3.connect(path) as db:
        db.executescript("CREATE TABLE grocery_lists (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE grocery_items (id INTEGER PRIMARY KEY,list_id INTEGER NOT NULL,name TEXT NOT NULL,completed BOOLEAN); INSERT INTO grocery_lists VALUES (7,'Old list'); INSERT INTO grocery_items VALUES (9,7,'Milk',1),(3,7,'Bread',0);")
    engine=create_engine(f'sqlite:///{path}')
    migrate(engine,a.Base.metadata)
    backups=list(tmp_path.glob('*.bak'));assert len(backups)==1
    with sqlite3.connect(backups[0]) as backup:
        assert backup.execute('SELECT COUNT(*) FROM grocery_items').fetchone()[0] == 2
        assert 'position' not in [r[1] for r in backup.execute('PRAGMA table_info(grocery_items)')]
    with sqlite3.connect(path) as db:
        assert db.execute('SELECT id,position,completed FROM grocery_items ORDER BY position').fetchall() == [(3,0,0),(9,1,1)]
    migrate(engine,a.Base.metadata)
    assert len(list(tmp_path.glob('*.bak'))) == 1
    from sqlalchemy.orm import Session
    with Session(engine) as db:
        db.query(a.GroceryItem).delete()
        db.query(a.GroceryList).delete()
        db.commit()
        new = a.GroceryList(name='After deletion')
        db.add(new)
        db.commit()
        assert new.id > 7


def test_recipe_exact_sequence_nutrition_notes_favorite_and_cover_validation(client):
    c=client
    payload={'title':'Soup','ingredients_text':'salt to taste\n2 cups stock','steps_ordered':'Heat.\nStir.\nServe.', 'description':'A good soup','cook_time':'15 min','servings':'2','nutrition':{'calories_per_serving':120,'sodium_total':800}}
    response=c.post('/recipes/manual-entry/save',json=payload)
    assert response.status_code==201,response.text
    recipe=response.json();rid=recipe['id']
    assert c.get(f'/recipes/{rid}').json()['nutrition']['sodium_total']==800
    updates={'ingredients_text':'2 cups stock\nsalt to taste','steps_ordered':'Stir.\nHeat.\nServe.','favorite':True,'notes':'Less salt next time'}
    assert c.put(f'/recipes/{rid}',json=updates).status_code==200
    stored=c.get(f'/recipes/{rid}').json()
    assert all(stored[k]==v for k,v in updates.items())
    assert stored['cook_time']=='15 min' and stored['nutrition']['calories_per_serving']==120
    assert c.put(f'/recipes/{rid}',json={'cover_photo_id':999}).status_code==400
    assert c.post('/recipes/manual-entry/save',json={**payload,'nutrition':{'calories_per_serving':-1}}).status_code==400
    assert len(c.get('/recipes').json())==1 # Nutrition failure rolls back the whole save.
    assert c.delete(f'/recipes/{rid}').status_code==204
    assert c.get(f'/recipes/{rid}/nutrition').status_code==404


def test_deleted_identifiers_are_not_reused_on_legacy_sqlite(client):
    c = client
    original = new_list(c)
    first_id = original['id']
    data = {'operation_id': 'before-deletion', 'items': [{'name': 'Milk'}]}
    assert c.post(f'/grocery-lists/{first_id}/items/bulk', json=data).status_code == 201
    assert c.delete(f'/grocery-lists/{first_id}').status_code == 204
    replacement = new_list(c)
    assert replacement['id'] > first_id
    assert c.post(f'/grocery-lists/{first_id}/items/bulk', json=data).status_code == 404
    r = c.post('/recipes/manual-entry/save', json={'title': 'Before'}).json()
    assert c.delete(f"/recipes/{r['id']}").status_code == 204
    next_r = c.post('/recipes/manual-entry/save', json={'title': 'After'}).json()
    assert next_r['id'] > r['id']


def test_reorder_rejects_concurrent_add_without_losing_it(client):
    c = client
    l = new_list(c)
    first = add(c, l['id'], name='First')
    stale = read(c, l['id'])
    second = add(c, l['id'], name='Added elsewhere')
    result = c.put(f"/grocery-lists/{l['id']}/items/order", json={'ids': [first['id']], 'expected_revision': stale['revision']})
    assert result.status_code == 409
    assert [i['id'] for i in read(c, l['id'])['items']] == [first['id'], second['id']]


def test_import_nutrition_units_and_uncertain_values():
    from import_service import extract_recipe
    data = {'@type': 'Recipe', 'name': 'Test soup', 'recipeIngredient': ['water'], 'recipeInstructions': 'Heat.',
            'nutrition': {'calories': '500 kJ', 'proteinContent': '1500mg', 'sodiumContent': '0.5g', 'fatContent': '-3 g'}}
    result = extract_recipe('<script type="application/ld+json">' + json.dumps(data) + '</script>', 'https://example.com/soup')
    assert result['nutrition']['protein_per_serving'] == 1.5
    assert result['nutrition']['sodium_per_serving'] == 500
    assert 'calories_per_serving' not in result['nutrition']
    assert 'fat_per_serving' not in result['nutrition']
    data['nutrition'] = 'Unavailable'
    result = extract_recipe('<script type="application/ld+json">' + json.dumps(data) + '</script>', 'https://example.com/soup')
    assert result['nutrition'] == {}
