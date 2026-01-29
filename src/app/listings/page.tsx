'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Package, List, Loader2, ChevronDown, ChevronUp, Eye, X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { groupProductsByProductId, GroupedProduct, VariantInfo } from '@/lib/productHelpers'
import { extractImages } from '@/lib/imageHelpers'

// Use GroupedProduct as the Product interface
type Product = GroupedProduct

export default function ListingsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()
  const [activeTab, setActiveTab] = useState<'new' | 'old'>('new')
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // Redirect suppliers to dashboard (admin and agent can access)
    if (!authLoading && isAuthenticated) {
      if (userRole === 'supplier') {
        router.push('/dashboard')
        return
      }
      // Admin and agent can access listings
      if (userRole === 'agent' || userRole === 'admin') {
        fetchProducts()
      }
    }
  }, [isAuthenticated, authLoading, userRole, router, activeTab])

  const fetchProducts = async () => {
    setIsLoading(true)
    setError('')
    try {
      // Fetch all product rows (each variant is a separate row now)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false })

      if (productsError) {
        console.error('Error fetching products:', productsError)
        setError('Failed to load products')
        setIsLoading(false)
        return
      }

      if (productsData) {
        // Group rows by product_id
        const groupedProducts = groupProductsByProductId(productsData)
        setAllProducts(groupedProducts)
        
        // Filter products based on active tab
        if (activeTab === 'new') {
          // New Listings: Products where at least one variant doesn't have company_sku
          // OR products without variants (variant_id is null) that don't have company_sku
          const newProducts = groupedProducts.filter((product) => {
            if (product.variants.length === 0) {
              // Product without variants - check if it has company_sku in any row
              // Since we grouped, we need to check the original data
              // For now, products without variants are considered "new" if they exist
              return true
            }
            return product.variants.some((v: VariantInfo) => !v.company_sku || v.company_sku.trim() === '')
          })
          setProducts(newProducts)
        } else {
          // Old Listings: Products where all variants have company_sku
          const oldProducts = groupedProducts.filter((product) => {
            if (product.variants.length === 0) {
              // Products without variants - check original rows
              // For now, skip products without variants in old listings
              return false
            }
            return product.variants.every((v: VariantInfo) => v.company_sku && v.company_sku.trim() !== '')
          })
          setProducts(oldProducts)
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSKUUpdate = async (variantId: number, companySKU: string) => {
    try {
      // Update the products table directly (variant_id is now a column in products table)
      const { error } = await supabase
        .from('products')
        .update({ company_sku: companySKU.trim() || null })
        .eq('variant_id', variantId)

      if (error) {
        console.error('Error updating company SKU:', error)
        alert('Failed to update company SKU. Please try again.')
        return false
      }

      // Refresh products to update the view
      fetchProducts()
      return true
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred')
      return false
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-dark-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-dark-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Product Listings</h1>

            {/* Tabs */}
            <div className="mb-6 flex gap-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('new')}
                className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                  activeTab === 'new'
                    ? 'text-primary-blue border-primary-blue'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                New Listings ({allProducts.filter(p => {
                  if (p.variants.length === 0) return true // Products without variants
                  return p.variants.some(v => !v.company_sku || v.company_sku.trim() === '')
                }).length})
              </button>
              <button
                onClick={() => setActiveTab('old')}
                className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                  activeTab === 'old'
                    ? 'text-primary-blue border-primary-blue'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Old Listings ({allProducts.filter(p => {
                  if (p.variants.length === 0) return false
                  return p.variants.every(v => v.company_sku && v.company_sku.trim() !== '')
                }).length})
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            {/* Products List */}
            {products.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {activeTab === 'new' 
                    ? 'No new listings to process' 
                    : 'No listings with assigned SKUs'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {products.map((product) => (
                  <ProductListingCard
                    key={product.product_id}
                    product={product}
                    onSKUUpdate={handleSKUUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// Product Listing Card Component
function ProductListingCard({ 
  product, 
  onSKUUpdate 
}: { 
  product: Product
  onSKUUpdate: (variantId: number, companySKU: string) => Promise<boolean>
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [skuInputs, setSkuInputs] = useState<{ [key: number]: string }>({})
  const [isSaving, setIsSaving] = useState<{ [key: number]: boolean }>({})
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(false)
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())

  // Cache extracted images
  const viewerImages = useMemo(() => {
    return extractImages(product.image)
  }, [product.image])

  useEffect(() => {
    // Initialize SKU inputs with current company_sku values
    const initialSKUs: { [key: number]: string } = {}
    product.variants?.forEach(variant => {
      initialSKUs[variant.variant_id] = variant.company_sku || ''
    })
    setSkuInputs(initialSKUs)
  }, [product.variants])

  // Reset state when viewer closes
  useEffect(() => {
    if (!isImageViewerOpen) {
      setPreloadedImages(new Set())
      setImageLoading(false)
      setCurrentImageIndex(0)
    }
  }, [isImageViewerOpen])

  // Preload ALL images when viewer opens
  useEffect(() => {
    if (!isImageViewerOpen || viewerImages.length === 0) return

    // Preload all images immediately when viewer opens
    const preloadPromises = viewerImages.map((src) => {
      return new Promise<void>((resolve) => {
        if (preloadedImages.has(src)) {
          resolve()
          return
        }
        
        // Check if image is already in browser cache
        const testImg = new Image()
        testImg.onload = () => {
          setPreloadedImages(prev => new Set([...Array.from(prev), src]))
          resolve()
        }
        testImg.onerror = () => {
          // Still mark as attempted to avoid retrying
          setPreloadedImages(prev => new Set([...Array.from(prev), src]))
          resolve()
        }
        testImg.src = src
        
        // If image is already complete (cached), resolve immediately
        if (testImg.complete) {
          setPreloadedImages(prev => new Set([...Array.from(prev), src]))
          resolve()
        }
      })
    })

    // Start preloading all images in parallel
    Promise.all(preloadPromises).catch(() => {
      // Ignore errors, images will load on demand
    })
  }, [isImageViewerOpen, viewerImages])

  // Keyboard navigation for image viewer
  useEffect(() => {
    if (!isImageViewerOpen || viewerImages.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setIsImageViewerOpen(false)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (viewerImages.length > 1) {
          const newIndex = currentImageIndex === 0 ? viewerImages.length - 1 : currentImageIndex - 1
          const nextImage = viewerImages[newIndex]
          if (preloadedImages.has(nextImage)) {
            setCurrentImageIndex(newIndex)
          } else {
            setImageLoading(true)
            const img = new Image()
            img.onload = () => {
              setPreloadedImages(prev => new Set([...Array.from(prev), nextImage]))
              setCurrentImageIndex(newIndex)
            }
            img.onerror = () => setCurrentImageIndex(newIndex)
            img.src = nextImage
          }
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (viewerImages.length > 1) {
          const newIndex = currentImageIndex === viewerImages.length - 1 ? 0 : currentImageIndex + 1
          const nextImage = viewerImages[newIndex]
          if (preloadedImages.has(nextImage)) {
            setCurrentImageIndex(newIndex)
          } else {
            setImageLoading(true)
            const img = new Image()
            img.onload = () => {
              setPreloadedImages(prev => new Set([...Array.from(prev), nextImage]))
              setCurrentImageIndex(newIndex)
            }
            img.onerror = () => setCurrentImageIndex(newIndex)
            img.src = nextImage
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isImageViewerOpen, viewerImages, currentImageIndex, preloadedImages])

  const handleSKUChange = (variantId: number, value: string) => {
    setSkuInputs(prev => ({
      ...prev,
      [variantId]: value
    }))
  }

  const handleSaveSKU = async (variantId: number) => {
    setIsSaving(prev => ({ ...prev, [variantId]: true }))
    const success = await onSKUUpdate(variantId, skuInputs[variantId] || '')
    setIsSaving(prev => ({ ...prev, [variantId]: false }))
    
    if (success) {
      // Optionally show success message
    }
  }

  const handleBulkSave = async () => {
    if (!product.variants) return
    
    for (const variant of product.variants) {
      if (skuInputs[variant.variant_id] !== (variant.company_sku || '')) {
        setIsSaving(prev => ({ ...prev, [variant.variant_id]: true }))
        await onSKUUpdate(variant.variant_id, skuInputs[variant.variant_id] || '')
        setIsSaving(prev => ({ ...prev, [variant.variant_id]: false }))
      }
    }
  }

  const hasChanges = product.variants?.some(variant => 
    skuInputs[variant.variant_id] !== (variant.company_sku || '')
  )

  const hasVariants = product.variants && product.variants.length > 0
  const totalVariants = product.variants?.length || 0
  const variantsWithSKU = product.variants?.filter(v => v.company_sku && v.company_sku.trim() !== '').length || 0

  return (
    <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      {/* Main Product Row */}
      <div className="p-4 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
        <div className="flex items-center gap-4">
          {/* Product Image */}
          {(() => {
            // Get first image from array
            const images = extractImages(product.image)
            const imageUrl = images.length > 0 ? images[0] : undefined
            return imageUrl ? (
              <button
                onClick={() => {
                  setIsImageViewerOpen(true)
                  setCurrentImageIndex(0)
                }}
                className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <img
                  src={imageUrl}
                  alt={product.product_title}
                  className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </button>
            ) : null
          })()}

          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {product.product_title}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span><strong>Bar Code:</strong> <span className="font-mono">{product.bar_code}</span></span>
                  <span><strong>Price:</strong> {
                    product.variants.length > 0 && product.variants[0].variant_selling_price
                      ? `PKR ${product.variants[0].variant_selling_price.toLocaleString()}`
                      : 'PKR 0'
                  }</span>
                  {hasVariants && (
                    <span><strong>Variants:</strong> {variantsWithSKU}/{totalVariants} assigned</span>
                  )}
                  <span><strong>Status:</strong> 
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                      product.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {product.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                </div>
              </div>

              {/* View Variants Button */}
              {hasVariants && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-colors text-sm font-medium flex-shrink-0"
                >
                  <Eye className="w-4 h-4" />
                  View Variants
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Variants Section */}
      {isExpanded && hasVariants && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-dark-hover p-6">
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Variants ({totalVariants})
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Assign company SKU codes to each variant below
            </p>
          </div>

          <div className="space-y-4">
            {product.variants && product.variants.map((variant) => (
              <div
                key={variant.variant_id}
                className="bg-white dark:bg-dark-card rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    {variant.size && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Size</label>
                        <p className="text-sm text-gray-900 dark:text-white">{variant.size}</p>
                      </div>
                    )}
                    {variant.color && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Color</label>
                        <p className="text-sm text-gray-900 dark:text-white">{variant.color}</p>
                      </div>
                    )}
                    {variant.ml && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">ML</label>
                        <p className="text-sm text-gray-900 dark:text-white">{variant.ml}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Variant SKU</label>
                      <p className="text-sm font-mono text-gray-900 dark:text-white">{variant.bar_code || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Price</label>
                      <p className="text-sm text-gray-900 dark:text-white">PKR {variant.variant_selling_price.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Stock</label>
                      <p className={`text-sm font-medium ${
                        variant.variant_stock === 0 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {variant.variant_stock}
                      </p>
                    </div>
                  </div>

                  {/* Company SKU Input */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Company SKU
                      </label>
                      <input
                        type="text"
                        value={skuInputs[variant.variant_id] || ''}
                        onChange={(e) => handleSKUChange(variant.variant_id, e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-card text-gray-900 dark:text-white text-sm font-mono focus:border-primary-blue focus:outline-none"
                        placeholder="Enter company SKU"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveSKU(variant.variant_id)}
                      disabled={isSaving[variant.variant_id] || skuInputs[variant.variant_id] === (variant.company_sku || '')}
                      className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
                    >
                      {isSaving[variant.variant_id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Save'
                      )}
                    </button>
                  </div>
                </div>
              ))}

            {/* Bulk Save Button */}
            {hasChanges && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleBulkSave}
                  disabled={Object.values(isSaving).some(v => v)}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2"
                >
                  {Object.values(isSaving).some(v => v) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save All Changes'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {isImageViewerOpen && viewerImages.length > 0 && (() => {
        const currentImage = viewerImages[currentImageIndex]
        const hasMultipleImages = viewerImages.length > 1

        const handleDownload = async (e: React.MouseEvent) => {
          e.stopPropagation()
          try {
            // Fetch image as blob to handle CORS
            const response = await fetch(currentImage)
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${product.product_title.replace(/[^a-z0-9]/gi, '_')}-${currentImageIndex + 1}.jpg`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
          } catch (error) {
            console.error('Download failed:', error)
            // Fallback: open in new tab
            window.open(currentImage, '_blank')
          }
        }

        const handlePrevious = () => {
          const newIndex = currentImageIndex === 0 ? viewerImages.length - 1 : currentImageIndex - 1
          const nextImage = viewerImages[newIndex]
          
          // Check if image is already preloaded
          if (preloadedImages.has(nextImage)) {
            setCurrentImageIndex(newIndex)
          } else {
            // Preload the image first, then navigate
            setImageLoading(true)
            const img = new Image()
            img.onload = () => {
              setPreloadedImages(prev => new Set([...Array.from(prev), nextImage]))
              setCurrentImageIndex(newIndex)
            }
            img.onerror = () => {
              setCurrentImageIndex(newIndex)
            }
            img.src = nextImage
          }
        }

        const handleNext = () => {
          const newIndex = currentImageIndex === viewerImages.length - 1 ? 0 : currentImageIndex + 1
          const nextImage = viewerImages[newIndex]
          
          // Check if image is already preloaded
          if (preloadedImages.has(nextImage)) {
            setCurrentImageIndex(newIndex)
          } else {
            // Preload the image first, then navigate
            setImageLoading(true)
            const img = new Image()
            img.onload = () => {
              setPreloadedImages(prev => new Set([...Array.from(prev), nextImage]))
              setCurrentImageIndex(newIndex)
            }
            img.onerror = () => {
              setCurrentImageIndex(newIndex)
            }
            img.src = nextImage
          }
        }

        return (
          <div 
            className="fixed inset-0 bg-black/90 dark:bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setIsImageViewerOpen(false)}
          >
            <div 
              className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageViewerOpen(false)
                }}
                className="absolute top-4 right-4 z-50 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Previous Button */}
              {hasMultipleImages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevious()
                  }}
                  className="absolute left-4 z-50 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              {/* Image */}
              <div className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
                <img
                  src={currentImage}
                  alt={`${product.product_title} - Image ${currentImageIndex + 1}`}
                  className={`max-w-full max-h-[90vh] object-contain rounded-lg transition-opacity duration-200 ${
                    imageLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                  draggable={false}
                  onLoadStart={() => setImageLoading(true)}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </div>

              {/* Next Button */}
              {hasMultipleImages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNext()
                  }}
                  className="absolute right-4 z-50 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Image Counter */}
              {hasMultipleImages && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm font-medium shadow-lg">
                  {currentImageIndex + 1} / {viewerImages.length}
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="absolute bottom-4 right-4 z-50 px-4 py-2 bg-primary-blue hover:bg-primary-blue-dark rounded-lg text-white transition-colors flex items-center gap-2 font-medium shadow-lg"
              >
                <Download className="w-5 h-5" />
                Download
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

