/**
 * Food Webapp — Recipe Library Module
 * Handles recipe import, review, edit, delete with backend connectivity
 */

(function() {
    const API_BASE = '/api';; // Local FastAPI server
    
    let recipes = [];
    let currentRecipeId = null;
    let selectedIngredientIds = new Set();  // Track checked ingredient IDs for bulk add

    document.addEventListener('DOMContentLoaded', () => {
        initRecipeLibrary();
    });

    function initRecipeLibrary() {
        setupEventListeners();
        loadRecipes();
    }

    function setupEventListeners() {
        // Modal toggles
        const importModal = document.getElementById('import-modal');
        if (importModal) {
            document.getElementById('add-recipe-btn').addEventListener('click', () => {
                importModal.classList.remove('hidden');
                showStatus(importModal, '', 'success');
            });
            
            importModal.querySelector('.modal-backdrop').addEventListener('click', () => {
                importModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
        }

        // Recipe modal toggles
        const recipeModal = document.getElementById('recipe-modal');
        if (recipeModal) {
            recipeModal.querySelector('.modal-backdrop').addEventListener('click', () => {
                recipeModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
            
            document.getElementById('close-modal')?.addEventListener('click', () => {
                recipeModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
        }

        // Edit modal
        const editModal = document.getElementById('edit-modal');
        if (editModal) {
            editModal.querySelector('.modal-backdrop').addEventListener('click', () => {
                editModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
            
            document.getElementById('cancel-edit')?.addEventListener('click', () => {
                editModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
        }

        // Form submissions
        document.getElementById('url-import-form').addEventListener('submit', handleUrlImport);
        document.getElementById('manual-entry-form').addEventListener('submit', handleManualEntry);
        document.getElementById('edit-recipe-form').addEventListener('submit', handleEditRecipe);

        // Recipe actions
        document.getElementById('edit-recipe-btn')?.addEventListener('click', () => {
            if (currentRecipeId) openEditModal(currentRecipeId);
        });
        
        document.getElementById('edit-recipe-btn-footer')?.addEventListener('click', () => {
            if (currentRecipeId) openEditModal(currentRecipeId);
        });
        
        document.getElementById('delete-recipe-btn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
                deleteRecipe(currentRecipeId);
            }
        });

        // Retry button
        document.getElementById('retry-recipes-btn')?.addEventListener('click', loadRecipes);

        // Start cooking button
        document.getElementById('start-cooking-btn')?.addEventListener('click', () => {
            if (currentRecipeId) startCookingMode();
        });

        // Ingredient checkboxes - toggle selection
        document.getElementById('ingredients-list').addEventListener('change', (e) => {
            const checkbox = e.target;
            if (checkbox.type === 'checkbox') {
                const idx = parseInt(checkbox.dataset.ingredientIndex);
                if (selectedIngredientIds.has(idx)) {
                    selectedIngredientIds.delete(idx);
                } else {
                    selectedIngredientIds.add(idx);
                }
            }
        });

        // Mark all checked button
        const markAllBtn = document.getElementById('mark-all-checked');
        if (markAllBtn && currentRecipeId) {
            markAllBtn.addEventListener('click', () => {
                // Reload recipe to get updated ingredient IDs
                loadRecipes(); 
                const recipe = recipes.find(r => r.id === currentRecipeId);
                if (recipe) {
                    openRecipeModal(currentRecipeId);
                }
            });
        }
    }

    /**
     * Add selected ingredients from current recipe to a grocery list
     */
    async function addToGroceryList() {
        if (!currentRecipeId) {
            alert('No recipe selected');
            return;
        }

        if (selectedIngredientIds.size === 0) {
            alert('No ingredients selected. Select at least one ingredient to add.');
            return;
        }

        // For now, just get available lists and show a message
        try {
            const response = await fetch(`${API_BASE}/grocery-lists`);
            
            if (response.ok) {
                const lists = await response.json();
                
                if (lists.length === 0) {
                    alert('No grocery lists found. Create a grocery list first, then select ingredients and click "Add to Grocery List".');
                } else {
                    // Show list selection
                    showGroceryListSelection(lists);
                }
            } else {
                alert('Grocery lists feature not yet available. This is expected in development.');
            }
        } catch (error) {
            console.error('Error fetching grocery lists:', error);
            alert('Failed to fetch grocery lists. Please ensure the backend server is running.');
        }
    }

    /**
     * Show a modal for selecting which grocery list to add ingredients to
     */
    function showGroceryListSelection(lists) {
        // Create a simple selection UI
        const existingModal = document.getElementById('list-modal');
        const closeBtn = document.getElementById('close-list-modal');
        
        // Reuse or create the modal
        if (!existingModal) {
            alert('Please ensure grocery list feature is implemented before using bulk add.');
            return;
        }

        // Populate with list options
        let html = '<h3>Select a Grocery List</h3>';
        lists.forEach(list => {
            html += `<div style="padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;" onclick="addToGroceryListByIndex(${list.id}, ${currentRecipeId})">`;
            html += `    <strong>${escapeHtml(list.name)}</strong>`;
            html += `<button style="margin-left: 12px; background: #c00; color: white; border: none; padding: 4px 8px;" onclick="event.stopPropagation(); return confirmDeleteList(${list.id})">🗑️</button>`;
            html += `</div>`;
        });
        html += `<button id="close-list-modal" style="margin-top: 12px;">Close</button>`;

        // Show the modal
        if (existingModal) {
            existingModal.querySelector('.modal-card').innerHTML = html;
            existingModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
            
            // Setup close button again
            document.getElementById('close-list-modal')?.addEventListener('click', () => {
                existingModal.classList.add('hidden');
                document.body.style.overflow = '';
            });
        }
    }

    /**
     * Show ingredient selection modal for preview and select
     */
    function showSelectIngredientsModal() {
        const recipe = recipes.find(r => r.id === currentRecipeId);
        if (!recipe) return;

        // Get structured ingredients
        fetch(`${API_BASE}/recipes/${currentRecipeId}/ingredients`)
            .then(res => res.json())
            .then(ingredients => {
                const existingModal = document.getElementById('list-modal');
                
                if (!existingModal) {
                    alert('Ingredient selection modal not available.');
                    return;
                }

                // Build ingredient list with checkboxes
                let html = '<h3>Select Ingredients to Add</h3>';
                html += '<p style="color: #666; font-size: 14px;">Select ingredients you want to add to your grocery list:</p>';
                
                ingredients.forEach((ing, idx) => {
                    const isChecked = selectedIngredientIds.has(idx) ? 'checked' : '';
                    html += `<div style="padding: 8px; margin: 4px 0; border: 1px solid #eee; border-radius: 4px;">`;
                    html += `<label><input type="checkbox" onchange="toggleIngredientSelection(${idx}, this.checked)" ${isChecked}> </label>`;
                    html += ` <strong>${escapeHtml(ing.name)}</strong>`;
                    if (ing.amount) {
                        html += ` (${escapeHtml(ing.amount)})`;
                    }
                    html += `</div>`;
                });

                html += `<hr style="margin: 12px 0;">`;
                html += `<p><strong>Selected:</strong> ${selectedIngredientIds.size} ingredient(s)</p>`;
                html += `<button id="close-list-modal" onclick="document.getElementById('list-modal').classList.add('hidden'); document.body.style.overflow='';">Close</button>`;

                existingModal.querySelector('.modal-card').innerHTML = html;
                existingModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            })
            .catch(err => {
                console.error('Error loading ingredients:', err);
                alert('Failed to load recipe ingredients.');
            });
    }

    /**
     * Toggle ingredient selection state
     */
    window.toggleIngredientSelection = function(idx, isChecked) {
        if (isChecked) {
            selectedIngredientIds.add(idx);
        } else {
            selectedIngredientIds.delete(idx);
        }
    };

    /**
     * Add ingredients to a specific grocery list (exposed globally for onclick)
     */
    window.addToGroceryListByIndex = async function(listId, recipeId) {
        // This would call the backend endpoint with selected ingredient IDs
        // For now, show a confirmation
        if (confirm(`Add ${selectedIngredientIds.size} ingredients to "${listId}"?\n\nThis is a demo - actual implementation pending grocery list backend.`)) {
            console.log(`Bulk adding ${selectedIngredientIds.size} ingredients from recipe ${recipeId} to grocery list ${listId}`);
            
            // TODO: Call /recipes/{recipeId}/ingredients/add-to-list endpoint
            // with ingredient_ids array
            
            alert('This is a demo. The bulk-add feature will be fully implemented when the grocery list backend is available.');
        }
    };

    /**
     * Delete a grocery list (placeholder)
     */
    window.confirmDeleteList = function(listId) {
        if (confirm(`Delete grocery list ${listId}?`)) {
            console.log(`Deleting grocery list ${listId}`);
            // TODO: Implement deletion
        }
    };

    function showStatus(container, message, type) {
        container.className = `status-message status-${type}`;
        if (message) container.textContent = message;
        else container.classList.add('hidden');
    }

    // Load recipes from backend
    async function loadRecipes() {
        const grid = document.getElementById('recipe-grid');
        if (!grid) return;

        try {
            showStatus(grid.querySelector('.loading-state'), '', 'success');
            hideEmptyAndErrorStates();

            const response = await fetch(`${API_BASE}/recipes`);
            if (!response.ok) throw new Error('Failed to load recipes');

            recipes = await response.json();
            renderRecipeGrid();
        } catch (error) {
            console.error('Error loading recipes:', error);
            hideEmptyAndErrorStates();
            document.querySelector('.error-state').classList.remove('hidden');
        }
    }

    function renderRecipeGrid() {
        const grid = document.getElementById('recipe-grid');
        if (!grid) return;

        if (recipes.length === 0) {
            document.querySelector('.empty-state').classList.remove('hidden');
            grid.classList.add('hidden');
            return;
        }

        hideEmptyAndErrorStates();
        grid.classList.remove('hidden');

        // Parse ingredients and steps for display
        const parsedRecipes = recipes.map(r => {
            let ingredientsText, stepsText;
            
            if (r.ingredients_text) {
                ingredientsText = parseIngredientsToLines(r.ingredients_text);
            } else if (r.ingredients && Array.isArray(r.ingredients)) {
                ingredientsText = r.ingredients.map(i => `${i.amount || ''} ${i.name}`).join('\\n');
            }

            if (r.steps_ordered) {
                stepsText = parseStepsToLines(r.steps_ordered);
            } else if (r.steps && Array.isArray(r.steps)) {
                stepsText = r.steps.join('\\n');
            }

            return { ...r, ingredientsText, stepsText };
        });

        grid.innerHTML = parsedRecipes.map(recipe => `
            <article class="recipe-card" data-id="${recipe.id}">
                <div class="recipe-actions">
                    <button aria-label="Edit recipe &#9998;">&#9998;</button>
                    <button aria-label="Delete recipe">&times;</button>
                </div>
                <div class="recipe-image-wrapper">
                    ${recipe.image_url ? `<img src="${escapeHtml(recipe.image_url)}" alt="${escapeHtml(recipe.title)}">` : ''}
                    ${!recipe.image_url ? `<div style="height:120px;display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;">📷</div>` : ''}
                </div>
                <div class="recipe-content">
                    <h3 class="recipe-title">${escapeHtml(recipe.title)}</h3>
                    <div class="recipe-meta">
                        ${recipe.prep_time ? `<span>&#8987; ${escapeHtml(recipe.prep_time)}</span>` : ''}
                        ${recipe.servings ? `<span>&#128101; ${escapeHtml(recipe.servings)}</span>` : ''}
                    </div>
                </div>
            </article>
        `).join('');

        // Add click handlers to cards
        grid.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', () => openRecipeModal(parseInt(card.dataset.id)));
            
            // Edit/delete buttons
            const editBtn = card.querySelector('[aria-label="Edit recipe"]');
            const deleteBtn = card.querySelector('[aria-label="Delete recipe"]');
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(parseInt(card.dataset.id));
                });
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
                        deleteRecipe(parseInt(card.dataset.id));
                    }
                });
            }
        });
    }

    function hideEmptyAndErrorStates() {
        document.querySelector('.empty-state')?.classList.add('hidden');
        document.querySelector('.error-state')?.classList.add('hidden');
    }

    // Handle URL import
    async function handleUrlImport(e) {
        e.preventDefault();
        const urlInput = document.getElementById('import-url');
        const form = document.getElementById('url-import-form');
        const manualForm = document.getElementById('manual-entry-form');
        
        const url = urlInput.value.trim();
        if (!url) {
            showStatus(form, 'Please enter a valid recipe URL.', 'error');
            return;
        }

        try {
            showStatus(form, '', 'success');
            
            // Validate URL first
            let validationResult;
            try {
                const validateResp = await fetch(`${API_BASE}/recipes/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'Temp Title',
                        ingredients: [{name: 'temp', amount: ''}],
                        steps: ['temp step']
                    })
                });
            } catch (err) {
                showStatus(form, 'Backend not available. Please start the server.', 'error');
                return;
            }

            // Import from URL
            const response = await fetch(`${API_BASE}/recipes/import-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) throw new Error('Import failed');

            const result = await response.json();

            if (result.success) {
                // Save the imported recipe
                const saveData = {
                    title: result.title || 'Untitled Recipe',
                    prep_time: result.prep_time || '',
                    servings: result.servings || '',
                    category: result.category || '',
                    original_url: url,
                    ingredients_text: result.ingredients ? formatIngredients(result.ingredients) : '',
                    steps_ordered: formatSteps(result.steps)
                };

                // Save via manual entry endpoint (handles source attribution)
                const saveResp = await fetch(`${API_BASE}/recipes/manual-entry/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(saveData)
                });

                if (!saveResp.ok) throw new Error('Failed to save imported recipe');
                
                showStatus(form, 'Recipe imported successfully!', 'success');
                importModal.classList.add('hidden');
                document.body.style.overflow = '';
                loadRecipes(); // Refresh list
                
                // Reset form
                form.reset();
            } else {
                if (result.is_manual_entry) {
                    manualForm.classList.remove('hidden');
                    showStatus(form, 'URL extraction failed. Please enter recipe details manually.', 'warning');
                } else {
                    showStatus(form, result.warnings?.[0] || 'Failed to import recipe. See warnings below.', 'error');
                    result.warnings?.forEach(w => console.warn('Import warning:', w));
                }
            }

        } catch (error) {
            console.error('Import error:', error);
            showStatus(form, `Error: ${error.message}`, 'error');
        }
    }

    // Handle manual entry
    async function handleManualEntry(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const saveData = {
            title: formData.get('title'),
            prep_time: formData.get('prep_time') || '',
            servings: formData.get('servings') || '',
            category: formData.get('category') || '',
            original_url: '', // Manual entry has no source URL
            ingredients_text: formData.get('ingredients_text'),
            steps_ordered: formData.get('steps_text')
        };

        try {
            const saveResp = await fetch(`${API_BASE}/recipes/manual-entry/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (!saveResp.ok) throw new Error('Failed to save recipe');

            showStatus(e.target, 'Recipe saved successfully!', 'success');
            importModal.classList.add('hidden');
            document.body.style.overflow = '';
            e.target.reset();
            loadRecipes(); // Refresh list
        } catch (error) {
            showStatus(e.target, `Error: ${error.message}`, 'error');
        }
    }

    // Save a recipe to backend
    async function saveRecipe(data) {
        const response = await fetch(`${API_BASE}/recipes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed to save recipe');
        
        return response.json();
    }

    // Open recipe detail modal
    function openRecipeModal(id) {
        currentRecipeId = id;
        const recipe = recipes.find(r => r.id === id);
        
        if (!recipe) {
            console.error('Recipe not found:', id);
            return;
        }

        // Populate modal content
        document.getElementById('modal-title').textContent = recipe.title;
        document.getElementById('recipe-image').src = recipe.image_url || '';
        document.getElementById('recipe-image').alt = recipe.title;
        
        if (recipe.prep_time) document.querySelector('.detail-meta .meta-item:nth-child(1) span').textContent = escapeHtml(recipe.prep_time);
        if (recipe.servings) document.querySelector('.detail-meta .meta-item:nth-child(2) span').textContent = escapeHtml(recipe.servings);
        if (recipe.category) document.querySelector('.detail-meta .meta-item:nth-child(3) span').textContent = capitalizeFirst(escapeHtml(recipe.category));

        // Parse and display ingredients
        const ingredientsList = parseIngredientsToLines(recipe.ingredients_text || '');
        document.getElementById('ingredients-list').innerHTML = ingredientsList.map((ing, idx) => {
            return `<li><input type="checkbox" data-ingredient-index="${idx}" aria-label="Select ${escapeHtml(ing)} for grocery list"> <span data-ingredient-text="${escapeHtml(ing)}">${escapeHtml(ing)}</span></li>`;
        }).join('');

        // Parse and display steps
        const stepsList = parseStepsToLines(recipe.steps_ordered || '');
        document.getElementById('steps-list').innerHTML = stepsList.map(step => 
            `<li>${step}</li>`
        ).join('');

        // Show/hide source attribution
        if (recipe.original_url) {
            document.getElementById('source-url').textContent = escapeHtml(recipe.original_url);
            document.getElementById('source-url').href = recipe.original_url;
            document.getElementById('source-attribution').classList.remove('hidden');
        } else {
            document.getElementById('source-attribution').classList.add('hidden');
        }

        // Toggle actions visibility
        const editBtnFooter = document.getElementById('edit-recipe-btn-footer');
        if (editBtnFooter) editBtnFooter.style.display = 'inline-block';

        recipeModal.classList.remove('hidden');
        
        // Show/hide nutrition section (will be populated after modal is visible)
        const nutritionSection = document.getElementById('nutrition-section');
        if (nutritionSection) {
            nutritionSection.classList.remove('hidden');
            // Load nutrition data asynchronously
            loadRecipeNutrition(id);
        }
    }

    // ========================================
    // NUTRITION HANDLING (Task t_627c2984)
    // ========================================
    function openEditModal(id) {
        currentRecipeId = id;
        const recipe = recipes.find(r => r.id === id);
        
        if (!recipe) {
            console.error('Recipe not found:', id);
            return;
        }

        document.getElementById('edit-recipe-id').value = recipe.id;
        document.getElementById('edit-title').value = recipe.title || '';
        document.getElementById('edit-prep').value = recipe.prep_time || '';
        document.getElementById('edit-servings').value = recipe.servings || '';
        document.getElementById('edit-category').value = recipe.category || '';
        document.getElementById('edit-ingredients').value = recipe.ingredients_text || '';
        document.getElementById('edit-steps').value = recipe.steps_ordered || '';

        editModal.classList.remove('hidden');
    }

    // Handle recipe edit
    async function handleEditRecipe(e) {
        e.preventDefault();
        
        const id = parseInt(document.getElementById('edit-recipe-id').value);
        if (!id) {
            showStatus(e.target, 'No recipe selected.', 'error');
            return;
        }

        const updateData = {
            title: document.getElementById('edit-title').value.trim(),
            prep_time: document.getElementById('edit-prep').value.trim(),
            servings: document.getElementById('edit-servings').value.trim(),
            category: document.getElementById('edit-category').value.trim(),
            ingredients_text: document.getElementById('edit-ingredients').value.trim(),
            steps_ordered: document.getElementById('edit-steps').value.trim()
        };

        try {
            const response = await fetch(`${API_BASE}/recipes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update recipe');

            showStatus(e.target, 'Recipe updated successfully!', 'success');
            
            // Refresh the list and close modal
            editModal.classList.add('hidden');
            document.body.style.overflow = '';
            loadRecipes();

        } catch (error) {
            showStatus(e.target, `Error: ${error.message}`, 'error');
        }
    }
    
    // Delete a recipe
    async function deleteRecipe(id) {
        try {
            const response = await fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' });
            
            if (response.ok) {
                showStatus(document.getElementById('recipe-modal'), 'Recipe deleted.', 'success');
                
                // Close modals and refresh
                document.getElementById('recipe-modal').classList.add('hidden');
                editModal.classList.add('hidden');
                document.body.style.overflow = '';
                loadRecipes();
            } else {
                throw new Error('Failed to delete recipe');
            }

        } catch (error) {
            console.error('Delete error:', error);
            alert(`Error deleting recipe: ${error.message}`);
        }
    }

    // Start cooking mode
    function startCookingMode() {
        window.location.href = `cooking.html?recipe_id=${currentRecipeId}`;
    }

    // ========================================
    // PHOTO HANDLING (FW-09)
    // ========================================

    let photoGalleryData = null;

    // Open photo upload modal for current recipe
    document.getElementById('add-photo-btn')?.addEventListener('click', () => {
        if (currentRecipeId) {
            document.getElementById('upload-recipe-id').value = currentRecipeId;
            document.getElementById('upload-modal').classList.remove('hidden');
        }
    });

    // Upload photo form submission
    document.getElementById('upload-photo-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const recipeId = parseInt(document.getElementById('upload-recipe-id').value);
        const fileInput = document.getElementById('photo-file');
        const caption = document.getElementById('photo-caption').value.trim() || 'Untitled photo';
        
        if (!fileInput.files[0]) {
            alert('Please select a photo to upload.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            formData.append('caption', caption);
            
            // Show loading state
            const statusDiv = document.getElementById('upload-status');
            if (statusDiv) statusDiv.textContent = 'Uploading...';
            statusDiv.classList.remove('hidden', 'status-error');

            const response = await fetch(`${API_BASE}/photos`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
            
            const result = await response.json();
            
            if (result.success || result.message === 'Image processed successfully') {
                showStatus(document.getElementById('upload-photo-form'), 'Photo uploaded successfully!', 'success');
                document.getElementById('upload-modal').classList.add('hidden');
                
                // Refresh recipe modal to show new photo
                const recipeModal = document.getElementById('recipe-modal');
                if (recipeModal) {
                    loadRecipePhotos(recipeId);
                }

                e.target.reset();
            } else {
                showStatus(document.getElementById('upload-photo-form'), result.detail || 'Upload failed', 'error');
            }
        } catch (error) {
            console.error('Photo upload error:', error);
            showStatus(document.getElementById('upload-photo-form'), `Error: ${error.message}`, 'error');
        }
    });

    // Cancel upload
    document.getElementById('cancel-upload')?.addEventListener('click', () => {
        document.getElementById('upload-modal').classList.add('hidden');
        document.getElementById('upload-photo-form')?.reset();
    });

    // Load photos for a specific recipe
    async function loadRecipePhotos(recipeId) {
        const galleryGrid = document.getElementById('gallery-grid');
        const galleryEmpty = document.getElementById('gallery-empty');
        const galleryLoading = document.getElementById('gallery-loading');
        const galleryTitle = document.getElementById('gallery-title');

        if (!galleryGrid || !currentRecipeId) return;

        galleryLoading.style.display = 'block';
        galleryEmpty.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE}/recipes/${encodeURIComponent(currentRecipeId)}/photos`);
            
            if (response.ok) {
                photoGalleryData = await response.json();
                
                // Update gallery title with recipe name
                const recipe = recipes.find(r => r.id === currentRecipeId);
                if (recipe) {
                    galleryTitle.textContent = `${recipe.title} — Photos`;
                } else {
                    galleryTitle.textContent = 'Photos';
                }

                renderPhotoGallery();
            } else if (response.status === 404) {
                photoGalleryData = [];
                galleryEmpty.classList.remove('hidden');
                renderPhotoGallery();
            } else {
                throw new Error(`Failed to load photos: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading recipe photos:', error);
            galleryLoading.style.display = 'none';
            
            // Show empty state on error
            if (galleryEmpty) {
                galleryEmpty.classList.remove('hidden');
                renderPhotoGallery();
            }
        }
    }

    // Render photo gallery grid
    function renderPhotoGallery() {
        const galleryGrid = document.getElementById('gallery-grid');
        
        if (!galleryGrid || !photoGalleryData) return;

        galleryLoading.style.display = 'none';

        if (photoGalleryData.length === 0) {
            const galleryEmpty = document.getElementById('gallery-empty');
            if (galleryEmpty) galleryEmpty.classList.remove('hidden');
            return;
        }

        // Hide empty state when photos exist
        const galleryEmpty = document.getElementById('gallery-empty');
        if (galleryEmpty) galleryEmpty.classList.add('hidden');

        galleryGrid.innerHTML = photoGalleryData.map(photo => `
            <div class="photo-grid-item" data-photo-id="${photo.id}">
                <img src="${escapeHtml(photo.url || '')}" 
                     alt="${escapeHtml(photo.caption || 'Recipe photo')}">
                
                ${photo.caption ? `<div class="photo-caption">${escapeHtml(photo.caption)}</div>` : ''}
                
                <!-- Photo actions -->
                <div class="photo-actions" data-photo-id="${photo.id}">
                    <button aria-label="View full size" title="View full size">🔍</button>
                    <button aria-label="Delete photo" style="color:#c00;" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');

        // Add click handlers for photo actions
        galleryGrid.querySelectorAll('.photo-grid-item').forEach(item => {
            const photoId = parseInt(item.dataset.photoId);
            
            // Full size view
            item.querySelector('[aria-label="View full size"]').addEventListener('click', () => {
                openFullSizePhoto(photoId);
            });

            // Delete photo
            item.querySelector('button[title="Delete"]').addEventListener('click', async () => {
                if (!confirm('Delete this photo?')) return;
                
                try {
                    const response = await fetch(`${API_BASE}/photos/${encodeURIComponent(photoId)}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        // Reload gallery
                        await loadRecipePhotos(currentRecipeId);
                    } else {
                        alert('Failed to delete photo. Please try again.');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    alert(`Error deleting photo: ${error.message}`);
                }
            });
        });
    }

    // Open full-size photo view (simple overlay for now)
    function openFullSizePhoto(photoId) {
        const photo = photoGalleryData?.find(p => p.id == photoId);
        if (!photo) return;

        // Create temporary modal-like overlay
        const galleryGrid = document.getElementById('gallery-grid');
        if (!galleryGrid || !currentRecipeId) return;

        const fullSizeOverlay = document.createElement('div');
        fullSizeOverlay.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,0.9);z-index:1000;display:flex;
            align-items:center;justify-content:center;
        `;
        
        const fullSizeImage = document.createElement('img');
        fullSizeImage.src = photo.url || '';
        fullSizeImage.style.maxWidth = '90%';
        fullSizeImage.style.maxHeight = '90vh';
        fullSizeImage.style.borderRadius = '8px';
        
        const closeOverlay = document.createElement('button');
        closeOverlay.textContent = '✕';
        closeOverlay.style.cssText = `
            position:absolute;top:16px;right:16px;
            background:#fff;color:#333;border:none;padding:8px 12px;
            border-radius:4px;font-size:16px;cursor:pointer;z-index:1001;
        `;

        fullSizeOverlay.appendChild(fullSizeImage);
        fullSizeOverlay.appendChild(closeOverlay);
        
        document.body.appendChild(fullSizeOverlay);
        
        closeOverlay.addEventListener('click', () => {
            fullSizeOverlay.remove();
        });

        // Close on backdrop click
        fullSizeOverlay.addEventListener('click', (e) => {
            if (e.target === fullSizeOverlay) fullSizeOverlay.remove();
        });
    }

    // Utility functions (moved inside IIFE)
    function formatSteps(steps) {
        return steps.map((step, i) => `${i + 1}. ${step}`).join('\\n');
    }

    function parseIngredientsToLines(text) {
        return (text || '').split('\\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    function parseStepsToLines(text) {
        return (text || '').split('\\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    // Escape HTML utility
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();

/* ========================================
   NUTRITION HANDLING (Task t_627c2984)
   ======================================== */

// Nutrition display state
let currentNutritionData = null;

// Open nutrition edit modal
document.getElementById('edit-nutrition-btn')?.addEventListener('click', () => {
    if (!currentRecipeId || !currentNutritionData) return;
    
    // Populate form with existing data
    document.getElementById('edit-nutrition-recipe-id').value = currentRecipeId;
    document.getElementById('edit-servings-size').value = currentNutritionData.serving_size || '';
    document.getElementById('edit-calories-serv').value = currentNutritionData.calories_per_serving ?? '';
    document.getElementById('edit-protein-serv').value = currentNutritionData.protein_per_serving ?? '';
    document.getElementById('edit-carbs-serv').value = currentNutritionData.carbohydrates_per_serving ?? '';
    document.getElementById('edit-fat-serv').value = currentNutritionData.fat_per_serving ?? '';
    document.getElementById('edit-fiber-serv').value = currentNutritionData.fiber_per_serving ?? '';
    document.getElementById('edit-sugar-serv').value = currentNutritionData.sugar_per_serving ?? '';
    document.getElementById('edit-sodium-serv').value = currentNutritionData.sodium_per_serving ?? '';
    document.getElementById('edit-calories-total').value = currentNutritionData.calories_total ?? '';
    
    // Show modal
    document.getElementById('nutrition-edit-modal').classList.remove('hidden');
});

// Cancel edit nutrition
document.getElementById('cancel-edit-nutrition')?.addEventListener('click', () => {
    document.getElementById('nutrition-edit-modal').classList.add('hidden');
    document.getElementById('nutrition-edit-status').textContent = '';
    document.getElementById('nutrition-edit-status').classList.add('hidden');
});

// Handle nutrition edit form submit
document.getElementById('save-nutrition-changes')?.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const recipeId = parseInt(document.getElementById('edit-nutrition-recipe-id').value);
    if (!recipeId) return;
    
    const updateData = {
        serving_size: document.getElementById('edit-servings-size').value.trim() || null,
        calories_per_serving: parseNumberValue(document.getElementById('edit-calories-serv')),
        protein_per_serving: parseNumberValue(document.getElementById('edit-protein-serv')),
        carbohydrates_per_serving: parseNumberValue(document.getElementById('edit-carbs-serv')),
        fat_per_serving: parseNumberValue(document.getElementById('edit-fat-serv')),
        fiber_per_serving: parseNumberValue(document.getElementById('edit-fiber-serv')),
        sugar_per_serving: parseNumberValue(document.getElementById('edit-sugar-serv')),
        sodium_per_serving: parseNumberValue(document.getElementById('edit-sodium-serv')),
        calories_total: parseNumberValue(document.getElementById('edit-calories-total'))
    };
    
    try {
        document.getElementById('nutrition-edit-status').textContent = 'Saving...';
        document.getElementById('nutrition-edit-status').classList.remove('hidden');
        
        const response = await fetch(`${API_BASE}/recipes/${recipeId}/nutrition`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail?.message || 'Failed to save nutrition');
        }
        
        document.getElementById('nutrition-edit-status').textContent = 'Saved successfully!';
        document.getElementById('nutrition-edit-status').className = 'status-message status-success';
        
        // Reload recipe data
        loadRecipes();
        
        setTimeout(() => {
            document.getElementById('nutrition-edit-modal').classList.add('hidden');
            document.getElementById('nutrition-edit-status').textContent = '';
            document.getElementById('nutrition-edit-status').classList.add('hidden');
        }, 1500);
        
    } catch (error) {
        document.getElementById('nutrition-edit-status').textContent = error.message;
        document.getElementById('nutrition-edit-status').className = 'status-message status-error';
        console.error('Nutrition update error:', error);
    }
});

// Parse number value from input (empty string = null)
function parseNumberValue(inputElement) {
    const value = inputElement.value.trim();
    if (value === '' || value === '-') return null;
    
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
}

// Load and display nutrition for current recipe
async function loadRecipeNutrition(recipeId) {
    try {
        const response = await fetch(`${API_BASE}/recipes/${recipeId}/nutrition`);
        
        if (!response.ok) {
            // No nutrition data exists yet - create empty record
            const createResp = await fetch(`${API_BASE}/recipes/${recipeId}/nutrition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})  // Empty object creates placeholder
            });
            
            if (createResp.ok) {
                currentNutritionData = null;  // Will be displayed as "none"
                renderNutritionSection();
                return;
            }
        }
        
        const nutrition = await response.json();
        currentNutritionData = nutrition;
        renderNutritionSection();
        
    } catch (error) {
        console.error('Error loading nutrition:', error);
        // Create placeholder record on error
        try {
            await fetch(`${API_BASE}/recipes/${recipeId}/nutrition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
        } catch (e) {
            console.error('Failed to create nutrition placeholder:', e);
        }
    }
}

// Render nutrition section in recipe modal
function renderNutritionSection() {
    const contentDiv = document.getElementById('nutrition-content');
    const editBtn = document.getElementById('edit-nutrition-btn');
    
    if (!contentDiv || !editBtn) return;
    
    // Hide section if no nutrition data exists
    if (!currentNutritionData) {
        contentDiv.setAttribute('data-status', 'none');
        editBtn.classList.add('hidden');
        return;
    }
    
    // Check if there's any data available
    const hasData = Object.values(currentNutritionData).some(v => v !== null && v !== undefined);
    const hasPartialData = Object.values(currentNutritionData).some(v => v !== null && v !== undefined && v !== '');
    
    if (hasData) {
        contentDiv.removeAttribute('data-status');
        editBtn.classList.remove('hidden');
        
        // Render nutrition rows
        const nutrients = [
            { label: 'Calories', value: currentNutritionData.calories_per_serving ?? null, unit: '' },
            { label: 'Protein', value: currentNutritionData.protein_per_serving ?? null, unit: 'g' },
            { label: 'Carbs', value: currentNutritionData.carbohydrates_per_serving ?? null, unit: 'g' },
            { label: 'Fat', value: currentNutritionData.fat_per_serving ?? null, unit: 'g' },
            { label: 'Fiber', value: currentNutritionData.fiber_per_serving ?? null, unit: 'g' },
            { label: 'Sugar', value: currentNutritionData.sugar_per_serving ?? null, unit: 'g' },
            { label: 'Sodium', value: currentNutritionData.sodium_per_serving ?? null, unit: 'mg' }
        ];
        
        if (currentNutritionData.serving_size) {
            const servingDiv = document.createElement('div');
            servingDiv.style.marginBottom = '8px';
            servingDiv.style.fontStyle = 'italic';
            servingDiv.style.fontSize = '0.9rem';
            servingDiv.textContent = `Serving: ${currentNutritionData.serving_size}`;
            contentDiv.appendChild(servingDiv);
        }
        
        let html = '';
        nutrients.forEach(nutrient => {
            if (nutrient.value !== null && nutrient.value !== undefined && nutrient.value !== '') {
                html += `<div class="nutrition-row"><span class="nutrition-label">${nutrient.label}</span><span class="nutrition-value">${formatNumber(nutrient.value)} ${nutrient.unit}</span></div>`;
            } else {
                html += `<div class="nutrition-row"><span class="nutrition-label">${nutrient.label}</span><span class="nutrition-label">—</span></div>`;
            }
        });
        
        contentDiv.innerHTML = hasPartialData ? html : '<div style="text-align: center; color: var(--color-text-muted); padding: 8px;">No nutrition information available.</div>';
    } else {
        contentDiv.setAttribute('data-status', 'none');
        editBtn.classList.add('hidden');
    }
}

// Format number with appropriate decimals
function formatNumber(num) {
    if (typeof num !== 'number' || !isFinite(num)) return '';
    
    const str = num.toString();
    if (str.includes('.') && str.split('.')[1].length <= 3) {
        return num;
    }
    
    // For whole numbers or simple decimals, just return as string
    return num;
}

// Nutrition form helpers for clearing optional fields
function clearOptionalNutritionFields() {
    const inputs = [
        'edit-calories-serv', 'edit-protein-serv', 'edit-carbs-serv',
        'edit-fat-serv', 'edit-fiber-serv', 'edit-sugar-serv', 'edit-sodium-serv'
    ];
    
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}
