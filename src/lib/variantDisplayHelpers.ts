import { extractImages } from '@/lib/imageHelpers'

export const VARIANT_DIMENSION_ORDER = [
  'Battery Capacity',
  'Charger Type',
  'Material',
  'Sizes',
  'Bundle',
  'Weight',
  'Power Output',
  'Pack SIZE',
  'Color',
  'Flavours',
]

export function sortVariantOptionNames(optionNames: string[]): string[] {
  return [...optionNames].sort((a, b) => {
    const aIdx = VARIANT_DIMENSION_ORDER.indexOf(a)
    const bIdx = VARIANT_DIMENSION_ORDER.indexOf(b)
    const aOrder = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx
    const bOrder = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
}

export function formatVariantLabel(
  optionValues?: Record<string, string> | null,
  size?: string | null,
  color?: string | null
): string {
  if (optionValues && Object.keys(optionValues).length > 0) {
    const parts = sortVariantOptionNames(Object.keys(optionValues))
      .map((key) => optionValues[key])
      .filter(Boolean)
    if (parts.length > 0) return parts.join(' / ')
  }
  const legacy: string[] = []
  if (size) legacy.push(size)
  if (color) legacy.push(color)
  return legacy.length > 0 ? legacy.join(' / ') : 'Variant'
}

export function getVariantImageUrls(image: string | string[] | null | undefined): string[] {
  return extractImages(image ?? null)
}
