'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  X,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { groupProductsByProductId, GroupedProduct, VariantInfo } from '@/lib/productHelpers'
import { fetchProductsForPurchaser, fetchSuppliersForPurchaser, SupplierInfo, getPurchaserIntegerId } from '@/lib/supplierHelpers'
import { extractImages } from '@/lib/imageHelpers'

// Use GroupedProduct as the Product interface
type Product = GroupedProduct

export default function ProductsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([]) // Store all products for filtering
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSupplier, setFilterSupplier] = useState<string>('all') // For purchasers
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]) // For purchasers
  const [supplierMap, setSupplierMap] = useState<Map<string, SupplierInfo>>(new Map()) // Map user_id to supplier info
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [viewerProduct, setViewerProduct] = useState<Product | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(false)
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set())

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    outOfStock: 0,
    totalValue: 0,
  })

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // Redirect agents to listings page (admin can access everything)
    if (!authLoading && isAuthenticated && userRole === 'agent') {
      router.push('/listings')
      return
    }

    if (isAuthenticated) {
      fetchProducts()
    }
  }, [isAuthenticated, authLoading, router])

  // Cache extracted images for the viewer product
  const viewerImages = useMemo(() => {
    if (!viewerProduct) return []
    return extractImages(viewerProduct.image)
  }, [viewerProduct])

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
          setPreloadedImages(prev => new Set([...prev, src]))
          resolve()
        }
        testImg.onerror = () => {
          // Still mark as attempted to avoid retrying
          setPreloadedImages(prev => new Set([...prev, src]))
          resolve()
        }
        testImg.src = src
        
        // If image is already complete (cached), resolve immediately
        if (testImg.complete) {
          setPreloadedImages(prev => new Set([...prev, src]))
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
              setPreloadedImages(prev => new Set([...prev, nextImage]))
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
              setPreloadedImages(prev => new Set([...prev, nextImage]))
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

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      let productsData: any[] = []

      if (userRole === 'purchaser' && userId) {
        // For purchasers: fetch products from all their suppliers
        // Get purchaser's integer ID
        const purchaserIntId = await getPurchaserIntegerId(userId)
        if (purchaserIntId) {
          productsData = await fetchProductsForPurchaser(purchaserIntId)
          
          // Also fetch suppliers for filter dropdown
          const supplierList = await fetchSuppliersForPurchaser(purchaserIntId)
          setSuppliers(supplierList)
          
          // Create map for quick lookup
          const map = new Map<string, SupplierInfo>()
          supplierList.forEach(s => {
            if (s.user_id) {
              map.set(s.user_id, s)
            }
          })
          setSupplierMap(map)
        }
      } else if (userRole === 'admin') {
        // For admin: fetch all products from all suppliers
        const { data, error: productsError } = await supabase
          .from('products')
          .select('*')
          .order('created_at', { ascending: false })

        if (productsError) {
          console.error('Error fetching products:', productsError)
          setProducts([])
          setAllProducts([])
          setIsLoading(false)
          return
        }

        productsData = data || []

        // Fetch all suppliers for filter dropdown
        const { data: supplierData, error: supplierError } = await supabase
          .from('users')
          .select('id, user_id, email, owner_name, store_name, phone_number, city, onboarded, created_at')
          .eq('role', 'supplier')
          .order('created_at', { ascending: false })

        if (!supplierError && supplierData) {
          setSuppliers(supplierData)
          const map = new Map<string, SupplierInfo>()
          supplierData.forEach(s => {
            if (s.user_id) {
              map.set(s.user_id, s)
            }
          })
          setSupplierMap(map)
        }
      } else {
        // For suppliers: fetch their own products
        const userFriendlyId = localStorage.getItem('userFriendlyId')
        if (!userFriendlyId) {
          setIsLoading(false)
          return
        }

        const { data, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('fk_owned_by', userFriendlyId)
          .order('created_at', { ascending: false })

        if (productsError) {
          console.error('Error fetching products:', productsError)
          setProducts([])
          setAllProducts([])
          setIsLoading(false)
          return
        }

        productsData = data || []
      }

      if (productsData.length > 0) {
        // Group rows by product_id
        const groupedProducts = groupProductsByProductId(productsData)
        setAllProducts(groupedProducts)
        applyFilters(groupedProducts)
        calculateStats(groupedProducts)
      } else {
        setAllProducts([])
        setProducts([])
        calculateStats([])
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setProducts([])
      setAllProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = (productsToFilter: Product[] = allProducts) => {
    let filtered = [...productsToFilter]

    // Apply supplier filter (for purchasers and admin)
    if ((userRole === 'purchaser' || userRole === 'admin') && filterSupplier !== 'all') {
      filtered = filtered.filter(p => p.fk_owned_by === filterSupplier)
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'out_of_stock') {
        filtered = filtered.filter(product => {
          const hasVariants = product.variants && product.variants.length > 0
          if (hasVariants) {
            return product.variants!.every(v => (v.variant_stock || 0) === 0)
          }
          return (product.variants[0]?.variant_stock || 0) === 0
        })
      } else {
        filtered = filtered.filter(p => p.status === filterStatus)
      }
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(product => {
        return (
          product.product_title.toLowerCase().includes(query) ||
          product.bar_code.toLowerCase().includes(query) ||
          product.variants.some(v => v.bar_code?.toLowerCase().includes(query) || '')
        )
      })
    }

    setProducts(filtered)
  }

  // Update filters when they change
  useEffect(() => {
    if (allProducts.length > 0 || products.length > 0) {
      applyFilters()
    }
  }, [filterStatus, filterSupplier, searchQuery])

  const calculateStats = (productsData: Product[]) => {
    const total = productsData.length
    
    // Calculate stats based on status and variants
    let active = 0
    let inactive = 0
    let outOfStock = 0
    let totalValue = 0

    productsData.forEach(product => {
      const productStatus = product.status || 'active'
      
      if (product.variants && product.variants.length > 0) {
        // Product with variants
        const variantStock = product.variants.reduce((sum, v) => sum + (v.variant_stock || 0), 0)
        const variantValue = product.variants.reduce((sum, v) => sum + (v.variant_selling_price * (v.variant_stock || 0)), 0)
        
        totalValue += variantValue
        
        if (productStatus === 'inactive') {
          inactive++
        } else if (variantStock === 0) {
          outOfStock++
        } else {
          active++
        }
      } else {
        // Product without variants - get price and stock from first row's variant fields
        // Since products without variants still have variant_selling_price and variant_stock
        const productPrice = product.variants.length > 0 
          ? product.variants[0].variant_selling_price 
          : 0
        const productStock = product.variants.length > 0
          ? product.variants[0].variant_stock
          : 0
        const productValue = productPrice * productStock
        totalValue += productValue
        
        if (productStatus === 'inactive') {
          inactive++
        } else if (productStock === 0) {
          outOfStock++
        } else {
          active++
        }
      }
    })

    setStats({
      total,
      active,
      inactive,
      outOfStock,
      totalValue,
    })
  }

  const handleStatusChange = async (productId: number, newStatus: string) => {
    try {
      // Update all rows for this product_id (since status is the same for all variants)
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('product_id', productId)

      if (error) {
        console.error('Error updating product status:', error)
        alert('Failed to update product status. Please try again.')
        return
      }

      // Update local state
      setProducts(prevProducts =>
        prevProducts.map(p =>
          p.product_id === productId ? { ...p, status: newStatus as 'active' | 'inactive' } : p
        )
      )

      // Recalculate stats
      const updatedProducts = products.map(p =>
        p.product_id === productId ? { ...p, status: newStatus as 'active' | 'inactive' } : p
      )
      calculateStats(updatedProducts)
    } catch (err) {
      console.error('Unexpected error updating status:', err)
      alert('An unexpected error occurred. Please try again.')
    }
  }

  const filteredProducts = products.filter(product => {
    const status = product.status || 'active'

    const matchesSearch = product.product_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.bar_code.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || status === filterStatus

    return matchesSearch && matchesFilter
  })

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-dark-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-bg transition-colors">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-8">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Products</h2>
              <p className="text-gray-600 dark:text-gray-400">Manage your product inventory</p>
            </div>
            <button
              onClick={() => router.push('/products/new')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Product
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Products</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Active</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.active}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Inactive</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.inactive}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Out of Stock</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{stats.outOfStock}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 hover:border-gray-400 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">Total Value</p>
                  <h3 className="text-3xl font-bold text-gray-900 dark:text-white">PKR {stats.totalValue.toLocaleString()}</h3>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products by name or bar code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                />
              </div>
              {(userRole === 'purchaser' || userRole === 'admin') && suppliers.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-4 top-3.5 text-gray-400" size={20} />
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="pl-12 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.user_id} value={supplier.user_id}>
                        {supplier.store_name || supplier.owner_name || supplier.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <Filter className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="pl-12 pr-10 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl overflow-hidden">
            {products.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-dark-hover rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {products.length === 0 ? 'No products yet' : 'No products found'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {products.length === 0 
                    ? 'Get started by adding your first product' 
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {products.length === 0 && (
                  <button
                    onClick={() => router.push('/products/new')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Add Your First Product
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-hover border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Product</th>
                      {(userRole === 'purchaser' || userRole === 'admin') && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Supplier</th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Zambeel Sku</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {products.map((product) => {
                      const hasVariants = product.variants && product.variants.length > 0
                      const totalStock = hasVariants
                        ? product.variants!.reduce((sum, v) => sum + (v.variant_stock || 0), 0)
                        : product.variants.length > 0
                          ? product.variants[0].variant_stock
                          : 0
                      const status = product.status || 'active' // Use status from database
                      const displayPrice = hasVariants && product.variants!.length > 0
                        ? `PKR ${Math.min(...product.variants!.map(v => v.variant_selling_price)).toLocaleString()} - ${Math.max(...product.variants!.map(v => v.variant_selling_price)).toLocaleString()}`
                        : product.variants.length > 0 && product.variants[0].variant_selling_price
                          ? `PKR ${product.variants[0].variant_selling_price.toLocaleString()}`
                          : 'PKR 0'

                      const supplierInfo = (userRole === 'purchaser' || userRole === 'admin') ? supplierMap.get(product.fk_owned_by) : null

                      return (
                        <tr key={product.product_id} className="hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {(() => {
                                // Use extractImages helper to handle all image formats
                                const images = extractImages(product.image)
                                const imageUrl = images.length > 0 ? images[0] : undefined
                                return imageUrl ? (
                                  <button
                                    onClick={() => {
                                      setViewerProduct(product)
                                      setIsImageViewerOpen(true)
                                      setCurrentImageIndex(0)
                                    }}
                                    className="hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={product.product_title}
                                      className="w-12 h-12 rounded-lg object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  </button>
                                ) : null
                              })()}
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{product.product_title}</div>
                                {hasVariants && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    {product.variants!.length} variant{product.variants!.length > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {(userRole === 'purchaser' || userRole === 'admin') && (
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white">
                                {supplierInfo ? (
                                  <div>
                                    <div className="font-medium">{supplierInfo.store_name || supplierInfo.owner_name || 'Unnamed'}</div>
                                    {supplierInfo.store_name && supplierInfo.owner_name && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{supplierInfo.owner_name}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Unknown</span>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            {product.variants.length > 0 && product.variants[0].company_sku
                              ? (
                                  <span className="inline-flex px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-2 border-blue-200 dark:border-blue-800">
                                    Approved
                                  </span>
                                )
                              : (
                                  <span className="inline-flex px-3 py-1.5 text-xs font-semibold rounded-full bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400 border-2 border-pink-200 dark:border-pink-800 italic">
                                    Pending
                                  </span>
                                )
                            }
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{displayPrice}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                            {totalStock}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={status}
                              onChange={(e) => handleStatusChange(product.product_id, e.target.value)}
                              className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all cursor-pointer appearance-none bg-no-repeat bg-right pr-8 ${
                                status === 'active' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                              } hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-blue`}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                backgroundPosition: 'right 0.5rem center',
                                paddingRight: '2rem'
                              }}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setIsViewModalOpen(true)
                                }}
                                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all font-medium"
                              >
                                View Variants
                              </button>
                              <button
                                onClick={() => router.push(`/products/edit/${product.product_id}`)}
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* View Product Modal */}
      {isViewModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setIsViewModalOpen(false)}>
          <div className="bg-white dark:bg-dark-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Product Details</h2>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Product Image */}
              {(() => {
                // Get first image from array
                const images = extractImages(selectedProduct.image)
                const imageUrl = images.length > 0 ? images[0] : undefined
                return imageUrl ? (
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setViewerProduct(selectedProduct)
                        setIsImageViewerOpen(true)
                        setCurrentImageIndex(0)
                      }}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <img
                        src={imageUrl}
                        alt={selectedProduct.product_title}
                        className="w-64 h-64 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </button>
                  </div>
                ) : null
              })()}

              {/* Product Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Product Title</label>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">{selectedProduct.product_title}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Bar Code</label>
                  <p className="text-lg font-mono text-gray-900 dark:text-white mt-1">{selectedProduct.bar_code}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Price</label>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mt-1">
                    {selectedProduct.variants.length > 0 && selectedProduct.variants[0].variant_selling_price
                      ? `PKR ${selectedProduct.variants[0].variant_selling_price.toLocaleString()}`
                      : 'PKR 0'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Status</label>
                  <p className="mt-1">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      selectedProduct.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {selectedProduct.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Variants Summary */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Variants Summary ({selectedProduct.variants.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedProduct.variants.map((variant, index) => (
                      <div
                        key={variant.variant_id || index}
                        className="bg-gray-50 dark:bg-dark-hover rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {variant.size && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Size</label>
                              <p className="text-sm text-gray-900 dark:text-white mt-1">{variant.size}</p>
                            </div>
                          )}
                          {variant.color && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Color</label>
                              <p className="text-sm text-gray-900 dark:text-white mt-1">{variant.color}</p>
                            </div>
                          )}
                          {variant.ml && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">ML</label>
                              <p className="text-sm text-gray-900 dark:text-white mt-1">{variant.ml}</p>
                            </div>
                          )}
                          {variant.bar_code && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Bar Code</label>
                              <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{variant.bar_code}</p>
                            </div>
                          )}
                          {variant.company_sku && (
                            <div>
                              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Zambeel SKU</label>
                              <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{variant.company_sku}</p>
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Price</label>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                              PKR {variant.variant_selling_price.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Stock</label>
                            <p className={`text-sm font-medium mt-1 ${
                              variant.variant_stock === 0 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-gray-900 dark:text-white'
                            }`}>
                              {variant.variant_stock}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Variants Summary Stats */}
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Total Variants</label>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-300 mt-1">
                          {selectedProduct.variants.length}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Total Stock</label>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-300 mt-1">
                          {selectedProduct.variants.reduce((sum, v) => sum + (v.variant_stock || 0), 0)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-blue-600 dark:text-blue-400">Price Range</label>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-300 mt-1">
                          PKR {Math.min(...selectedProduct.variants.map(v => v.variant_selling_price)).toLocaleString()} - {Math.max(...selectedProduct.variants.map(v => v.variant_selling_price)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div>
                    <label className="text-sm font-semibold text-gray-500 dark:text-gray-400">Stock</label>
                    <p className={`text-lg font-medium mt-1 ${
                      (selectedProduct.variants.length > 0 ? selectedProduct.variants[0].variant_stock : 0) === 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {selectedProduct.variants.length > 0 ? selectedProduct.variants[0].variant_stock : 0}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">This product has no variants.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false)
                    router.push(`/products/edit/${selectedProduct.product_id}`)
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white font-semibold hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <Edit className="w-5 h-5" />
                  Edit Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {isImageViewerOpen && viewerProduct && viewerImages.length > 0 && (() => {
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
            link.download = `${viewerProduct.product_title.replace(/[^a-z0-9]/gi, '_')}-${currentImageIndex + 1}.jpg`
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
              setPreloadedImages(prev => new Set([...prev, nextImage]))
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
              setPreloadedImages(prev => new Set([...prev, nextImage]))
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
                  alt={`${viewerProduct.product_title} - Image ${currentImageIndex + 1}`}
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

