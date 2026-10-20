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
            // Add modal-backdrop class to make it clickable
            importModal.classList.add('modal-backdrop');
            
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
    
