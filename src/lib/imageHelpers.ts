/**
 * Helper function to extract images from product.image
 * Handles JSONB array, string, or parsed JSON
 */
export function extractImages(imageData: string | string[] | null): string[] {
  if (!imageData) return []
  
  if (Array.isArray(imageData)) {
    return imageData.filter(img => img && typeof img === 'string')
  }
  
  if (typeof imageData === 'string') {
    // Try to parse if it's a JSON string
    try {
      const parsed = JSON.parse(imageData)
      if (Array.isArray(parsed)) {
        return parsed.filter(img => img && typeof img === 'string')
      }
    } catch {
      // Not JSON, treat as single image URL
    }
    return [imageData]
  }
  
  return []
}

