"""
Photo Storage Module - Secure image upload with validation
Uses PIL for reliable image format detection and dimension extraction.
No external dependencies beyond Pillow (PIL).
"""

import os
import uuid
import base64
import struct
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from io import BytesIO

# Configuration
PHOTO_UPLOAD_DIR = "/opt/data/home/food-webapp-project/uploads/photos"
THUMB_UPLOAD_DIR = "/opt/data/home/food-webapp-project/uploads/thumbnails"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}
MAX_WIDTH = 4096
MAX_HEIGHT = 4096

# PNG signature bytes
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


def ensure_directories():
    """Create upload directories if they don't exist."""
    os.makedirs(PHOTO_UPLOAD_DIR, exist_ok=True)
    os.makedirs(THUMB_UPLOAD_DIR, exist_ok=True)


def generate_safe_filename(original_filename: str) -> str:
    """Generate a safe, unique filename from the original filename."""
    import re
    
    # Extract extension
    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = '.jpg'
    
    # Sanitize filename - remove dangerous characters
    name = os.path.basename(original_filename)
    sanitized_name = re.sub(r'[<>:"/\\|?*]', '', name)
    
    return f"{uuid.uuid4().hex}{ext}"


def validate_image_data(image_data_url: str) -> Dict[str, Any]:
    """Validate base64-encoded image data using PIL for robust format detection."""
    try:
        # Extract base64 data from data URL
        prefix_end = image_data_url.index(',') + 1
        b64_string = image_data_url[prefix_end:]
        
        # Decode the image
        image_bytes = base64.b64decode(b64_string)
        
        if len(image_bytes) == 0:
            return {"success": False, "error": "Empty image data"}
        
        try:
            # Use PIL to open and validate the image
            from PIL import Image as PILImage
            
            pil_img = PILImage.open(BytesIO(image_bytes))
            
            # Verify we got valid dimensions
            width, height = pil_img.size
            
            # Check format against allowed list
            pil_format = pil_img.format.lower() if pil_img.format else 'unknown'
            supported_formats = {'png', 'jpeg', 'jpg', 'gif', 'webp'}
            
            if pil_format not in supported_formats:
                return {"success": False, "error": f"Invalid image data: Unsupported image format ({pil_format})"}
            
            # Map PIL format to our output format
            fmt_map = {
                'jpeg': 'jpeg',
                'jpg': 'jpeg', 
                'png': 'png',
                'gif': 'gif',
                'webp': 'webp'
            }
            fmt = fmt_map.get(pil_format, 'unknown')
            
            # Check dimensions
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                return {
                    "success": False,
                    "error": f"Image dimensions too large: {width}x{height}"
                }
            
            # Check file size
            if len(image_bytes) > MAX_FILE_SIZE:
                return {
                    "success": False,
                    "error": f"Image exceeds maximum size of {MAX_FILE_SIZE // (1024*1024)}MB"
                }
            
            pil_img.close()
            
            return {
                "success": True,
                "format": fmt,
                "width": width,
                "height": height,
                "file_size_bytes": len(image_bytes),
                "raw_image": image_bytes
            }
        except Exception as e:
            return {"success": False, "error": f"Invalid image data: {str(e)}"}
            
    except base64.binascii.Error as e:
        return {"success": False, "error": f"Invalid base64 encoding: {str(e)}"}
    except (IndexError, ValueError) as e:
        return {"success": False, "error": f"Invalid image data: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": f"Validation failed: {str(e)}"}


def strip_exif_data(image_bytes: bytes) -> bytes:
    """Strip EXIF/GPS metadata from image (basic implementation)."""
    try:
        from PIL import Image as PILImage
        
        pil_img = PILImage.open(BytesIO(image_bytes))
        
        # Convert to RGB to ensure compatibility
        if pil_img.mode not in ('RGB', 'L'):
            pil_img = pil_img.convert('RGB')
            
        # Save to new bytes buffer (this strips most EXIF data by default)
        output = BytesIO()
        
        # Use format-specific saving
        fmt_map = {
            'jpeg': 'JPEG',
            'jpg': 'JPEG', 
            'png': 'PNG',
            'gif': 'GIF',
            'webp': 'WEBP'
        }
        pil_format = pil_img.format.lower() if pil_img.format else 'jpeg'
        
        output_format = fmt_map.get(pil_format, 'JPEG')
        pil_img.save(output, format=output_format)
        
        result = output.getvalue()
        pil_img.close()
        return result
        
    except Exception:
        # If stripping fails, just return original
        return image_bytes


def create_thumbnail(image_bytes: bytes, max_size: Tuple[int, int]) -> Tuple[bytes, str]:
    """Create a thumbnail using PIL."""
    try:
        from PIL import Image as PILImage
        
        pil_img = PILImage.open(BytesIO(image_bytes))
        
        # Convert to RGB for compatibility
        if pil_img.mode not in ('RGB', 'L'):
            pil_img = pil_img.convert('RGB')
            
        # Resize maintaining aspect ratio
        width, height = pil_img.size
        max_dimension = max(width, height)
        
        if max_dimension > max_size[0]:
            scale = max_size[0] / max_dimension
            new_width = int(width * scale)
            new_height = int(height * scale)
            pil_img = pil_img.resize((new_width, new_height), PILImage.LANCZOS)
            
        # Create a colored placeholder if image is too small
        if width < 64 or height < 64:
            thumbnail = PILImage.new('RGB', (192, 192), color=(200, 200, 200))
            # Paste original in center with border
            thumbnail.paste(pil_img, ((192-width)//2, (192-height)//2))
            pil_img = thumbnail
            
        # Save as JPEG
        output = BytesIO()
        pil_img.save(output, format='JPEG', quality=85)
        
        thumb_bytes = output.getvalue()
        thumb_filename = f"thumb_{uuid.uuid4().hex}.jpg"
        
        pil_img.close()
        return (thumb_bytes, thumb_filename)
    except Exception:
        # Fallback to placeholder
        import hashlib
        placeholder = b'THUMB_' + uuid.uuid4().hex[:12]
        filename = f"thumb_{uuid.uuid4().hex}.jpg"
        return (placeholder, filename)


def upload_photo(image_data_url: str, caption: str = "", recipe_id: int = None) -> Dict[str, Any]:
    """Complete secure photo upload pipeline."""
    ensure_directories()
    
    # Step 1: Validate
    validation = validate_image_data(image_data_url)
    if not validation["success"]:
        return {"success": False, "error": validation["error"]}
    
    image_bytes = validation["raw_image"]
    fmt = validation["format"]
    
    # Step 2: Generate safe filename
    original_filename = os.path.basename(validation.get("original_filename", "uploaded"))
    safe_filename = generate_safe_filename(original_filename)
    
    # Step 3: Strip metadata and save
    clean_bytes = strip_exif_data(image_bytes)
    file_path = os.path.join(PHOTO_UPLOAD_DIR, safe_filename)
    thumb_filename = None
    
    try:
        with open(file_path, 'wb') as f:
            f.write(clean_bytes)
        
        # Create thumbnail
        thumb_bytes, thumb_filename = create_thumbnail(clean_bytes, (192, 192))
        thumb_path = os.path.join(THUMB_UPLOAD_DIR, thumb_filename)
        with open(thumb_path, 'wb') as f:
            f.write(thumb_bytes)
        
        # Create data URL for storage
        data_url = f"data:image/{fmt};base64,{base64.b64encode(clean_bytes).decode('utf-8')}"
        
        return {
            "success": True,
            "filename": safe_filename,
            "thumbnail_filename": thumb_filename,
            "url": data_url,
            "file_size_bytes": len(clean_bytes),
            "format": fmt,
            "width": validation["width"],
            "height": validation["height"]
        }
    except IOError as e:
        # Clean up on failure
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        thumb_to_remove = f"thumb_{safe_filename[:-4]}.jpg"
        thumb_path = os.path.join(THUMB_UPLOAD_DIR, thumb_to_remove)
        if os.path.exists(thumb_path):
            try:
                os.remove(thumb_path)
            except:
                pass
        return {"success": False, "error": f"Failed to save file: {str(e)}"}
    except Exception as e:
        # Clean up on failure
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass
        thumb_to_remove = f"thumb_{safe_filename[:-4]}.jpg"
        thumb_path = os.path.join(THUMB_UPLOAD_DIR, thumb_to_remove)
        if os.path.exists(thumb_path):
            try:
                os.remove(thumb_path)
            except:
                pass
        return {"success": False, "error": f"Upload failed: {str(e)}"}


def delete_photo(filename: str) -> Dict[str, Any]:
    """Delete a photo from storage."""
    ensure_directories()
    
    try:
        file_path = os.path.join(PHOTO_UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Also delete the original thumb file if it exists
        thumb_filename = f"thumb_{filename}"  # Assume format was stripped to .jpg
        thumb_path = os.path.join(THUMB_UPLOAD_DIR, thumb_filename)
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
        
        return {"success": True, "message": "Photo deleted successfully"}
    except Exception as e:
        return {"success": False, "error": f"Failed to delete: {str(e)}"}


class PhotoUploadRequest:
    """Pydantic-like request schema for photo uploads."""
    def __init__(self, **kwargs):
        self.image_data_url = kwargs.get('image_data_url', '')
        self.caption = kwargs.get('caption', '')
        self.recipe_id = kwargs.get('recipe_id')


class PhotoResponse:
    """Response schema for photo endpoints."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)
