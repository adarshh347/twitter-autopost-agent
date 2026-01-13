"""
Cloudinary Service for Image Gallery Management.

Handles:
- Fetching images from Cloudinary
- Uploading images to Cloudinary
- Deleting images after use
"""

import os
import logging
import cloudinary
import cloudinary.uploader
import cloudinary.api
from typing import List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
backend_dir = Path(__file__).parent
load_dotenv(backend_dir / ".env")

logger = logging.getLogger(__name__)

# Cloudinary configuration
CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

# Initialize Cloudinary
if all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )
    logger.info(f"Cloudinary configured for cloud: {CLOUDINARY_CLOUD_NAME}")
else:
    logger.warning("Cloudinary credentials not fully configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env")


class CloudinaryService:
    """Service class for Cloudinary operations."""
    
    def __init__(self, folder: str = "curator_gallery"):
        """
        Initialize Cloudinary service.
        
        Args:
            folder: Default folder for curator images in Cloudinary
        """
        self.folder = folder
        self.configured = all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET])
    
    def get_gallery_images(self, max_results: int = 50, next_cursor: str = None) -> Dict[str, Any]:
        """
        Fetch all images from the curator gallery folder.
        
        Args:
            max_results: Maximum number of images to fetch
            next_cursor: Cursor for pagination
            
        Returns:
            Dict with images list and pagination info
        """
        if not self.configured:
            return {"images": [], "error": "Cloudinary not configured"}
        
        try:
            # Search for images in the curator folder
            params = {
                "type": "upload",
                "prefix": self.folder,
                "max_results": max_results,
                "resource_type": "image"
            }
            
            if next_cursor:
                params["next_cursor"] = next_cursor
            
            result = cloudinary.api.resources(**params)
            
            images = []
            for resource in result.get("resources", []):
                images.append({
                    "public_id": resource["public_id"],
                    "url": resource["secure_url"],
                    "thumbnail_url": cloudinary.CloudinaryImage(resource["public_id"]).build_url(
                        width=300, height=300, crop="fill", quality="auto"
                    ),
                    "width": resource.get("width"),
                    "height": resource.get("height"),
                    "format": resource.get("format"),
                    "bytes": resource.get("bytes"),
                    "created_at": resource.get("created_at"),
                    "asset_id": resource.get("asset_id")
                })
            
            return {
                "images": images,
                "total": len(images),
                "next_cursor": result.get("next_cursor"),
                "rate_limit_remaining": result.get("rate_limit_remaining")
            }
            
        except cloudinary.exceptions.Error as e:
            logger.error(f"Cloudinary API error: {e}")
            return {"images": [], "error": str(e)}
        except Exception as e:
            logger.error(f"Error fetching gallery: {e}")
            return {"images": [], "error": str(e)}
    
    def upload_image(
        self,
        file_path: str = None,
        file_bytes: bytes = None,
        public_id: str = None,
        tags: List[str] = None
    ) -> Dict[str, Any]:
        """
        Upload an image to Cloudinary.
        
        Args:
            file_path: Path to local file
            file_bytes: Raw bytes of the image
            public_id: Optional custom public ID
            tags: Optional tags for the image
            
        Returns:
            Dict with upload result
        """
        if not self.configured:
            return {"error": "Cloudinary not configured"}
        
        try:
            upload_options = {
                "folder": self.folder,
                "resource_type": "image",
                "overwrite": False
            }
            
            if public_id:
                upload_options["public_id"] = public_id
            
            if tags:
                upload_options["tags"] = tags
            
            if file_path:
                result = cloudinary.uploader.upload(file_path, **upload_options)
            elif file_bytes:
                result = cloudinary.uploader.upload(file_bytes, **upload_options)
            else:
                return {"error": "No file provided"}
            
            return {
                "success": True,
                "public_id": result["public_id"],
                "url": result["secure_url"],
                "thumbnail_url": cloudinary.CloudinaryImage(result["public_id"]).build_url(
                    width=300, height=300, crop="fill", quality="auto"
                ),
                "width": result.get("width"),
                "height": result.get("height"),
                "format": result.get("format"),
                "bytes": result.get("bytes")
            }
            
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return {"error": str(e)}
    
    def delete_image(self, public_id: str) -> Dict[str, Any]:
        """
        Delete an image from Cloudinary.
        
        Args:
            public_id: The public ID of the image to delete
            
        Returns:
            Dict with deletion result
        """
        if not self.configured:
            return {"error": "Cloudinary not configured"}
        
        try:
            result = cloudinary.uploader.destroy(public_id)
            
            if result.get("result") == "ok":
                return {
                    "success": True,
                    "deleted": public_id
                }
            else:
                return {
                    "success": False,
                    "result": result.get("result"),
                    "public_id": public_id
                }
                
        except Exception as e:
            logger.error(f"Delete failed for {public_id}: {e}")
            return {"error": str(e)}
    
    def get_image_url(self, public_id: str, width: int = None, height: int = None) -> str:
        """
        Get URL for an image with optional transformations.
        
        Args:
            public_id: The public ID of the image
            width: Optional width for resizing
            height: Optional height for resizing
            
        Returns:
            URL string
        """
        if not self.configured:
            return ""
        
        img = cloudinary.CloudinaryImage(public_id)
        
        if width and height:
            return img.build_url(width=width, height=height, crop="fill", quality="auto")
        elif width:
            return img.build_url(width=width, crop="scale", quality="auto")
        else:
            return img.build_url(quality="auto")


# Singleton instance
cloudinary_service = CloudinaryService()
