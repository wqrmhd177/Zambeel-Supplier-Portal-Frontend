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
  CheckCircle,
  Clock,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  Ruler,
  Palette,
  Tag,
  Box
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { groupProductsByProductId, GroupedProduct, VariantInfo } from '@/lib/productHelpers'
import { fetchProductsForPurchaser, fetchSuppliersForPurchaser, SupplierInfo, getPurchaserIntegerId } from '@/lib/supplierHelpers'
import { extractImages } from '@/lib/imageHelpers'
import { fetchPendingPriceRequests, PriceHistoryEntry, createPriceHistoryEntry } from '@/lib/priceHistoryHelpers'
import { getCurrencyForUserId, getCurrenciesForUserIds } from '@/lib/currencyHelpers'

// Use GroupedProduct as the Product interface
type Product = GroupedProduct

/** Display status from status + company_sku: Pending Approval, Active, or Inactive */
function getDisplayStatus(product: Product): 'Pending Approval' | 'Active' | 'Inactive' {
  const status = product.status || 'active'
  const hasCompanySku = product.variants?.some(v => v.company_sku != null && String(v.company_sku).trim() !== '') ?? false
  if (status === 'active' && !hasCompanySku) return 'Pending Approval'
  if (status === 'active' && hasCompanySku) return 'Active'
  if (status === 'inactive' && hasCompanySku) return 'Pending Approval'
  return 'Inactive'
}

export default function ProductsPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId, userFriendlyId } = useAuth()
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
  
  // View Variants modal: edit prices only
  const [isEditingPrices, setIsEditingPrices] = useState(false)
  const [editedVariantPrices, setEditedVariantPrices] = useState<Map<number, number>>(new Map())
  const [isSavingPrices, setIsSavingPrices] = useState(false)
  const [priceSaveError, setPriceSaveError] = useState('')
  const [priceSaveSuccess, setPriceSaveSuccess] = useState('')
  
  // Pending price changes
  const [pendingPriceChanges, setPendingPriceChanges] = useState<Map<number, PriceHistoryEntry>>(new Map())

  // Currency by stock location (current user when supplier, per-owner when purchaser/admin)
  const [currentUserCurrency, setCurrentUserCurrency] = useState<string>('USD')
  const [currencyByOwnerId, setCurrencyByOwnerId] = useState<Map<string, string>>(new Map())

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pendingApproval: 0,
    active: 0,
    inactive: 0,
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

  const fetchPendingChanges = async () => {
    try {
      const pending = await fetchPendingPriceRequests()
      const map = new Map<number, PriceHistoryEntry>()
      pending.forEach(req => map.set(req.variant_id, req))
      setPendingPriceChanges(map)
    } catch (err) {
      console.error('Error fetching pending price changes:', err)
    }
  }

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      let productsData: any[] = []

      if (userRole === 'purchaser' && userId) {
        // For purchasers: fetch products from all their suppliers
        // Get purchaser's integer ID for products
        const purchaserIntId = await getPurchaserIntegerId(userId)
        if (purchaserIntId) {
          productsData = await fetchProductsForPurchaser(purchaserIntId)
        }
        
        // Fetch suppliers from same country for filter dropdown
        const supplierList = await fetchSuppliersForPurchaser(userId)
        setSuppliers(supplierList)
        
        // Create map for quick lookup
        const map = new Map<string, SupplierInfo>()
        supplierList.forEach(s => {
          if (s.user_id) {
            map.set(s.user_id, s)
          }
        })
        setSupplierMap(map)
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
          .select('id, user_id, email, shop_name_on_zambeel, country, phone_number, onboarded, account_approval, created_at')
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
      
      // Fetch pending price changes
      await fetchPendingChanges()
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
        return product.product_title.toLowerCase().includes(query)
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
    let pendingApproval = 0
    let active = 0
    let inactive = 0

    productsData.forEach(product => {
      const displayStatus = getDisplayStatus(product)
      if (displayStatus === 'Pending Approval') pendingApproval++
      else if (displayStatus === 'Active') active++
      else inactive++
    })

    setStats({
      total,
      pendingApproval,
      active,
      inactive,
    })
  }

  // Recalculate stats when pending price changes load/update
  useEffect(() => {
    if (allProducts.length > 0) {
      calculateStats(allProducts)
    }
  }, [pendingPriceChanges, allProducts])

  // Currency: current user when supplier, per-owner when purchaser/admin
  useEffect(() => {
    const run = async () => {
      if (userRole === 'supplier') {
        const id = userFriendlyId || userId
        if (id) {
          const currency = await getCurrencyForUserId(id)
          setCurrentUserCurrency(currency)
        }
        return
      }
      if ((userRole === 'purchaser' || userRole === 'admin') && allProducts.length > 0) {
        const ownerIds = Array.from(new Set(allProducts.map((p) => p.fk_owned_by).filter(Boolean)))
        const map = await getCurrenciesForUserIds(ownerIds)
        setCurrencyByOwnerId(map)
      }
    }
    run()
  }, [userRole, userFriendlyId, userId, allProducts])

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

  const handleOpenModalForEditPrices = (product: Product) => {
    setSelectedProduct(product)
    setPriceSaveError('')
    setPriceSaveSuccess('')
    setIsViewModalOpen(true)
    if (product.variants && product.variants.length > 0) {
      setEditedVariantPrices(new Map(product.variants.map(v => [v.variant_id, v.variant_selling_price])))
      setIsEditingPrices(true)
    } else {
      setEditedVariantPrices(new Map())
      setIsEditingPrices(false)
    }
  }

  const handleStartEditPrices = () => {
    if (!selectedProduct) return
    setEditedVariantPrices(new Map(selectedProduct.variants.map(v => [v.variant_id, v.variant_selling_price])))
    setIsEditingPrices(true)
    setPriceSaveError('')
    setPriceSaveSuccess('')
  }

  const handleCancelEditPrices = () => {
    setIsEditingPrices(false)
    setEditedVariantPrices(new Map())
    setPriceSaveError('')
    setPriceSaveSuccess('')
  }

  const handleSavePrices = async () => {
    if (!selectedProduct || selectedProduct.variants.length === 0) return
    const hasAnyChange = selectedProduct.variants.some(
      v => (editedVariantPrices.get(v.variant_id) ?? v.variant_selling_price) !== v.variant_selling_price
    )
    if (!hasAnyChange) {
      handleCancelEditPrices()
      return
    }
    setIsSavingPrices(true)
    setPriceSaveError('')
    setPriceSaveSuccess('')
    try {
      const productIdNum = selectedProduct.product_id
      let hasPendingChanges = false
      const purchaserIntId = (userRole === 'purchaser' && userId) ? await getPurchaserIntegerId(userId) : null

      for (const variant of selectedProduct.variants) {
        const newPrice = editedVariantPrices.get(variant.variant_id) ?? variant.variant_selling_price
        const oldPrice = variant.variant_selling_price
        const priceChanged = oldPrice !== newPrice

        if (!priceChanged) continue

        const { error: updateError } = await supabase
          .from('products')
          .update({
            variant_selling_price: oldPrice,
            updated_at: new Date().toISOString(),
          })
          .eq('variant_id', variant.variant_id)
          .eq('product_id', productIdNum)

        if (updateError) {
          setPriceSaveError(updateError.message || 'Failed to save price. Please try again.')
          setIsSavingPrices(false)
          return
        }

        if (userFriendlyId) {
          await createPriceHistoryEntry(
            productIdNum,
            variant.variant_id,
            oldPrice,
            newPrice,
            userFriendlyId,
            purchaserIntId ?? null,
            'pending'
          )
          hasPendingChanges = true
        }
      }

      setPriceSaveSuccess(hasPendingChanges ? 'Price changes submitted for approval.' : 'Prices saved.')
      await fetchProducts()
      setIsEditingPrices(false)
      setEditedVariantPrices(new Map())
    } catch (err) {
      console.error('Error saving prices:', err)
      setPriceSaveError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSavingPrices(false)
    }
  }

  const handleCloseViewModal = () => {
    setIsViewModalOpen(false)
    handleCancelEditPrices()
  }

  const filteredProducts = products.filter(product => {
    const status = product.status || 'active'

    const matchesSearch = product.product_title.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesFilter = filterStatus === 'all' || status === filterStatus

    return matchesSearch && matchesFilter
  })

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex h-screen bg-[#f5f3ff]">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-4 sm:p-6 lg:p-8 bg-[#f5f3ff]">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 theme-heading-gradient">Products</h2>
              <p className="text-sm sm:text-base text-gray-600">Manage your product inventory</p>
            </div>
            <button
              onClick={() => router.push('/products/new')}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-all flex items-center justify-center gap-2 text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Add Product
            </button>
          </div>

          {/* Stats Cards: Total Products, Pending Approval, Active, Inactive */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
            <div className="theme-card rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div>
                  <p className="theme-label text-xs sm:text-sm mb-1">Total Products</p>
                  <h3 className="text-2xl sm:text-3xl font-bold theme-heading">{stats.total}</h3>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-md">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="theme-card rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div>
                  <p className="theme-label text-xs sm:text-sm mb-1">Pending Approval</p>
                  <h3 className="text-2xl sm:text-3xl font-bold theme-heading">{stats.pendingApproval}</h3>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="theme-card rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div>
                  <p className="theme-label text-xs sm:text-sm mb-1">Active</p>
                  <h3 className="text-2xl sm:text-3xl font-bold theme-heading">{stats.active}</h3>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-md">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="theme-card rounded-xl sm:rounded-2xl p-4 sm:p-6 transition-all hover:shadow-lg">
              <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div>
                  <p className="theme-label text-xs sm:text-sm mb-1">Inactive</p>
                  <h3 className="text-2xl sm:text-3xl font-bold theme-heading">{stats.inactive}</h3>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-md">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="theme-box rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 text-white/50" size={18} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-white/20 rounded-lg sm:rounded-xl bg-white/10 text-white focus:border-violet-400 focus:bg-white/15 focus:outline-none placeholder:text-white/50"
                />
              </div>
              {(userRole === 'purchaser' || userRole === 'admin') && suppliers.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 text-white/50" size={18} />
                  <select
                    value={filterSupplier}
                    onChange={(e) => setFilterSupplier(e.target.value)}
                    className="w-full sm:w-auto pl-10 sm:pl-12 pr-8 sm:pr-10 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-white/20 rounded-lg sm:rounded-xl bg-white/10 text-white focus:border-violet-400 focus:outline-none appearance-none cursor-pointer [&>option]:bg-[#1e1b4b] [&>option]:text-white"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.user_id} value={supplier.user_id}>
                        {supplier.shop_name_on_zambeel || supplier.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <Filter className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 text-white/50" size={18} />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full sm:w-auto pl-10 sm:pl-12 pr-8 sm:pr-10 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-white/20 rounded-lg sm:rounded-xl bg-white/10 text-white focus:border-violet-400 focus:outline-none appearance-none cursor-pointer [&>option]:bg-[#1e1b4b] [&>option]:text-white"
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
          <div className="theme-card rounded-xl sm:rounded-2xl overflow-hidden">
            {products.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white/60" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold theme-heading mb-2">
                  {products.length === 0 ? 'No products yet' : 'No products found'}
                </h3>
                <p className="text-sm sm:text-base theme-muted mb-4 sm:mb-6">
                  {products.length === 0 
                    ? 'Get started by adding your first product' 
                    : 'Try adjusting your search or filter criteria'}
                </p>
                {products.length === 0 && (
                  <button
                    onClick={() => router.push('/products/new')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg font-medium hover:opacity-90 transition-all text-white inline-flex items-center gap-2 shadow-lg"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                    Add Your First Product
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-white/10 border-b border-white/20">
                    <tr>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Product</th>
                      {(userRole === 'purchaser' || userRole === 'admin') && (
                        <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Supplier</th>
                      )}
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Price</th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Stock</th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-semibold theme-label uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-right text-xs font-semibold theme-label uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {products.map((product) => {
                      const hasVariants = product.variants && product.variants.length > 0
                      const totalStock = hasVariants
                        ? product.variants!.reduce((sum, v) => sum + (v.variant_stock || 0), 0)
                        : product.variants.length > 0
                          ? product.variants[0].variant_stock
                          : 0
                      const status = product.status || 'active' // Use status from database
                      
                      // Check if any variant has a pending price change
                      const pendingVariants = product.variants.filter(v => pendingPriceChanges.has(v.variant_id))
                      const hasPendingChanges = pendingVariants.length > 0
                      
                      // Display price (show old price if pending, current price otherwise); currency from stock location
                      const currency = userRole === 'supplier' ? currentUserCurrency : (currencyByOwnerId.get(product.fk_owned_by) ?? 'USD')
                      let displayPrice = ''
                      if (hasVariants && product.variants!.length > 0) {
                        const minPrice = Math.min(...product.variants!.map(v => v.variant_selling_price))
                        const maxPrice = Math.max(...product.variants!.map(v => v.variant_selling_price))
                        // Only show range if prices are different
                        if (minPrice === maxPrice) {
                          displayPrice = `${currency} ${minPrice.toLocaleString()}`
                        } else {
                          displayPrice = `${currency} ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`
                        }
                      } else if (product.variants.length > 0 && product.variants[0].variant_selling_price) {
                        displayPrice = `${currency} ${product.variants[0].variant_selling_price.toLocaleString()}`
                      } else {
                        displayPrice = `${currency} 0`
                      }

                      const supplierInfo = (userRole === 'purchaser' || userRole === 'admin') ? supplierMap.get(product.fk_owned_by) : null

                      return (
                        <tr key={product.product_id} className="hover:bg-white/5 transition-colors">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
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
                                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  </button>
                                ) : null
                              })()}
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-medium theme-heading truncate">{product.product_title}</div>
                                {hasVariants && (
                                  <div className="text-xs text-violet-300 mt-1">
                                    {product.variants!.length} variant{product.variants!.length > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {(userRole === 'purchaser' || userRole === 'admin') && (
                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                              <div className="text-xs sm:text-sm theme-heading">
                                {supplierInfo ? (
                                  <div>
                                    <div className="font-medium">{supplierInfo.shop_name_on_zambeel || 'Unnamed'}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400">Unknown</span>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-medium theme-heading whitespace-nowrap">{displayPrice}</span>
                              {hasPendingChanges && (
                                <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Pending Approval
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm theme-heading">
                            {totalStock}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            {getDisplayStatus(product) === 'Pending Approval' ? (
                              <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Pending Approval
                              </span>
                            ) : (
                              <select
                                value={status}
                                onChange={(e) => handleStatusChange(product.product_id, e.target.value)}
                                className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full border-2 transition-all cursor-pointer appearance-none bg-no-repeat bg-right pr-8 ${
                                  status === 'active'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
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
                            )}
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-right">
                            <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <button
                                onClick={() => {
                                  setSelectedProduct(product)
                                  setIsViewModalOpen(true)
                                }}
                                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm theme-label hover:text-violet-300 hover:bg-white/10 rounded-lg transition-all font-medium whitespace-nowrap"
                              >
                                <span className="hidden sm:inline">View Variants</span>
                                <span className="sm:hidden">View</span>
                              </button>
                              <button
                                onClick={() => handleOpenModalForEditPrices(product)}
                                className="p-1.5 sm:p-2 theme-muted hover:text-violet-300 hover:bg-white/10 rounded-lg transition-all"
                                title="Edit prices"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1.5 sm:p-2 theme-muted hover:text-red-300 hover:bg-white/10 rounded-lg transition-all"
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

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {products.map((product) => {
                  const hasVariants = product.variants && product.variants.length > 0
                  const status = product.status || 'active'
                  const displayStatus = getDisplayStatus(product)
                  const images = extractImages(product.image)
                  const imageUrl = images.length > 0 ? images[0] : undefined

                  return (
                    <div key={product.product_id} className="theme-card rounded-xl p-4 flex items-center gap-3">
                      {/* Product Image & Title */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {imageUrl && (
                          <button
                            onClick={() => {
                              setViewerProduct(product)
                              setIsImageViewerOpen(true)
                              setCurrentImageIndex(0)
                            }}
                            className="hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
                          >
                            <img
                              src={imageUrl}
                              alt={product.product_title}
                              className="w-16 h-16 rounded-lg object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium theme-heading truncate">{product.product_title}</div>
                          {hasVariants && (
                            <div className="text-xs text-violet-300 mt-1">
                              {product.variants!.length} variant{product.variants!.length > 1 ? 's' : ''}
                            </div>
                          )}
                          {/* Status: Pending Approval = badge only; Active/Inactive = dropdown */}
                          <div className="mt-2">
                            {displayStatus === 'Pending Approval' ? (
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Pending Approval
                              </span>
                            ) : (
                              <select
                                value={status}
                                onChange={(e) => handleStatusChange(product.product_id, e.target.value)}
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border-2 transition-all cursor-pointer appearance-none bg-no-repeat bg-right pr-6 ${
                                  status === 'active'
                                    ? 'bg-green-100 text-green-800 border-green-200'
                                    : 'bg-gray-100 text-gray-800 border-gray-200'
                                } hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary-blue`}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                                  backgroundPosition: 'right 0.25rem center',
                                  paddingRight: '1.5rem'
                                }}
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* View Button */}
                      <button
                        onClick={() => {
                          setSelectedProduct(product)
                          setIsViewModalOpen(true)
                        }}
                        className="p-3 theme-label hover:text-violet-300 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
                        title="View Variants"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* View Product Modal */}
      {isViewModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4" onClick={handleCloseViewModal}>
          <div 
            className="rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto relative"
            style={{
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
              boxShadow: '0 0 40px rgba(124, 58, 237, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="sticky top-0 px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between z-10 rounded-t-xl sm:rounded-t-2xl"
              style={{
                background: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 50%, #4f46e5 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderBottom: '1px solid rgba(124, 58, 237, 0.5)',
              }}
            >
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-lg">Product Details</h2>
              <button
                onClick={handleCloseViewModal}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-all flex-shrink-0 backdrop-blur-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {priceSaveError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-sm">
                  {priceSaveError}
                </div>
              )}
              {priceSaveSuccess && (
                <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/40 text-green-200 text-sm">
                  {priceSaveSuccess}
                </div>
              )}
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
                      className="group relative transition-all duration-300 hover:scale-105"
                    >
                      <img
                        src={imageUrl}
                        alt={selectedProduct.product_title}
                        className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl object-cover transition-all duration-300"
                        style={{
                          boxShadow: '0 0 20px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                          border: '2px solid rgba(124, 58, 237, 0.3)',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all duration-300 flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      </div>
                    </button>
                  </div>
                ) : null
              })()}

              {/* Product Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div 
                  className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(45,27,105,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-violet-400" />
                    <label className="text-xs sm:text-sm font-semibold text-white/70">Product Title</label>
                  </div>
                  <p className="text-sm sm:text-base md:text-lg font-medium text-white">{selectedProduct.product_title}</p>
                </div>
                <div 
                  className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(45,27,105,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <label className="text-xs sm:text-sm font-semibold text-white/70 block mb-2">Price</label>
                  <p className="text-sm sm:text-base md:text-lg font-medium text-white">
                    {selectedProduct.variants.length > 0 && selectedProduct.variants[0].variant_selling_price
                      ? `${userRole === 'supplier' ? currentUserCurrency : (currencyByOwnerId.get(selectedProduct.fk_owned_by) ?? 'USD')} ${selectedProduct.variants[0].variant_selling_price.toLocaleString()}`
                      : `${userRole === 'supplier' ? currentUserCurrency : (currencyByOwnerId.get(selectedProduct.fk_owned_by) ?? 'USD')} 0`}
                  </p>
                </div>
                <div 
                  className="p-4 rounded-xl transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(45,27,105,0.4) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-violet-400" />
                    <label className="text-xs sm:text-sm font-semibold text-white/70">Status</label>
                  </div>
                  <span className={`inline-flex px-2 sm:px-3 py-1 text-xs font-semibold rounded-full ${
                    getDisplayStatus(selectedProduct) === 'Active'
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : getDisplayStatus(selectedProduct) === 'Pending Approval'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                  }`}>
                    {getDisplayStatus(selectedProduct)}
                  </span>
                </div>
              </div>

              {/* Variants Summary */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                <div 
                  className="pt-4 sm:pt-6 mt-4 sm:mt-6"
                  style={{
                    borderTop: '1px solid rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
                    Variants Summary ({selectedProduct.variants.length})
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {selectedProduct.variants.map((variant, index) => (
                      <div
                        key={variant.variant_id || index}
                        className="rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-[1.02] group"
                        style={{
                          background: variant.variant_stock === 0 
                            ? 'linear-gradient(145deg, rgba(127,29,29,0.3) 0%, rgba(153,27,27,0.2) 100%)'
                            : 'linear-gradient(145deg, rgba(30,27,75,0.5) 0%, rgba(45,27,105,0.3) 100%)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                          border: variant.variant_stock === 0 
                            ? '1px solid rgba(239,68,68,0.3)'
                            : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                          {variant.size && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Ruler className="w-3 h-3 text-violet-400" />
                                <label className="text-xs font-semibold text-white/70">Size</label>
                              </div>
                              <p className="text-sm text-white">
                                {variant.size}{variant.size_category ? ` ${variant.size_category}` : ''}
                              </p>
                            </div>
                          )}
                          {variant.color && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Palette className="w-3 h-3 text-violet-400" />
                                <label className="text-xs font-semibold text-white/70">Color</label>
                              </div>
                              <p className="text-sm text-white">{variant.color}</p>
                            </div>
                          )}
                          {variant.company_sku && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Tag className="w-3 h-3 text-violet-400" />
                                <label className="text-xs font-semibold text-white/70">Zambeel SKU</label>
                              </div>
                              <p className="text-sm font-mono text-white">{variant.company_sku}</p>
                            </div>
                          )}
                          <div>
                            <label className="text-xs font-semibold text-white/70 block mb-1">Price</label>
                            {isEditingPrices ? (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={editedVariantPrices.get(variant.variant_id) ?? variant.variant_selling_price}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  if (!Number.isNaN(val) && val >= 0) {
                                    setEditedVariantPrices(prev => {
                                      const next = new Map(prev)
                                      next.set(variant.variant_id, val)
                                      return next
                                    })
                                  }
                                }}
                                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
                              />
                            ) : (
                              <p className="text-sm font-medium text-white">
                                {userRole === 'supplier' ? currentUserCurrency : (currencyByOwnerId.get(selectedProduct.fk_owned_by) ?? 'USD')} {variant.variant_selling_price.toLocaleString()}
                              </p>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Box className="w-3 h-3 text-violet-400" />
                              <label className="text-xs font-semibold text-white/70">Stock</label>
                            </div>
                            <p className={`text-sm font-medium ${
                              variant.variant_stock === 0 
                                ? 'text-red-400' 
                                : 'text-white'
                            }`}>
                              {variant.variant_stock}
                              {variant.variant_stock === 0 && <span className="ml-1 text-xs">(Out of Stock)</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="pt-4 sm:pt-6 mt-4 sm:mt-6"
                  style={{
                    borderTop: '1px solid rgba(124, 58, 237, 0.3)',
                  }}
                >
                  <div 
                    className="p-4 rounded-xl"
                    style={{
                      background: 'linear-gradient(145deg, rgba(30,27,75,0.5) 0%, rgba(45,27,105,0.3) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="w-4 h-4 text-violet-400" />
                      <label className="text-xs sm:text-sm font-semibold text-white/70">Stock</label>
                    </div>
                    <p className={`text-sm sm:text-base md:text-lg font-medium ${
                      (selectedProduct.variants.length > 0 ? selectedProduct.variants[0].variant_stock : 0) === 0 
                        ? 'text-red-400' 
                        : 'text-white'
                    }`}>
                      {selectedProduct.variants.length > 0 ? selectedProduct.variants[0].variant_stock : 0}
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm text-white/60 mt-3 sm:mt-4 text-center">This product has no variants.</p>
                </div>
              )}

              {/* Action Buttons */}
              <div 
                className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 sm:pt-6 mt-4 sm:mt-6"
                style={{
                  borderTop: '1px solid rgba(124, 58, 237, 0.3)',
                }}
              >
                {isEditingPrices ? (
                  <>
                    <button
                      onClick={handleCancelEditPrices}
                      disabled={isSavingPrices}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-70"
                      style={{
                        background: 'linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(45,27,105,0.4) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePrices}
                      disabled={isSavingPrices}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base text-white font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-70"
                      style={{
                        background: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 50%, #4f46e5 100%)',
                        boxShadow: '0 0 20px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {isSavingPrices ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                          Save prices
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleCloseViewModal}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 hover:scale-105"
                      style={{
                        background: 'linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(45,27,105,0.4) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                      }}
                    >
                      Close
                    </button>
                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                      <button
                        onClick={handleStartEditPrices}
                        className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base text-white font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                        style={{
                          background: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 50%, #4f46e5 100%)',
                          boxShadow: '0 0 20px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                        Edit prices
                      </button>
                    )}
                  </>
                )}
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
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setIsImageViewerOpen(false)}
          >
            <div 
              className="relative max-w-7xl max-h-[95vh] sm:max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageViewerOpen(false)
                }}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 z-50 p-2 sm:p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Previous Button */}
              {hasMultipleImages && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevious()
                  }}
                  className="absolute left-2 sm:left-4 z-50 p-2 sm:p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}

              {/* Image */}
              <div className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none px-12 sm:px-16">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
                <img
                  src={currentImage}
                  alt={`${viewerProduct.product_title} - Image ${currentImageIndex + 1}`}
                  className={`max-w-full max-h-[80vh] sm:max-h-[90vh] object-contain rounded-lg transition-opacity duration-200 ${
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
                  className="absolute right-2 sm:right-4 z-50 p-2 sm:p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white transition-colors shadow-lg"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              )}

              {/* Image Counter */}
              {hasMultipleImages && (
                <div className="absolute bottom-16 sm:bottom-20 left-1/2 transform -translate-x-1/2 z-50 px-3 sm:px-4 py-1.5 sm:py-2 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm font-medium shadow-lg">
                  {currentImageIndex + 1} / {viewerImages.length}
                </div>
              )}

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 z-50 px-3 sm:px-4 py-2 bg-primary-blue hover:bg-primary-blue-dark rounded-lg text-white transition-colors flex items-center gap-2 text-xs sm:text-sm font-medium shadow-lg"
              >
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Download</span>
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

