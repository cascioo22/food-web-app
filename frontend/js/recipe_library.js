/* Recipe library: API-backed editing, import review, grocery selection and photos. */
(() => {
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const lines = value => String(value || '').replace(/\\n/g, '\n').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    let recipes = [], currentRecipeId = null, ingredients = [], importedNutrition = null;
    const selected = new Set();

    async function api(path, method = 'GET', data) {
        const response = await fetch(path, {method, ...(data instanceof FormData ? {body: data} : data === undefined ? {} : {headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)})});
        const result = response.status === 204 ? null : await response.json();
        if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : result?.detail?.message || `Request failed (${response.status})`);
        return result;
    }
    function status(id, message = '', type = 'error') {
        const element = $(id);
        element.textContent = message;
        element.className = `status-message status-${type}${message ? '' : ' hidden'}`;
    }
    function show(id) { $(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
    function close(id) {
        $(id).classList.add('hidden');
        document.body.style.overflow = document.querySelector('.modal:not(.hidden),.import-modal:not(.hidden)') ? 'hidden' : '';
    }
    function fail(error) { alert(error.message); }
    async function loadRecipes() {
        $('library-error').classList.add('hidden');
        try {
            recipes = await api('/recipes');
            $('recipe-grid').classList.toggle('hidden', !recipes.length);
            $('library-empty').classList.toggle('hidden', !!recipes.length);
            $('recipe-grid').innerHTML = recipes.map(r => `<article class="recipe-card" data-id="${r.id}" tabindex="0" role="button" aria-label="Open ${esc(r.title)}">
                <div class="recipe-image-wrapper"><div class="recipe-placeholder" aria-hidden="true">🍽️</div></div>
                <div class="recipe-content"><h3 class="recipe-title">${esc(r.title)}</h3><div class="recipe-meta">${esc(r.prep_time)} ${esc(r.servings)}</div></div>
                <div class="recipe-actions"><button data-action="edit" aria-label="Edit recipe">Edit</button><button data-action="delete" aria-label="Delete recipe">Delete</button></div>
            </article>`).join('');
        } catch (error) {
            $('recipe-grid').innerHTML = '';
            $('library-empty').classList.add('hidden');
            $('library-error').classList.remove('hidden');
        }
    }
    function openImport() {
        $('url-import-form').reset(); $('manual-entry-form').reset();
        importedNutrition = null;
        status('import-status');
        $('manual-entry-form').classList.add('hidden');
        show('import-modal'); $('import-url').focus();
    }
    async function openRecipe(id) {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        currentRecipeId = id; selected.clear();
        $('modal-title').textContent = recipe.title;
        document.querySelector('.detail-meta .meta-item:nth-child(1) time').textContent = recipe.prep_time || '—';
        document.querySelector('.detail-meta .meta-item:nth-child(2) span:last-child').textContent = recipe.servings || '—';
        document.querySelector('.detail-meta .meta-item:nth-child(3) span:last-child').textContent = recipe.category || '—';
        $('steps-list').innerHTML = lines(recipe.steps_ordered).map(s => `<li>${esc(s)}</li>`).join('');
        $('step-progress').textContent = `${lines(recipe.steps_ordered).length} steps`;
        $('ingredients-list').innerHTML = '';
        $('source-attribution').classList.toggle('hidden', !recipe.original_url);
        $('source-url').textContent = recipe.original_url || '';
        $('source-url').href = /^https?:\/\//i.test(recipe.original_url || '') ? recipe.original_url : '#';
        $('source-url').rel = 'noopener noreferrer';
        show('recipe-modal');
        try {
            ingredients = await api(`/recipes/${id}/ingredients`);
            if (id !== currentRecipeId) return;
            $('ingredients-list').innerHTML = ingredients.map(i => `<li><label><input type="checkbox" data-id="${i.id}"> ${esc(i.name)}</label></li>`).join('');
            await Promise.all([loadPhotos(id), loadNutrition(id)]);
        } catch (error) { fail(error); }
    }
    function openEdit(id) {
        const recipe = recipes.find(r => r.id === id);
        if (!recipe) return;
        $('edit-recipe-id').value = id;
        for (const [field, input] of Object.entries({title:'title', prep_time:'prep', servings:'servings', category:'category', ingredients_text:'ingredients', steps_ordered:'steps'})) {
            $(`edit-${input}`).value = recipe[field] || '';
        }
        status('edit-status'); show('edit-modal'); $('edit-title').focus();
    }
    async function deleteRecipe(id) {
        if (!confirm('Delete this recipe? This cannot be undone.')) return;
        try { await api(`/recipes/${id}`, 'DELETE'); close('recipe-modal'); await loadRecipes(); } catch (error) { fail(error); }
    }
    async function loadPhotos(id) {
        $('gallery-loading').style.display = 'block';
        try {
            const photos = await api(`/recipes/${id}/photos`);
            if (id !== currentRecipeId) return;
            $('gallery-grid').innerHTML = photos.map(p => `<div class="photo-grid-item"><a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.thumbnail_url || p.url)}" alt="${esc(p.caption || 'Recipe photo')}"></a></div>`).join('');
            $('gallery-empty').classList.toggle('hidden', !!photos.length);
        } finally { $('gallery-loading').style.display = 'none'; }
    }
    async function loadNutrition(id) {
        // The recipe response already carries optional nutrition; opening is read-only.
        const recipe = await api(`/recipes/${id}`);
        if (id !== currentRecipeId) return;
        const nutrition = recipe.nutrition || {};
        $('nutrition-section').classList.remove('hidden');
        $('edit-nutrition-btn').classList.remove('hidden');
        const fields = [['Calories','calories_per_serving',''],['Protein','protein_per_serving','g'],['Carbs','carbohydrates_per_serving','g'],['Fat','fat_per_serving','g'],['Fiber','fiber_per_serving','g'],['Sugar','sugar_per_serving','g'],['Sodium','sodium_per_serving','mg']];
        $('nutrition-content').innerHTML = fields.some(([,key]) => nutrition[key] != null) ? (nutrition.serving_size ? `<p>Serving: ${esc(nutrition.serving_size)}</p>` : '') + fields.map(([label,key,unit]) => `<div class="nutrition-row"><span>${label}</span><span>${nutrition[key] == null ? '—' : esc(nutrition[key]) + ' ' + unit}</span></div>`).join('') : '<p>No nutrition information yet. You can add it below.</p>';
        const mapping = {'servings-size':'serving_size', 'calories-serv':'calories_per_serving','protein-serv':'protein_per_serving','carbs-serv':'carbohydrates_per_serving','fat-serv':'fat_per_serving','fiber-serv':'fiber_per_serving','sugar-serv':'sugar_per_serving','sodium-serv':'sodium_per_serving','calories-total':'calories_total'};
        // A late background response must not overwrite an editor the user is typing in.
        if (!$('nutrition-edit-modal').classList.contains('hidden')) return;
        for (const [input,key] of Object.entries(mapping)) $(`edit-${input}`).value = nutrition[key] ?? '';
        $('edit-nutrition-recipe-id').value = id;
    }
    async function chooseList() {
        if (!selected.size) { alert('Select at least one ingredient first.'); return; }
        try {
            const lists = await api('/grocery-lists');
            $('ingredient-picker-content').innerHTML = lists.length ? '<h3>Choose a Grocery List</h3>' + lists.map(l => `<button class="btn btn-secondary" data-list-id="${l.id}">${esc(l.name)}</button>`).join(' ') : '<p>No grocery lists yet. <a href="lists.html">Create a list first</a>.</p>';
            show('ingredient-picker');
        } catch (error) { fail(error); }
    }
    document.addEventListener('DOMContentLoaded', () => {
        for (const id of ['import-modal','recipe-modal','edit-modal','upload-modal','nutrition-edit-modal','ingredient-picker']) {
            $(id).addEventListener('click', e => {
                if (e.target === $(id) || e.target.classList.contains('modal-backdrop')) close(id);
            });
        }
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const open = ['ingredient-picker','nutrition-edit-modal','upload-modal','edit-modal','import-modal','recipe-modal'].find(id => !$(id).classList.contains('hidden'));
                if (open) close(open);
            }
        });
        $('add-recipe-btn').onclick = openImport;
        $('new-recipe-btn').onclick = openImport;
        $('close-import').onclick = () => close('import-modal');
        $('manual-entry-btn').onclick = () => { importedNutrition = null; $('manual-entry-form').classList.remove('hidden'); $('manual-title').focus(); };
        $('close-modal').onclick = () => close('recipe-modal');
        $('cancel-edit').onclick = () => close('edit-modal');
        $('cancel-upload').onclick = () => close('upload-modal');
        $('cancel-edit-nutrition').onclick = () => close('nutrition-edit-modal');
        $('close-ingredient-picker').onclick = () => close('ingredient-picker');
        $('retry-recipes-btn').onclick = loadRecipes;
        $('recipe-grid').addEventListener('click', e => {
            const card = e.target.closest('[data-id]'); if (!card) return;
            const id = Number(card.dataset.id), action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'edit') openEdit(id); else if (action === 'delete') deleteRecipe(id); else openRecipe(id);
        });
        $('recipe-grid').addEventListener('keydown', e => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.recipe-card')) { e.preventDefault(); openRecipe(Number(e.target.dataset.id)); }
        });
        $('ingredients-list').onchange = e => { const id = Number(e.target.dataset.id); if (e.target.checked) selected.add(id); else selected.delete(id); };
        $('edit-recipe-btn').onclick = $('edit-recipe-btn-footer').onclick = () => openEdit(currentRecipeId);
        $('delete-recipe-btn').onclick = () => deleteRecipe(currentRecipeId);
        $('start-cooking-btn').onclick = () => { location.href = `cooking.html?recipe_id=${currentRecipeId}`; };
        $('add-to-list').onclick = chooseList;
        $('select-ingredients-btn').onclick = () => {
            $('ingredient-picker-content').innerHTML = '<h3>Select Ingredients</h3>' + ingredients.map(i => `<p><label><input type="checkbox" data-ingredient-id="${i.id}" ${selected.has(i.id) ? 'checked' : ''}> ${esc(i.name)}</label></p>`).join('') + '<button id="choose-grocery-list" class="btn btn-primary">Choose List</button>';
            $('choose-grocery-list').onclick = chooseList; show('ingredient-picker');
        };
        $('ingredient-picker-content').onchange = e => {
            if (!e.target.matches('[data-ingredient-id]')) return;
            const id = Number(e.target.dataset.ingredientId);
            if (e.target.checked) selected.add(id); else selected.delete(id);
            const original = $('ingredients-list').querySelector(`[data-id="${id}"]`); if (original) original.checked = e.target.checked;
        };
        $('ingredient-picker-content').onclick = async e => {
            const button = e.target.closest('[data-list-id]'); if (!button) return;
            button.disabled = true;
            try {
                const result = await api(`/recipes/${currentRecipeId}/ingredients/add-to-list`, 'POST', {recipe_id:currentRecipeId, grocery_list_id:Number(button.dataset.listId), ingredient_ids:[...selected]});
                $('ingredient-picker-content').innerHTML = `<p role="status">Added ${result.added_count} ingredient(s). ${result.skipped_duplicates} duplicate(s) skipped.</p><a href="lists.html">View grocery lists</a>`;
            } catch (error) { fail(error); button.disabled = false; }
        };
        $('url-import-form').onsubmit = async e => {
            e.preventDefault(); const button = e.target.querySelector('button'); button.disabled = true;
            status('import-status', 'Importing…', 'warning');
            try {
                const result = await api('/recipes/import-url', 'POST', {url:$('import-url').value.trim()});
                importedNutrition = result.nutrition;
                for (const [field,input] of Object.entries({title:'title',prep_time:'prep',servings:'servings',category:'category',ingredients_text:'ingredients',steps_ordered:'steps'})) $(`manual-${input}`).value = result[field] || '';
                $('manual-entry-form').classList.remove('hidden');
                status('import-status', 'Review the imported recipe, then Save Recipe.', 'success');
            } catch (error) { importedNutrition = null; status('import-status', error.message + ' You can enter the recipe manually.'); $('manual-entry-form').classList.remove('hidden'); }
            finally { button.disabled = false; }
        };
        $('manual-entry-form').onsubmit = async e => {
            e.preventDefault(); const button = e.target.querySelector('[type="submit"]'); button.disabled = true;
            try {
                const data = Object.fromEntries(new FormData(e.target)); data.steps_ordered = data.steps_text; delete data.steps_text;
                data.original_url = $('import-url').value.trim();
                const saved = await api('/recipes/manual-entry/save', 'POST', data);
                if (importedNutrition && Object.keys(importedNutrition).length) await api(`/recipes/${saved.id}/nutrition`, 'PUT', importedNutrition);
                close('import-modal'); await loadRecipes();
            } catch (error) { status('import-status', error.message); }
            finally { button.disabled = false; }
        };
        $('edit-recipe-form').onsubmit = async e => {
            e.preventDefault();
            try {
                const id = Number($('edit-recipe-id').value), data = {};
                for (const [field,input] of Object.entries({title:'title',prep_time:'prep',servings:'servings',category:'category',ingredients_text:'ingredients',steps_ordered:'steps'})) data[field] = $(`edit-${input}`).value.trim();
                await api(`/recipes/${id}`, 'PUT', data); close('edit-modal'); await loadRecipes();
                if (!$('recipe-modal').classList.contains('hidden')) await openRecipe(id);
            } catch (error) { status('edit-status', error.message); }
        };
        $('add-photo-btn').onclick = () => { $('upload-recipe-id').value = currentRecipeId; status('upload-status'); show('upload-modal'); };
        $('upload-photo-form').onsubmit = async e => {
            e.preventDefault(); const file = $('photo-file').files[0]; if (!file) { status('upload-status','Select an image first.'); return; }
            const button = e.target.querySelector('[type="submit"]'); button.disabled = true;
            try { const data = new FormData(); data.append('image',file); data.append('caption',$('photo-caption').value); data.append('recipe_id',currentRecipeId); await api('/photos','POST',data); close('upload-modal'); e.target.reset(); await loadPhotos(currentRecipeId); }
            catch (error) { status('upload-status',error.message); } finally { button.disabled = false; }
        };
        $('edit-nutrition-btn').onclick = async () => {
            const id = currentRecipeId, button = $('edit-nutrition-btn');
            button.disabled = true;
            try {
                await loadNutrition(id);
                if (id === currentRecipeId && !$('recipe-modal').classList.contains('hidden')) {
                    status('nutrition-edit-status'); show('nutrition-edit-modal');
                }
            } catch (error) { fail(error); }
            finally { button.disabled = false; }
        };
        $('save-nutrition-changes').onclick = async () => {
            const data = {}, mapping = {'servings-size':'serving_size','calories-serv':'calories_per_serving','protein-serv':'protein_per_serving','carbs-serv':'carbohydrates_per_serving','fat-serv':'fat_per_serving','fiber-serv':'fiber_per_serving','sugar-serv':'sugar_per_serving','sodium-serv':'sodium_per_serving','calories-total':'calories_total'};
            for (const [input,key] of Object.entries(mapping)) { const value = $(`edit-${input}`).value.trim(); data[key] = value === '' ? null : key === 'serving_size' ? value : Number(value); }
            try { await api(`/recipes/${currentRecipeId}/nutrition`,'PUT',data); close('nutrition-edit-modal'); await loadNutrition(currentRecipeId); } catch (error) { status('nutrition-edit-status',error.message); }
        };
        loadRecipes();
    });
})();
