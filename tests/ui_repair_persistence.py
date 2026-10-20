"""Create/check/clean fixture across Docker container recreation.
Run prepare, recreate both services without deleting volumes, then verify.
"""
import json
from pathlib import Path
import sys
import urllib.parse
import urllib.request
from test_ui_repair_api import request, BASE

state = Path('.qa/persistence-fixture.json')
if sys.argv[1] == 'prepare':
    _, recipe = request('POST', '/recipes/manual-entry/save', {'title':'Container persistence QA', 'ingredients_text':'Water', 'steps_ordered':'Boil.'})
    _, grocery = request('POST', '/grocery-lists', {'name':'Container persistence QA'})
    request('POST', f"/grocery-lists/{grocery['id']}/items", {'name':'Water'})
    form = urllib.parse.urlencode({'image_data':'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9qkAAAAASUVORK5CYII=', 'recipe_id':recipe['id'], 'caption':'Persistence QA'}).encode()
    with urllib.request.urlopen(urllib.request.Request(BASE+'/photos',data=form)) as response:
        photo=json.load(response)
    state.write_text(json.dumps({'recipe':recipe['id'],'list':grocery['id'],'photo':photo['id'],'url':photo['url']}))
    print('Created recipe, grocery item, linked photo for recreation check.')
else:
    data=json.loads(state.read_text())
    try:
        assert request('GET',f"/recipes/{data['recipe']}")[1]['title']=='Container persistence QA'
        assert request('GET',f"/grocery-lists/{data['list']}")[1]['items'][0]['name']=='Water'
        assert request('GET',f"/photos/{data['photo']}")[1]['recipe_id']==data['recipe']
        with urllib.request.urlopen(BASE+data['url']) as image:
            assert image.read() and image.headers.get_content_type()=='image/jpeg'
        print('PASS recipe, grocery item, linked photo metadata and image bytes survived container recreation.')
    finally:
        request('DELETE',f"/photos/{data['photo']}")
        request('DELETE',f"/recipes/{data['recipe']}")
        request('DELETE',f"/grocery-lists/{data['list']}")
        state.unlink()
