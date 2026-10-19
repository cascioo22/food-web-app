/**
 * Food Webapp — Cooking Mode Module
 * Handles the distraction-free cooking view with progress tracking
 */

(function() {
    const API_BASE = '/api';
    
    // State
    let currentRecipeId = null;
    let ingredientsProgress = {}; // { ingredient_id: boolean }
    let stepsProgress = {};      // { step_index: boolean }
    let keyboardNavState = {
        activeSection: 'ingredients',  // 'ingredients' or 'steps'
        selectedIndex: 0,
        lastFocusedElement: null
    };

    document.addEventListener('DOMContentLoaded', () => {
        initCookingMode();
    });

    function initCookingMode() {
        setupEventListeners();
        
        // Check if there's a recipe ID in URL hash or query params
        const urlParams = new URLSearchParams(window.location.search);
        const recipeIdFromUrl = urlParams.get('recipe_id');
        
        if (recipeIdFromUrl) {
            loadCookingView(parseInt(recipeIdFromUrl));
        } else {
            // No recipe selected, show library view
            window.location.href = 'index.html';
        }
    }

    function setupEventListeners() {
        // Navigation buttons
        document.getElementById('back-btn').addEventListener('click', () => {
            closeCookingMode();
        });

        document.getElementById('close-overlay-btn').addEventListener('click', () => {
            closeCookingMode();
        });

        // Reset button
        document.getElementById('reset-progress-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset your cooking progress? This cannot be undone.')) {
                resetProgress();
            }
        });

        // Keyboard navigation
        setupKeyboardNavigation();
    }

    function setupKeyboardNavigation() {
        document.addEventListener('keydown', handleKeydown);
    }

    function handleKeydown(e) {
        // Only handle if cooking overlay is visible
        if (document.getElementById('cooking-overlay').classList.contains('hidden')) {
            return;
        }

        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                navigatePrevious();
                break;
            
            case 'ArrowDown':
                e.preventDefault();
                navigateNext();
                break;
            
            case 'Enter':
                e.preventDefault();
                if (keyboardNavState.activeSection === 'ingredients') {
                    toggleIngredientChecked(keyboardNavState.selectedIndex);
                } else {
                    markStepCompleted(keyboardNavState.selectedIndex);
                }
                break;
            
            case 'Escape':
                closeCookingMode();
                break;
        }
    }

    function navigatePrevious() {
        const section = keyboardNavState.activeSection;
        const containerId = section === 'ingredients' ? 'ingredients-container' : 'steps-container';
        const items = document.getElementById(containerId).children;
        
        if (items.length === 0) return;

        let newIndex = keyboardNavState.selectedIndex - 1;
        if (newIndex < 0) {
            // Jump to other section
            keyboardNavState.activeSection = section === 'ingredients' ? 'steps' : 'ingredients';
            newIndex = document.getElementById(
                keyboardNavState.activeSection === 'ingredients' 
                    ? 'steps-container' 
                    : 'ingredients-container'
            ).children.length - 1;
        }
        
        keyboardNavState.selectedIndex = newIndex;
        focusElement(newIndex, containerId);
    }

    function navigateNext() {
        const section = keyboardNavState.activeSection;
        const containerId = section === 'ingredients' ? 'ingredients-container' : 'steps-container';
        const items = document.getElementById(containerId).children;
        
        if (items.length === 0) return;

        let newIndex = keyboardNavState.selectedIndex + 1;
        if (newIndex >= items.length) {
            // Jump to other section
            keyboardNavState.activeSection = section === 'ingredients' ? 'steps' : 'ingredients';
            newIndex = 0;
        }
        
        keyboardNavState.selectedIndex = newIndex;
        focusElement(newIndex, containerId);
    }

    function focusElement(index, containerId) {
        const element = document.getElementById(containerId).children[index];
        if (element) {
            // Save current focus before changing
            const currentlyFocused = document.activeElement;
            
            // Highlight the target visually
            element.classList.add('focused');
            
            // Delay focus to allow visual feedback
            setTimeout(() => {
                element.focus();
                
                // Clean up highlight after interaction
                setTimeout(() => {
                    element.classList.remove('focused');
                    
                    // Restore focus if needed
                    if (currentlyFocused && document.activeElement !== currentlyFocused) {
                        currentlyFocused.focus();
                    }
                }, 150);
            }, 30);
        }
    }

    async function loadCookingView(recipeId) {
        currentRecipeId = recipeId;
        
        try {
            // Fetch recipe data
            const response = await fetch(`${API_BASE}/recipes/${recipeId}`);
            if (!response.ok) throw new Error('Failed to load recipe');
            
            const recipe = await response.json();
            
            // Load saved progress from localStorage
            loadSavedProgress(recipeId);
            
            // Render the cooking view
            renderCookingView(recipe, recipeId);
            
            // Show overlay
            document.getElementById('cooking-overlay').classList.remove('hidden');
            
        } catch (error) {
            console.error('Error loading cooking view:', error);
            alert(`Error: ${error.message}`);
            closeCookingMode();
        }
    }

    function renderCookingView(recipe, recipeId) {
        // Display title
        document.getElementById('recipe-title-display').textContent = recipe.title;
        
        // Render ingredients
        renderIngredients(recipe.id, recipe.ingredients_text || '');
        
        // Render steps
        const stepsText = recipe.steps_ordered || '';
        renderSteps(stepsText);
        
        // Update progress bar
        updateProgressBar();
    }

    function renderIngredients(recipeId, ingredientsText) {
        const container = document.getElementById('ingredients-container');
        const parsedIngredients = parseIngredientsToLines(ingredientsText);
        
        if (parsedIngredients.length === 0) {
            container.innerHTML = '<li class="ingredient-item">No ingredients listed</li>';
            return;
        }
        
        container.innerHTML = parsedIngredients.map((ing, index) => `
            <li class="ingredient-item ${getIngredientProgress(recipeId, index) ? 'completed' : ''}" 
                data-ingredient-index="${index}">
                <input type="checkbox" 
                    class="ingredient-checkbox" 
                    ${getIngredientProgress(recipeId, index) ? 'checked' : ''}>
                <span class="ingredient-text">${escapeHtml(ing)}</span>
            </li>
        `).join('');
        
        // Set initial keyboard navigation state
        keyboardNavState.activeSection = 'ingredients';
        keyboardNavState.selectedIndex = 0;
    }

    function renderSteps(stepsText) {
        const container = document.getElementById('steps-container');
        const parsedSteps = parseStepsToLines(stepsText);
        
        if (parsedSteps.length === 0) {
            container.innerHTML = '<li>No instructions listed</li>';
            return;
        }
        
        container.innerHTML = parsedSteps.map((step, index) => `
            <li class="step-item ${getStepProgress(index) ? 'completed' : ''}" 
                data-step-index="${index}">
                <span class="step-number-circle">${index + 1}</span>
                <span class="step-content">${escapeHtml(step)}</span>
            </li>
        `).join('');
        
        // Set initial keyboard navigation state
        keyboardNavState.activeSection = 'steps';
        keyboardNavState.selectedIndex = 0;
    }

    function getIngredientProgress(recipeId, index) {
        const progressData = localStorage.getItem(`fw_cooking_${recipeId}_ingredients`);
        if (!progressData) return null;
        const progress = JSON.parse(progressData);
        return progress[index];
    }

    function getStepProgress(index) {
        const progressData = localStorage.getItem('fw_steps_progress');
        if (!progressData) return null;
        const progress = JSON.parse(progressData);
        return progress[index];
    }

    function toggleIngredientChecked(recipeId, ingredientIndex) {
        // Load existing progress
        let progress = {};
        const progressData = localStorage.getItem(`fw_cooking_${recipeId}_ingredients`);
        if (progressData) {
            progress = JSON.parse(progressData);
        }
        
        // Toggle state
        progress[ingredientIndex] = !progress[ingredientIndex];
        
        // Save progress
        localStorage.setItem(`fw_cooking_${recipeId}_ingredients`, JSON.stringify(progress));
        
        // Update UI
        const item = document.querySelector(`.ingredient-item[data-ingredient-index="${ingredientIndex}"]`);
        if (item) {
            item.classList.toggle('completed', progress[ingredientIndex]);
            
            // Re-render ingredients to update checkboxes
            renderIngredients(recipeId, '');
        }
        
        // Update progress bar
        updateProgressBar();
    }

    function markStepCompleted(stepIndex) {
        // Load existing progress
        let progress = {};
        const progressData = localStorage.getItem('fw_steps_progress');
        if (progressData) {
            progress = JSON.parse(progressData);
        }
        
        // Toggle state
        progress[stepIndex] = !progress[stepIndex];
        
        // Save progress
        localStorage.setItem('fw_steps_progress', JSON.stringify(progress));
        
        // Update UI - just toggle the class, don't re-render
        const item = document.querySelector(`.step-item[data-step-index="${stepIndex}"]`);
        if (item) {
            if (progress[stepIndex]) {
                // Mark as completed
                item.classList.add('completed');
                
                // Remove from list and update numbering for remaining steps
                const container = document.getElementById('steps-container');
                item.remove();
                
                // Renumber remaining steps
                Array.from(container.children).forEach((child, idx) => {
                    child.querySelector('.step-number-circle').textContent = idx + 1;
                });
            } else {
                // Remove completed status (don't re-add to list - user wants to see what's done)
                item.classList.remove('completed');
            }
        }
        
        // Update progress bar
        updateProgressBar();
    }

    function resetProgress() {
        if (!currentRecipeId) return;
        
        // Clear recipe-specific progress
        localStorage.removeItem(`fw_cooking_${currentRecipeId}_ingredients`);
        localStorage.removeItem('fw_steps_progress');
        
        // Fetch fresh recipe data to re-render with cleared checkboxes
        fetch(`${API_BASE}/recipes/${currentRecipeId}`)
            .then(r => r.json())
            .then(recipe => {
                renderIngredients(recipe.id, recipe.ingredients_text || '');
                renderSteps(recipe.steps_ordered || '');
            })
            .catch(() => {
                // If can't fetch, just clear local UI state
                renderIngredients(currentRecipeId, '');
                renderSteps('');
            });
        
        // Update progress bar immediately (will be 0%)
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) progressBar.style.width = '0%';
    }

    function updateProgressBar() {
        const progressBar = document.getElementById('progress-bar');
        if (!progressBar) return;
        
        // Calculate progress
        const totalItems = countTotalProgressItems();
        const completedItems = countCompletedProgressItems();
        
        let percentage = 0;
        if (totalItems > 0) {
            percentage = Math.round((completedItems / totalItems) * 100);
        }
        
        progressBar.style.width = `${percentage}%`;
    }

    function countTotalProgressItems() {
        // Count ingredients
        const ingredientsContainer = document.getElementById('ingredients-container');
        let count = 0;
        if (ingredientsContainer.children.length > 0) {
            count += ingredientsContainer.children[0].dataset.ingredientCount || 
                     ingredientsContainer.children.length;
        }
        
        // Count steps
        const stepsContainer = document.getElementById('steps-container');
        count += stepsContainer.children.length + 1; // Add 1 because last step was removed but counter still shows
        
        return count;
    }

    function countCompletedProgressItems() {
        let completed = 0;
        
        // Count completed ingredients
        const ingredientItems = document.querySelectorAll('.ingredient-item.completed');
        completed += ingredientItems.length;
        
        // Count completed steps (steps with green number circles)
        const stepItems = document.querySelectorAll('.step-number-circle[style*="background: var(--color-success)"]');
        completed += stepItems.length;
        
        return completed;
    }

    function closeCookingMode() {
        document.getElementById('cooking-overlay').classList.add('hidden');
        document.body.style.overflow = '';
        
        // Optionally return to recipe library
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 300);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function parseIngredientsToLines(text) {
        return (text || '').split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    function parseStepsToLines(text) {
        return (text || '').split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    // Load saved progress from localStorage
    function loadSavedProgress(recipeId) {
        const ingredientsProgressData = localStorage.getItem(`fw_cooking_${recipeId}_ingredients`);
        if (ingredientsProgressData) {
            ingredientsProgress = JSON.parse(ingredientsProgressData);
        }
        
        const stepsProgressData = localStorage.getItem('fw_steps_progress');
        if (stepsProgressData) {
            stepsProgress = JSON.parse(stepsProgressData);
        }
    }

})();