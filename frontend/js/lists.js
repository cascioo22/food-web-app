/* Grocery lists and every item change are persisted through the API. */
document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let lists = [], currentListId = null, editingItemId = null;
    async function api(path, method='GET', data) {
        const response = await fetch(path,{method,...(data === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
        const result = response.status === 204 ? null : await response.json();
        if (!response.ok) throw new Error(typeof result?.detail === 'string' ? result.detail : 'Request failed');
        return result;
    }
    function close(id) { $(id).classList.add('hidden'); document.body.style.overflow = $('list-modal').classList.contains('hidden') ? '' : 'hidden'; }
    function show(id) { $(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
    function renderItems() {
        const list = lists.find(l=>l.id===currentListId);
        $('items-list').innerHTML = (list?.items || []).map(i=>`<li class="grocery-item" data-id="${i.id}"><input class="item-check" type="checkbox" aria-label="Mark ${esc(i.name)} complete" ${i.completed?'checked':''}><button class="item-text" data-action="edit">${esc(i.name)}</button><button class="item-delete" data-action="delete" aria-label="Delete ${esc(i.name)}">×</button></li>`).join('');
        $('add-item-btn').disabled = !currentListId;
    }
    async function loadLists() {
        try {
            lists = await api('/grocery-lists');
            $('lists-container').innerHTML = lists.map(l=>`<article class="recipe-card list-card" data-id="${l.id}"><button class="list-open" data-action="open"><h3>${esc(l.name)}</h3><span>${l.items.filter(i=>i.completed).length}/${l.items.length} purchased</span></button><button data-action="delete" class="btn btn-secondary">Delete List</button></article>`).join('');
            document.querySelector('.empty-state').classList.toggle('hidden',!!lists.length);
            document.querySelector('.error-state').classList.add('hidden');
            if (currentListId) renderItems();
        } catch(error) { document.querySelector('.error-state').classList.remove('hidden'); }
    }
    function openList(id=null) {
        currentListId=id; editingItemId=null;
        $('list-name-input').value=lists.find(l=>l.id===id)?.name || '';
        $('save-list-btn').textContent=id?'Save Name':'Create List';
        close('item-edit-modal'); renderItems(); show('list-modal'); $('list-name-input').focus();
    }
    async function saveList() {
        const name=$('list-name-input').value.trim();
        if (!name) { $('list-name-input').focus(); return; }
        try {
            const list=await api(currentListId?`/grocery-lists/${currentListId}`:'/grocery-lists',currentListId?'PATCH':'POST',{name});
            currentListId=list.id;
            await loadLists();
            $('save-list-btn').textContent='Save Name'; $('add-item-btn').disabled=false;
        } catch(error) { alert(error.message); }
    }
    function openItem(item=null) {
        editingItemId=item?.id || null;
        $('item-edit-modal-title').textContent=item?'Edit Item':'Add Item';
        $('edit-item-name-input').value=item?.name || '';
        $('edit-item-completed-check').checked=item?.completed || false;
        show('item-edit-modal'); $('edit-item-name-input').focus();
    }
    $('add-list-btn').onclick=$('add-list-btn-inline').onclick=()=>openList();
    $('save-list-btn').onclick=saveList;
    $('list-name-input').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveList();}};
    $('close-list-modal').onclick=()=>close('list-modal');
    $('close-item-edit-modal').onclick=$('cancel-edit-item').onclick=()=>close('item-edit-modal');
    $('add-item-btn').onclick=()=>openItem();
    for(const id of ['list-modal','item-edit-modal']) $(id).addEventListener('click',e=>{if(e.target===$(id)||e.target.classList.contains('modal-backdrop'))close(id);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close(!$('item-edit-modal').classList.contains('hidden')?'item-edit-modal':'list-modal');});
    $('lists-container').onclick=async e=>{
        const card=e.target.closest('[data-id]'), action=e.target.closest('[data-action]')?.dataset.action;
        if(!card||!action)return;
        const id=Number(card.dataset.id);
        if(action==='open'){openList(id);return;}
        if(action==='delete'&&confirm('Delete this grocery list and its items?')){
            try{await api(`/grocery-lists/${id}`,'DELETE');await loadLists();}catch(error){alert(error.message);}
        }
    };
    $('items-list').onchange=async e=>{
        if(!e.target.matches('.item-check'))return;
        const id=Number(e.target.closest('[data-id]').dataset.id);
        try{await api(`/grocery-lists/${currentListId}/items/${id}`,'PATCH',{completed:e.target.checked});await loadLists();}catch(error){e.target.checked=!e.target.checked;alert(error.message);}
    };
    $('items-list').onclick=async e=>{
        const row=e.target.closest('[data-id]'), action=e.target.closest('[data-action]')?.dataset.action;
        if(!row||!action)return;
        const item=lists.find(l=>l.id===currentListId)?.items.find(i=>i.id===Number(row.dataset.id));
        if(action==='edit')openItem(item);
        else if(action==='delete'&&confirm('Delete this item?')){
            try{await api(`/grocery-lists/${currentListId}/items/${item.id}`,'DELETE');await loadLists();}catch(error){alert(error.message);}
        }
    };
    $('item-edit-modal').querySelector('form').onsubmit=async e=>{
        e.preventDefault(); const name=$('edit-item-name-input').value.trim(); if(!name)return;
        try{
            const path=`/grocery-lists/${currentListId}/items`;
            if(editingItemId)await api(`${path}/${editingItemId}`,'PATCH',{name,completed:$('edit-item-completed-check').checked});
            else {
                const item=await api(path,'POST',{name});
                if($('edit-item-completed-check').checked)await api(`${path}/${item.id}`,'PATCH',{completed:true});
            }
            close('item-edit-modal');await loadLists();
        }catch(error){alert(error.message);}
    };
    $('retry-lists-btn').onclick=loadLists;
    loadLists();
});
