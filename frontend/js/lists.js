/**
 * Food Webapp — Grocery Lists JavaScript
 * Handles multiple independent grocery lists and item management.
 */

document.addEventListener('DOMContentLoaded', () => {
    const listsContainer = document.getElementById('lists-container');
    const addListBtn = document.getElementById('add-list-btn');
    const addListBtnInline = document.getElementById('add-list-btn-inline');
    const emptyState = document.querySelector('.empty-state');
    const errorState = document.querySelector('.error-state');
    
    // Modal elements
    const listModal = document.getElementById('list-modal');
    const closeListModalBtn = document.getElementById('close-list-modal');
    const addListItemBtn = document.getElementById('add-item-btn');
    const saveListBtn = document.getElementById('save-list-btn');
    const listNameInput = document.getElementById('list-name-input');
    
    // Item-specific modal elements (for edit)
    const itemEditModal = document.getElementById('item-edit-modal');
    const closeItemEditModalBtn = document.getElementById('close-item-edit-modal');
    const editItemNameInput = document.getElementById('edit-item-name-input');
    const editItemCompletedCheck = document.getElementById('edit-item-completed-check');
    
    let currentListId = null;
    let editingItemId = null;
    let lists = [];
    let isLoading = false;

    // Load lists from backend on init
    function loadLists() {
        if (isLoading) return;
        isLoading = true;
        
        fetch('/grocery-lists')
            .then(res => res.json())
            .then(data => {
                lists = data || [];
                renderLists();
                emptyState.classList.add('hidden');
                errorState.classList.add('hidden');
                isLoading = false;
            })
            .catch(err => {
                console.error('Failed to load grocery lists:', err);
                errorState.classList.remove('hidden');
                isLoading = false;
            });
    }

    // Render list items in grid
    function renderLists() {
        if (lists.length > 0) {
            listsContainer.innerHTML = lists.map(list => {
                const itemCount = list.items ? JSON.parse(list.items).length : 0;
                return `
                    <article class="recipe-card">
                        <div class="recipe-content" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
                            <h3 class="recipe-title">${escapeHtml(list.name)}</h3>
                            <span class="recipe-meta">📝 ${itemCount} items</span>
                        </div>
                    </article>
                `;
            }).join('');
        } else {
            listsContainer.innerHTML = '';
        }
    }

    // Add new list (create modal)
    function addList() {
        currentListId = null;
        editingItemId = null;
        listNameInput.value = '';
        saveListBtn.textContent = 'Save';
        itemEditModal.classList.add('hidden');
        listModal.classList.remove('hidden');
        listNameInput.focus();
    }

    // Edit existing list name
    function editList(list) {
        currentListId = list.id;
        editingItemId = null;
        listNameInput.value = list.name;
        saveListBtn.textContent = 'Update';
        itemEditModal.classList.add('hidden');
        listModal.classList.remove('hidden');
        listNameInput.focus();
    }

    // Delete list with confirmation
    function deleteList(listId) {
        if (!confirm(`Delete the list permanently? This action cannot be undone.`)) {
            return;
        }
        
        fetch(`/grocery-lists/${listId}`, { method: 'DELETE' })
            .then(res => {
                if (!res.ok) throw new Error('Failed to delete list');
                loadLists();
            })
            .catch(err => {
                console.error('Failed to delete list:', err);
                alert('Failed to delete the list. Please try again.');
            });
    }

    // Create new item in current list
    function addItem() {
        if (!currentListId) return;
        
        const list = lists.find(l => l.id === currentListId);
        if (!list) return;
        
        const items = list.items ? JSON.parse(list.items) : [];
        items.push({ id: Date.now().toString(), name: '', completed: false });
        list.items = JSON.stringify(items);
        
        saveListToStorage();
        loadLists();
    }

    // Edit item in modal
    function editItem(item, listId) {
        currentListId = listId;
        editingItemId = item.id;
        editItemNameInput.value = item.name;
        editItemCompletedCheck.checked = item.completed;
        itemEditModal.classList.remove('hidden');
        editItemNameInput.focus();
    }

    // Delete item in current list
    function deleteItem(item) {
        if (!currentListId) return;
        
        const list = lists.find(l => l.id === currentListId);
        if (!list) return;
        
        if (confirm('Delete this item?')) {
            const items = list.items ? JSON.parse(list.items) : [];
            list.items = JSON.stringify(items.filter(i => i.id !== editingItemId));
            saveListToStorage();
            loadLists();
        }
    }

    // Toggle item completion
    function toggleItem(item) {
        if (!currentListId) return;
        
        const list = lists.find(l => l.id === currentListId);
        if (!list) return;
        
        const items = list.items ? JSON.parse(list.items) : [];
        const idx = items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
            items[idx].completed = !items[idx].completed;
            list.items = JSON.stringify(items);
            saveListToStorage();
            
            // Re-render to show visual feedback
            renderLists();
        }
    }

    // Save list (name update or create new)
    function saveList() {
        const name = listNameInput.value.trim() || 'New List';
        
        if (!currentListId) {
            // Create new list
            fetch('/grocery-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            })
            .then(res => res.json())
            .then(data => {
                if (data.id) {
                    lists.push({ ...data, items: '[]' });
                    currentListId = data.id;
                }
                listModal.classList.add('hidden');
                loadLists();
            })
            .catch(err => {
                console.error('Failed to create list:', err);
                alert('Failed to create the list. Please try again.');
            });
        } else {
            // Update existing list name
            updateListName(currentListId, name);
        }
    }

    // Update list name via backend
    function updateListName(listId, name) {
        // For now, we'll handle this on the client side for simplicity
        const list = lists.find(l => l.id === listId);
        if (list) {
            list.name = name;
            renderLists();
            saveListToStorage();
            listModal.classList.add('hidden');
        }
    }

    // Save list items
    function saveListItems() {
        if (!currentListId) return;
        
        const list = lists.find(l => l.id === currentListId);
        if (!list) return;
        
        saveListToStorage();
        loadLists();
        itemEditModal.classList.add('hidden');
    }

    // Save items to localStorage (sync with backend)
    function saveListToStorage() {
        try {
            localStorage.setItem('groceryLists', JSON.stringify(lists));
        } catch (err) {
            console.error('Failed to save lists to localStorage:', err);
        }
    }

    // Close modal handlers
    if (closeListModalBtn) {
        closeListModalBtn.addEventListener('click', () => {
            listModal.classList.add('hidden');
        });
    }
    
    if (closeItemEditModalBtn) {
        closeItemEditModalBtn.addEventListener('click', () => {
            itemEditModal.classList.add('hidden');
        });
    }

    // Modal backdrop click to close
    if (listModal) {
        listModal.querySelector('.modal-backdrop').addEventListener('click', () => {
            listModal.classList.add('hidden');
        });
    }
    
    // Edit item modal backdrop
    if (itemEditModal) {
        itemEditModal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
            itemEditModal.classList.add('hidden');
        });
    }

    // Button event listeners
    if (addListBtn) addListBtn.addEventListener('click', addList);
    if (addListBtnInline) addListBtnInline.addEventListener('click', addList);
    
    if (saveListBtn) {
        saveListBtn.addEventListener('click', () => {
            if (!currentListId) {
                saveList();
            } else {
                updateListName(currentListId, listNameInput.value.trim() || 'New List');
            }
        });
    }
    
    if (listNameInput) {
        listNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') saveList();
        });
    }

    // Item management buttons - attach to each card dynamically
    listsContainer.addEventListener('click', (e) => {
        const itemCheck = e.target.closest('.item-check');
        const itemName = e.target.closest('.item-text');
        const deleteBtn = e.target.closest('.item-delete');
        
        if (!currentListId && itemCheck) {
            // User clicked check on a list card - open edit modal
            const list = lists.find(l => l.id === currentListId);
            if (list) {
                const items = list.items ? JSON.parse(list.items) : [];
                if (items.length > 0) {
                    editItem(items[0], currentListId);
                } else {
                    addItem();
                }
            }
        }
        
        if (itemCheck) {
            const card = e.target.closest('.recipe-card');
            if (card) {
                // Determine which list we're editing based on the modal state
                if (!currentListId) currentListId = lists[0]?.id || null;
                
                toggleItem({ id: itemCheck.dataset.id });
            }
        }
        
        if (itemName && itemName.textContent.trim()) {
            const card = e.target.closest('.recipe-card');
            if (card) {
                // Edit mode - update the item name inline
                const list = lists.find(l => l.id === currentListId);
                if (list) {
                    const items = list.items ? JSON.parse(list.items) : [];
                    const idx = items.findIndex(i => i.id === editingItemId);
                    if (idx !== -1) {
                        items[idx].name = itemName.textContent.trim();
                        list.items = JSON.stringify(items);
                        saveListToStorage();
                        loadLists();
                    }
                }
            }
        }
        
        if (deleteBtn) {
            const card = e.target.closest('.recipe-card');
            if (card) {
                // Delete mode - delete the item
                const list = lists.find(l => l.id === currentListId);
                if (list) {
                    const items = list.items ? JSON.parse(list.items) : [];
                    const idx = items.findIndex(i => i.id === editingItemId);
                    if (idx !== -1) {
                        deleteItem(items[idx]);
                    }
                }
            }
        }
    });

    // Save item edits
    if (itemEditModal) {
        itemEditModal.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const itemId = editingItemId;
            const itemName = editItemNameInput.value.trim();
            
            const list = lists.find(l => l.id === currentListId);
            if (!list) return;
            
            const items = list.items ? JSON.parse(list.items) : [];
            const idx = items.findIndex(i => i.id === itemId);
            if (idx !== -1) {
                items[idx].name = itemName;
                items[idx].completed = editItemCompletedCheck.checked;
                list.items = JSON.stringify(items);
                saveListToStorage();
                loadLists();
            }
        });
    }

    // Load from localStorage for offline support
    function loadItemsFromStorage() {
        try {
            const stored = localStorage.getItem('groceryLists');
            if (stored) {
                lists = JSON.parse(stored);
            }
        } catch (err) {
            console.error('Failed to load from localStorage:', err);
        }
    }

    // Error state handler
    if (errorState && document.getElementById('retry-lists-btn')) {
        document.getElementById('retry-lists-btn').addEventListener('click', () => {
            errorState.classList.add('hidden');
            loadLists();
        });
    }

    // Initial load from backend and localStorage
    loadItemsFromStorage();
    loadLists();
});

// Escape HTML utility
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
