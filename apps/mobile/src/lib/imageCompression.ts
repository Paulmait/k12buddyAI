/**
 * Image Compression Utility
 * Optimizes images before upload for better performance and reduced bandwidth
 */

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png';
}

export interface CompressionResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// Default compression settings for different use cases
export const CompressionPresets = {
  // For OCR - needs to be readable but doesn't need to be huge
  ocr: {
    maxWidth: 1500,
    maxHeight: 1500,
    quality: 0.8,
    format: 'jpeg' as const,
  },
  // For profile images - small and optimized
  avatar: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
    format: 'jpeg' as const,
  },
  // For general uploads
  standard: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
    format: 'jpeg' as const,
  },
  // For high quality needs
  highQuality: {
    maxWidth: 2000,
    maxHeight: 2000,
    quality: 0.9,
    format: 'jpeg' as const,
  },
  // Thumbnail
  thumbnail: {
    maxWidth: 150,
    maxHeight: 150,
    quality: 0.6,
    format: 'jpeg' as const,
  },
};

/**
 * Compress an image from URI
 */
export async function compressImage(
  imageUri: string,
  options: CompressionOptions = CompressionPresets.standard
): Promise<CompressionResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    format = 'jpeg',
  } = options;

  // Get original file info
  const originalInfo = await FileSystem.getInfoAsync(imageUri);
  const originalSize = (originalInfo as { size?: number }).size || 0;

  // Build manipulator actions
  const actions: ImageManipulator.Action[] = [];

  // Add resize action if needed
  actions.push({
    resize: {
      width: maxWidth,
      height: maxHeight,
    },
  });

  // Compress the image
  const result = await ImageManipulator.manipulateAsync(
    imageUri,
    actions,
    {
      compress: quality,
      format: format === 'jpeg'
        ? ImageManipulator.SaveFormat.JPEG
        : ImageManipulator.SaveFormat.PNG,
      base64: true,
    }
  );

  // Get compressed file info
  const compressedInfo = await FileSystem.getInfoAsync(result.uri);
  const compressedSize = (compressedInfo as { size?: number }).size || 0;

  return {
    uri: result.uri,
    base64: result.base64,
    width: result.width,
    height: result.height,
    originalSize,
    compressedSize,
    compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
  };
}

/**
 * Compress image specifically for OCR processing
 */
export async function compressForOCR(imageUri: string): Promise<CompressionResult> {
  return compressImage(imageUri, CompressionPresets.ocr);
}

/**
 * Compress image for profile avatar
 */
export async function compressForAvatar(imageUri: string): Promise<CompressionResult> {
  return compressImage(imageUri, CompressionPresets.avatar);
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(imageUri: string): Promise<CompressionResult> {
  return compressImage(imageUri, CompressionPresets.thumbnail);
}

/**
 * Estimate the size of a base64 encoded image
 */
export function estimateBase64Size(base64: string): number {
  // Base64 increases size by ~33%
  return Math.ceil((base64.length * 3) / 4);
}

/**
 * Check if image needs compression based on size
 */
export async function needsCompression(
  imageUri: string,
  maxSizeBytes: number = 5 * 1024 * 1024 // 5MB default
): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(imageUri);
    const size = (info as { size?: number }).size || 0;
    return size > maxSizeBytes;
  } catch (error) {
    // If we can't check, assume it needs compression
    return true;
  }
}

/**
 * Smart compress - only compress if needed
 */
export async function smartCompress(
  imageUri: string,
  options: CompressionOptions = CompressionPresets.standard,
  maxSizeBytes: number = 2 * 1024 * 1024 // 2MB default
): Promise<CompressionResult> {
  const needsWork = await needsCompression(imageUri, maxSizeBytes);

  if (!needsWork) {
    // Get file info for result
    const info = await FileSystem.getInfoAsync(imageUri);
    const size = (info as { size?: number }).size || 0;

    // Read as base64 if small enough
    const base64 = size < maxSizeBytes
      ? await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        })
      : undefined;

    return {
      uri: imageUri,
      base64,
      width: 0, // Would need to read image to get this
      height: 0,
      originalSize: size,
      compressedSize: size,
      compressionRatio: 1,
    };
  }

  return compressImage(imageUri, options);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Get compression savings message
 */
export function getCompressionSavings(result: CompressionResult): string {
  const savings = result.originalSize - result.compressedSize;
  const percent = ((1 - result.compressionRatio) * 100).toFixed(0);

  if (savings <= 0) {
    return 'Image already optimized';
  }

  return `Saved ${formatFileSize(savings)} (${percent}% smaller)`;
}

export default {
  compressImage,
  compressForOCR,
  compressForAvatar,
  createThumbnail,
  smartCompress,
  needsCompression,
  formatFileSize,
  getCompressionSavings,
  CompressionPresets,
};
