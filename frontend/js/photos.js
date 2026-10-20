/* Server-backed photo gallery; failed uploads are never reported as saved. */
document.addEventListener('DOMContentLoaded',()=>{
    const $=id=>document.getElementById(id);
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let photos=[], selected=null;
    async function api(path,method='GET',data){
        const response=await fetch(path,{method,...(data instanceof FormData?{body:data}:data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
        const result=response.status===204?null:await response.json();
        if(!response.ok)throw new Error(typeof result?.detail==='string'?result.detail:`Request failed (${response.status})`);
        return result;
    }
    function close(){ $('photo-modal').classList.add('hidden');document.body.style.overflow='';selected=null; }
    async function loadPhotos(){
        try{
            photos=(await api('/photos')).photos;
            $('gallery-grid').innerHTML=photos.map(p=>`<button class="gallery-item" data-id="${p.id}" aria-label="View ${esc(p.caption||'food photo')}"><img src="${esc(p.thumbnail_url||p.url)}" alt="${esc(p.caption||'Food photo')}"></button>`).join('');
            $('gallery-empty').classList.toggle('hidden',!!photos.length);
            $('gallery-error').classList.add('hidden');
        }catch(error){$('gallery-error').classList.remove('hidden');}
    }
    $('gallery-grid').onclick=async e=>{
        const card=e.target.closest('[data-id]');if(!card)return;
        selected=photos.find(p=>p.id===Number(card.dataset.id));
        $('modal-image').src=selected.url;$('modal-image').alt=selected.caption||'Food photo';
        $('photo-modal-title').textContent=selected.caption||'Photo';$('caption-input').value=selected.caption||'';
        $('broken-image-fallback').classList.add('hidden');
        try{
            const recipes=await api('/recipes');
            $('photo-recipe-select').innerHTML='<option value="">No recipe</option>'+recipes.map(r=>`<option value="${r.id}">${esc(r.title)}</option>`).join('');
            $('photo-recipe-select').value=selected.recipe_id||'';
        }catch(error){alert(error.message);}
        $('photo-modal').classList.remove('hidden');document.body.style.overflow='hidden';
    };
    $('modal-image').onerror=()=>$('broken-image-fallback').classList.remove('hidden');
    $('close-photo-modal').onclick=close;
    $('photo-modal').onclick=e=>{if(e.target===$('photo-modal')||e.target.classList.contains('modal-backdrop'))close();};
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    $('upload-btn').onclick=$('upload-btn-inline').onclick=()=>$('file-input').click();
    $('file-input').onchange=async e=>{
        const file=e.target.files[0];if(!file)return;
        $('upload-btn').disabled=true;
        try{const data=new FormData();data.append('image',file);data.append('caption',file.name);await api('/photos','POST',data);await loadPhotos();}
        catch(error){alert(error.message);}
        finally{$('upload-btn').disabled=false;e.target.value='';}
    };
    $('save-caption-btn').onclick=async()=>{
        if(!selected)return;
        try{await api(`/photos/${selected.id}`,'PUT',{caption:$('caption-input').value,recipe_id:$('photo-recipe-select').value?Number($('photo-recipe-select').value):null});close();await loadPhotos();}
        catch(error){alert(error.message);}
    };
    $('unlink-recipe-btn').onclick=async()=>{
        if(!selected)return;
        try{await api(`/photos/${selected.id}`,'PUT',{recipe_id:null});close();await loadPhotos();}catch(error){alert(error.message);}
    };
    $('delete-photo-btn').onclick=async()=>{
        if(!selected||!confirm('Delete this photo?'))return;
        try{await api(`/photos/${selected.id}`,'DELETE');close();await loadPhotos();}catch(error){alert(error.message);}
    };
    $('retry-gallery-btn').onclick=loadPhotos;
    loadPhotos();
});
