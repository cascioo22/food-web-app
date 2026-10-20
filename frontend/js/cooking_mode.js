/* Distraction-free cooking with reversible, per-recipe progress. */
(() => {
    const $=id=>document.getElementById(id);
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const lines=s=>String(s||'').replace(/\\n/g,'\n').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    let recipe=null, progress={ingredients:{},steps:{}};
    function save(){localStorage.setItem(`fw_cooking_${recipe.id}`,JSON.stringify(progress));}
    function update(){
        const ingredientLines=lines(recipe.ingredients_text), steps=lines(recipe.steps_ordered);
        const count=ingredientLines.filter((_,i)=>progress.ingredients[i]).length+steps.filter((_,i)=>progress.steps[i]).length;
        const total=ingredientLines.length+steps.length;
        const percent=total?Math.round(count/total*100):0;
        $('progress-bar').style.width=`${percent}%`;
        $('progress-bar').setAttribute('aria-valuenow',percent);
        $('progress-bar').setAttribute('aria-label',`${count} of ${total} cooking tasks complete`);
    }
    function render(){
        $('recipe-title-display').textContent=recipe.title||recipe.name;
        $('ingredients-container').innerHTML=lines(recipe.ingredients_text).map((line,i)=>`<li class="ingredient-item ${progress.ingredients[i]?'completed':''}" data-index="${i}"><label><input class="ingredient-checkbox" type="checkbox" ${progress.ingredients[i]?'checked':''}> <span class="ingredient-text">${esc(line)}</span></label></li>`).join('');
        $('steps-container').innerHTML=lines(recipe.steps_ordered).map((line,i)=>`<li class="step-item ${progress.steps[i]?'completed':''}" data-index="${i}" tabindex="0" role="button" aria-pressed="${!!progress.steps[i]}"><span class="step-number-circle">${i+1}</span><span class="step-content">${esc(line)}</span></li>`).join('');
        update();
    }
    function toggleStep(item){
        const index=Number(item.dataset.index);progress.steps[index]=!progress.steps[index];
        item.classList.toggle('completed',!!progress.steps[index]);item.setAttribute('aria-pressed',!!progress.steps[index]);save();update();
    }
    document.addEventListener('DOMContentLoaded',async()=>{
        const id=Number(new URLSearchParams(location.search).get('recipe_id'));
        if(!id){location.href='index.html';return;}
        $('back-btn').onclick=()=>{location.href='index.html';};
        $('ingredients-container').onchange=e=>{
            const item=e.target.closest('[data-index]');if(!item)return;
            progress.ingredients[item.dataset.index]=e.target.checked;item.classList.toggle('completed',e.target.checked);save();update();
        };
        $('steps-container').onclick=e=>{const item=e.target.closest('[data-index]');if(item)toggleStep(item);};
        $('reset-progress-btn').onclick=()=>{if(confirm('Reset cooking progress for this recipe?')){progress={ingredients:{},steps:{}};save();render();}};
        document.addEventListener('keydown',e=>{
            if(e.key==='Escape'){location.href='index.html';return;}
            const targets=[...document.querySelectorAll('.ingredient-checkbox,.step-item')];
            if(e.key==='ArrowDown'||e.key==='ArrowUp'){
                e.preventDefault();let index=targets.indexOf(document.activeElement);index=(index+(e.key==='ArrowDown'?1:-1)+targets.length)%targets.length;targets[index]?.focus();
            }
            if((e.key==='Enter'||e.key===' ')&&document.activeElement.matches('.step-item')){e.preventDefault();toggleStep(document.activeElement);}
        });
        try{
            const response=await fetch(`/recipes/${id}`);if(!response.ok)throw new Error('Recipe not found');recipe=await response.json();
            try{const stored=JSON.parse(localStorage.getItem(`fw_cooking_${id}`)||'null');if(stored&&stored.ingredients&&stored.steps)progress=stored;}catch{/* Ignore malformed local progress, not recipe data. */}
            render();$('cooking-overlay').classList.remove('hidden');
        }catch(error){$('cooking-overlay').classList.remove('hidden');$('recipe-title-display').textContent=error.message;}
    });
})();
