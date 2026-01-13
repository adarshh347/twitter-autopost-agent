"""
Image Feature Extraction using OpenCV.

Extracts low-level visual features from images:
- Dominant colors
- Brightness, contrast, saturation
- Noise level
- Composition type
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
from collections import Counter
import os
import logging

from .models import ImageMetadata, CompositionType

logger = logging.getLogger(__name__)


def extract_dominant_colors(image: np.ndarray, n_colors: int = 3) -> List[str]:
    """
    Extract dominant colors from an image using k-means clustering.
    Returns list of hex color codes.
    """
    try:
        # Reshape image to be a list of pixels
        pixels = image.reshape(-1, 3).astype(np.float32)
        
        # K-means clustering
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixels, n_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        # Count labels to find dominant colors
        label_counts = Counter(labels.flatten())
        
        # Sort centers by frequency
        sorted_centers = sorted(
            [(centers[i], label_counts[i]) for i in range(n_colors)],
            key=lambda x: x[1],
            reverse=True
        )
        
        # Convert BGR to hex
        hex_colors = []
        for center, _ in sorted_centers:
            b, g, r = int(center[0]), int(center[1]), int(center[2])
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            hex_colors.append(hex_color)
        
        return hex_colors
    except Exception as e:
        logger.error(f"Error extracting dominant colors: {e}")
        return ["#808080", "#404040", "#c0c0c0"]


def calculate_brightness(image: np.ndarray) -> float:
    """
    Calculate overall brightness of an image (0-1 scale).
    Uses the average value in HSV color space.
    """
    try:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        brightness = np.mean(hsv[:, :, 2]) / 255.0
        return round(brightness, 3)
    except Exception as e:
        logger.error(f"Error calculating brightness: {e}")
        return 0.5


def calculate_saturation(image: np.ndarray) -> float:
    """
    Calculate overall saturation of an image (0-1 scale).
    Uses the average saturation in HSV color space.
    """
    try:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        saturation = np.mean(hsv[:, :, 1]) / 255.0
        return round(saturation, 3)
    except Exception as e:
        logger.error(f"Error calculating saturation: {e}")
        return 0.5


def calculate_contrast(image: np.ndarray) -> float:
    """
    Calculate contrast using standard deviation of pixel intensities.
    Returns normalized value 0-1.
    """
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Normalize std to 0-1 range (max theoretical std for 8-bit is 127.5)
        contrast = np.std(gray) / 127.5
        return round(min(contrast, 1.0), 3)
    except Exception as e:
        logger.error(f"Error calculating contrast: {e}")
        return 0.5


def detect_noise(image: np.ndarray) -> float:
    """
    Estimate noise level using Laplacian variance method.
    Returns normalized value 0-1 (higher = more noise).
    """
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Normalize - typical range is 0 to ~5000 for noisy images
        # Very clean images have variance < 100
        noise_level = min(laplacian_var / 2000.0, 1.0)
        
        # Invert - high laplacian variance actually means sharp/detailed image
        # Low variance means blurry, but for noise we want the opposite interpretation
        # Here we keep as-is since high variance = high frequency content = could be noise
        return round(1.0 - min(laplacian_var / 1000.0, 1.0), 3)
    except Exception as e:
        logger.error(f"Error detecting noise: {e}")
        return 0.1


def determine_composition(image: np.ndarray) -> CompositionType:
    """
    Analyze image composition based on edge detection and content distribution.
    """
    try:
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect edges
        edges = cv2.Canny(gray, 50, 150)
        
        # Divide image into 3x3 grid
        grid_h, grid_w = h // 3, w // 3
        
        # Calculate edge density in each section
        sections = np.zeros((3, 3))
        for i in range(3):
            for j in range(3):
                section = edges[i*grid_h:(i+1)*grid_h, j*grid_w:(j+1)*grid_w]
                sections[i, j] = np.mean(section)
        
        # Center section weight
        center_weight = sections[1, 1]
        corner_weight = (sections[0, 0] + sections[0, 2] + sections[2, 0] + sections[2, 2]) / 4
        edge_weight = (sections[0, 1] + sections[1, 0] + sections[1, 2] + sections[2, 1]) / 4
        
        # Rule of thirds points (intersection points)
        rot_weight = (sections[0, 1] + sections[1, 0] + sections[1, 2] + sections[2, 1]) / 4
        
        # Aspect ratio check for wide/closeup
        aspect = w / h
        
        # Total content
        total_content = np.sum(sections)
        
        if total_content < 50:  # Very minimal content
            return CompositionType.MINIMAL
        
        if aspect > 2.0:  # Panoramic
            return CompositionType.WIDE
        
        if aspect < 0.7 or (center_weight > corner_weight * 2 and center_weight > edge_weight * 1.5):
            if total_content > 200:  # High detail in center
                return CompositionType.CLOSEUP
            return CompositionType.CENTERED
        
        # Check for rule of thirds
        if rot_weight > center_weight * 0.8:
            return CompositionType.RULE_OF_THIRDS
        
        # Check for asymmetric
        left_weight = np.sum(sections[:, 0])
        right_weight = np.sum(sections[:, 2])
        if abs(left_weight - right_weight) > total_content * 0.3:
            return CompositionType.ASYMMETRIC
        
        return CompositionType.CENTERED
        
    except Exception as e:
        logger.error(f"Error determining composition: {e}")
        return CompositionType.CENTERED


def extract_image_features(image_path: str, image_id: str) -> Optional[ImageMetadata]:
    """
    Extract all features from an image file.
    
    Args:
        image_path: Path to the image file
        image_id: Unique identifier for the image
        
    Returns:
        ImageMetadata object with extracted features
    """
    if not os.path.exists(image_path):
        logger.error(f"Image file not found: {image_path}")
        return None
    
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            logger.error(f"Could not read image: {image_path}")
            return None
        
        h, w = image.shape[:2]
        file_size = os.path.getsize(image_path)
        
        # Extract all features
        dominant_colors = extract_dominant_colors(image)
        brightness = calculate_brightness(image)
        saturation = calculate_saturation(image)
        contrast = calculate_contrast(image)
        noise_level = detect_noise(image)
        composition = determine_composition(image)
        aspect_ratio = round(w / h, 2)
        
        return ImageMetadata(
            image_id=image_id,
            local_path=image_path,
            dominant_colors=dominant_colors,
            brightness=brightness,
            contrast=contrast,
            saturation=saturation,
            noise_level=noise_level,
            composition=composition,
            aspect_ratio=aspect_ratio,
            width=w,
            height=h,
            file_size_bytes=file_size,
            processed=True
        )
        
    except Exception as e:
        logger.error(f"Error extracting features from {image_path}: {e}")
        return None


def extract_features_from_bytes(image_bytes: bytes, image_id: str) -> Optional[ImageMetadata]:
    """
    Extract features from image bytes (for uploaded images).
    
    Args:
        image_bytes: Raw image bytes
        image_id: Unique identifier for the image
        
    Returns:
        ImageMetadata object with extracted features
    """
    try:
        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            logger.error("Could not decode image from bytes")
            return None
        
        h, w = image.shape[:2]
        
        # Extract all features
        dominant_colors = extract_dominant_colors(image)
        brightness = calculate_brightness(image)
        saturation = calculate_saturation(image)
        contrast = calculate_contrast(image)
        noise_level = detect_noise(image)
        composition = determine_composition(image)
        aspect_ratio = round(w / h, 2)
        
        return ImageMetadata(
            image_id=image_id,
            dominant_colors=dominant_colors,
            brightness=brightness,
            contrast=contrast,
            saturation=saturation,
            noise_level=noise_level,
            composition=composition,
            aspect_ratio=aspect_ratio,
            width=w,
            height=h,
            file_size_bytes=len(image_bytes),
            processed=True
        )
        
    except Exception as e:
        logger.error(f"Error extracting features from bytes: {e}")
        return None
