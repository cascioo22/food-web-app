/**
 * Food Webapp — Photo Gallery JavaScript
 * Handles photo uploads, display, and localStorage persistence with basic compression.
 */

// API Base URL - configure this based on your deployment
const API_BASE_URL = window.location.origin === 'http://localhost:5173' || window.location.origin === 'http://127.0.0.1:5500' 
    ? 'http://localhost:8000'  // FastAPI dev server default
    : '/api';

// Photo state management
let photos = JSON.parse(localStorage.getItem('foodPhotos') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('gallery-grid');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const emptyState = document.querySelector('.empty-state');
    const errorState = document.querySelector('.error-state');
    
    // Modal elements
    const photoModal = document.getElementById('photo-modal');
    const closePhotoModalBtn = document.getElementById('close-photo-modal');
    const deletePhotoBtn = document.getElementById('delete-photo-btn');
    const modalImage = document.getElementById('modal-image');
    
    // Load photos on init - fetch from server if available
    async function loadPhotos() {
        try {
            const response = await fetch(`${API_BASE_URL}/photos`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.photos) {
                    photos = data.photos;
                    localStorage.setItem('foodPhotos', JSON.stringify(photos));
                    renderGallery();
                    return;
                }
            }
        } catch (error) {
            console.warn('Server fetch failed, falling back to localStorage:', error);
        }
        
        // Fallback to localStorage
        if (photos.length > 0) {
            renderGallery();
            emptyState.classList.add('hidden');
            errorState.classList.add('hidden');
        } else {
            emptyState.classList.remove('hidden');
            galleryGrid.innerHTML = '';
        }
    }

    // Upload photo with optional recipe association
    async function handleUpload(file, recipeId = null, caption = 'Untitled dish') {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return false;
        }

        try {
            const compressed = await compressImage(file);
            
            // For server upload, we need to handle differently
            // This is a simplified client-side version that also tries server upload
            if (recipeId !== null) {
                // Try server upload with recipe association
                const formData = new FormData();
                formData.append('image', file);
                formData.append('caption', caption || 'Untitled dish');
                if (recipeId) formData.append('recipe_id', recipeId.toString());

                try {
                    const response = await fetch(`${API_BASE_URL}/photos`, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('Photo uploaded to server:', result);
                        // Refresh gallery from server
                        await loadPhotos();
                        return true;
                    }
                } catch (serverError) {
                    console.warn('Server upload failed, falling back to local:', serverError);
                }
            }

            // Fallback: client-side storage
            photos.push({
                id: Date.now().toString(),
                description: caption || 'Untitled dish',
                dataUrl: compressed.dataUrl,
                uploadedAt: new Date().toISOString()
            });
            
            localStorage.setItem('foodPhotos', JSON.stringify(photos));
            renderGallery();
            
            console.log(`Photo added: ${compressed.width}x${compressed.height}px`);
            return true;
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to process image. Please try another file.');
            return false;
        }
    }

    // Render photo grid
    function renderGallery() {
        if (photos.length > 0) {
            galleryGrid.innerHTML = photos.map(photo => `
                <div class="gallery-item">
                    <img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.description || 'Food photo')}">
                </div>
            `).join('');
        }
    }

    // Compress image using Canvas (basic client-side compression)
    function compressImage(file, maxWidth = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Maintain aspect ratio
                    if (width > maxWidth) {
                        height = Math.floor(maxWidth * height / width);
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to compressed data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve({
                        dataUrl: dataUrl,
                        width: width,
                        height: height
                    });
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    // Open photo modal
    function openPhotoModal(photo) {
        modalImage.src = photo.dataUrl;
        photoModal.querySelector('.modal-title').textContent = photo.description || 'Photo';
        photoModal.classList.remove('hidden');
    }

    // Delete photo - with server API integration
    async function deletePhoto(photoid, recipeId = null) {
        if (!confirm('Delete this photo?')) return;
        
        try {
            // Try server delete first
            const response = await fetch(`${API_BASE_URL}/photos/${encodeURIComponent(photoid)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Refresh gallery from server
                await loadPhotos();
                return;
            } else {
                console.warn('Server delete failed, falling back to local:', response.status);
            }
        } catch (err) {
            console.warn('Delete error, using local fallback:', err);
        }

        // Fallback: client-side deletion
        const idx = photos.findIndex(p => p.id === photoid);
        if (idx !== -1) {
            photos.splice(idx, 1);
            localStorage.setItem('foodPhotos', JSON.stringify(photos));
            renderGallery();
        }
    }

    // Edit photo caption and recipe link
    async function editPhoto(photo, newCaption = null, newRecipeId = null) {
        try {
            const response = await fetch(`${API_BASE_URL}/photos/${photo.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    caption: newCaption || photo.caption,
                    recipe_id: newRecipeId || null
                })
            });
            
            if (response.ok) {
                console.log('Photo updated successfully');
                // Refresh from server
                await loadPhotos();
                return true;
            } else {
                console.warn('Server update failed, keeping local copy');
                return false;
            }
        } catch (err) {
            console.warn('Edit error:', err);
            return false;
        }
    }

    // Close modal handlers
    if (closePhotoModalBtn) {
        closePhotoModalBtn.addEventListener('click', () => {
            photoModal.classList.add('hidden');
        });
    }

    // Modal backdrop click to close
    if (photoModal) {
        photoModal.querySelector('.modal-backdrop').addEventListener('click', () => {
            photoModal.classList.add('hidden');
        });
    }

    // Delete button handler
    if (deletePhotoBtn) {
        deletePhotoBtn.addEventListener('click', async () => {
            const selectedImg = modalImage.src;
            const photo = photos.find(p => p.dataUrl === selectedImg);
            await deletePhoto(photo.id, photo.recipeId);
            photoModal.classList.add('hidden');
        });
    }

    // Upload button handlers
    if (uploadBtn) uploadBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && await handleUpload(file)) {
            // Reset input for re-uploading same file
            fileInput.value = '';
        }
    });

    // Error state handler
    if (errorState && document.getElementById('retry-gallery-btn')) {
        document.getElementById('retry-gallery-btn').addEventListener('click', loadPhotos);
    }

    // Initial load
    loadPhotos();
});

// Escape HTML utility
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
