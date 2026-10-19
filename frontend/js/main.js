/**
 * Food Webapp — Main JavaScript
 * Mobile-first, vanilla JS. All data stored in localStorage for MVP.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Recipe library initialization
    initRecipeLibrary();
});

function initRecipeLibrary() {
    const recipeGrid = document.getElementById('recipe-grid');
    const emptyState = document.querySelector('.empty-state');
    const errorState = document.querySelector('.error-state');
    const searchForm = document.getElementById('search-form');
    const categoryFilter = document.getElementById('category-filter');

    // Load recipes from localStorage or use mock data for demo
    let recipes = JSON.parse(localStorage.getItem('recipes') || '[]');

    if (recipes.length === 0) {
        // Mock recipe for demonstration
        recipes = [
            {
                id: '1',
                title: 'Classic Pancakes',
                image: '',
                prepTime: '10 min',
                servings: '4',
                category: 'breakfast',
                ingredients: [
                    { name: 'All-purpose flour', amount: '1 cup', checked: false },
                    { name: 'Milk', amount: '1 ¼ cups', checked: false },
                    { name: 'Egg', amount: '1', checked: false },
                    { name: 'Butter', amount: '3 tbsp', checked: false }
                ],
                steps: [
                    { text: 'Mix dry ingredients in a large bowl.', completed: false },
                    { text: 'Add wet ingredients and stir until smooth.', completed: false },
                    { text: 'Heat a griddle over medium heat.', completed: false },
                    { text: 'Pour batter and cook until bubbled, then flip.', completed: false }
                ]
            },
            {
                id: '2',
                title: 'Avocado Toast',
                image: '',
                prepTime: '5 min',
                servings: '2',
                category: 'breakfast',
                ingredients: [
                    { name: 'Bread', amount: '2 slices', checked: false },
                    { name: 'Avocado', amount: '1 ripe', checked: false },
                    { name: 'Lemon juice', amount: '1 tsp', checked: false }
                ],
                steps: [
                    { text: 'Toast the bread.', completed: false },
                    { text: 'Mash avocado with lemon juice.', completed: false },
                    { text: 'Spread on toast and serve.', completed: false }
                ]
            }
        ];
        localStorage.setItem('recipes', JSON.stringify(recipes));
    }

    // Render recipe grid
    function renderRecipes() {
        if (recipeGrid && recipes.length > 0) {
            recipeGrid.innerHTML = recipes.map(recipe => `
                <article class="recipe-card">
                    <div class="recipe-image-wrapper">
                        ${recipe.image ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}">` : ''}
                        ${!recipe.image ? `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;">📷</div>` : ''}
                    </div>
                    <div class="recipe-content">
                        <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
                        <div class="recipe-meta">
                            <span class="recipe-category">${capitalizeFirst(escapeHtml(recipe.category))}</span>
                            <span>⏱️ ${escapeHtml(recipe.prepTime)}</span>
                        </div>
                    </div>
                </article>
            `).join('');
        } else if (emptyState) {
            emptyState.classList.remove('hidden');
            errorState.classList.add('hidden');
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Capitalize first letter
    function capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Search and filter
    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = searchForm.querySelector('input[name="q"]').value.toLowerCase();
        const category = categoryFilter.value;
        
        const filtered = recipes.filter(recipe => {
            const matchesQuery = recipe.title.toLowerCase().includes(query);
            const matchesCategory = !category || recipe.category === category;
            return matchesQuery && matchesCategory;
        });

        // Store filtered state (simple implementation)
        sessionStorage.setItem('filteredRecipes', JSON.stringify(filtered));
    });

    // Initially render all recipes
    renderRecipes();

    // If there's a filtered session, show it
    const filtered = sessionStorage.getItem('filteredRecipes');
    if (filtered) {
        const data = JSON.parse(filtered);
        recipeGrid.innerHTML = data.map(recipe => `
            <article class="recipe-card">
                <div class="recipe-image-wrapper">
                    ${recipe.image ? `<img src="${escapeHtml(recipe.image)}" alt="${escapeHtml(recipe.title)}">` : ''}
                    ${!recipe.image ? `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;">📷</div>` : ''}
                </div>
                <div class="recipe-content">
                    <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
                    <div class="recipe-meta">
                        <span class="recipe-category">${capitalizeFirst(escapeHtml(recipe.category))}</span>
                        <span>⏱️ ${escapeHtml(recipe.prepTime)}</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    // Recipe detail modal - would be populated when clicking a card
    // This is a placeholder for future interaction
}

// Utility functions (can be expanded)
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}
