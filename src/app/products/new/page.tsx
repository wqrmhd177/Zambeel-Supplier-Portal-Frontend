'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  X, 
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { fetchSuppliersForPurchaser, SupplierInfo, getPurchaserIntegerId } from '@/lib/supplierHelpers'
import { getCurrencyForUserId } from '@/lib/currencyHelpers'

const PACKAGE_INCLUDES_OPTIONS = [
'Battery','Cells','Power Adapter','Charger','Power Cable','USB Cable','Type-C Cable',
'Micro-USB Cable','Lightning Cable','HDMI Cable','AUX Cable','Warranty Card','Mounting Bracket',
'Clip','Holder','Stand','Protective Case','Accessory Kit', 'Other',
]

const SIZE_CATEGORY_OPTIONS = ['ML', 'Standard Size', 'Free Size', 'Inches', 'Centimeters', 'Grams', 'Kilograms', 'Size']

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

// Helper function to check if size value field should be shown
const shouldShowSizeValues = (sizeCategory: string): boolean => {
  return !['Standard Size', 'Free Size'].includes(sizeCategory) && sizeCategory !== ''
}

// Helper function to check if size category requires custom input (numeric values)
const isCustomInputCategory = (sizeCategory: string): boolean => {
  return ['ML', 'Inches', 'Centimeters', 'Grams', 'Kilograms'].includes(sizeCategory)
}

// Helper function to check if size category uses predefined size options (XS, S, M, L, XL, XXL)
const isPredefinedSizeCategory = (sizeCategory: string): boolean => {
  return sizeCategory === 'Size'
}

const COLOR_OPTIONS = [
  'Red', 'Blue', 'Green', 'Black', 'White', 'Pink', 'Yellow', 'Orange', 
  'Purple', 'Gray', 'Brown', 'Beige', 'Navy', 'Teal', 'Maroon', 'Gold', 'Silver'
]

interface Variant {
  id: string
  sizeCategory: string
  sizeValue: string
  color: string
  price: number
  stock: number
  images: File[]
}

interface ProductFormData {
  title: string
  brandName: string
  material: string
  packageIncludes: string[]
  sellingPrice: number
  stockAmount: number
  images: File[]
  sizeCategory: string
  sizeValue: string
  color: string
  hasVariants: boolean
  variants: Variant[]
}

export default function AddProductPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userFriendlyId, userRole, userId } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [priceCurrency, setPriceCurrency] = useState<string>('USD')
  const [supplierSearch, setSupplierSearch] = useState<string>('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState<boolean>(false)

  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    brandName: '',
    material: '',
    packageIncludes: [],
    sellingPrice: 0,
    stockAmount: 0,
    images: [],
    sizeCategory: '',
    sizeValue: '',
    color: '',
    hasVariants: true,
    variants: [],
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [packageIncludesOtherText, setPackageIncludesOtherText] = useState('')
  const [isVariantsSectionOpen, setIsVariantsSectionOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (isAuthenticated && (userRole === 'purchaser' || userRole === 'admin')) {
      fetchSuppliers()
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!showSuccessScreen) return
    const t = setTimeout(() => router.push('/products'), 5000)
    return () => clearTimeout(t)
  }, [showSuccessScreen, router])

  // Currency from product owner's stock location (current user when supplier, selected supplier when purchaser/admin)
  useEffect(() => {
    const run = async () => {
      const ownerId = (userRole === 'purchaser' || userRole === 'admin') && selectedSupplierId
        ? selectedSupplierId
        : (userFriendlyId || userId)
      if (!ownerId) {
        setPriceCurrency('USD')
        return
      }
      const currency = await getCurrencyForUserId(ownerId)
      setPriceCurrency(currency)
    }
    run()
  }, [userId, userFriendlyId, userRole, selectedSupplierId])

  const fetchSuppliers = async () => {
    if (userRole === 'admin' || userRole === 'purchaser') {
      // Both admin and purchaser can see all active suppliers in the system
      const { data, error } = await supabase
        .from('users')
        .select('id, user_id, email, owner_name, store_name, phone_number, city, onboarded, created_at')
        .eq('role', 'supplier')
        .eq('archived', false)
        .eq('account_approval', 'Approved')
        .order('store_name', { ascending: true })
      
      if (!error && data) {
        setSuppliers(data)
      }
    }
  }
  
  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier => {
    if (!supplierSearch) return true
    const searchLower = supplierSearch.toLowerCase()
    return (
      (supplier.store_name?.toLowerCase().includes(searchLower)) ||
      (supplier.owner_name?.toLowerCase().includes(searchLower)) ||
      (supplier.email?.toLowerCase().includes(searchLower)) ||
      (supplier.user_id?.toLowerCase().includes(searchLower))
    )
  })
  
  // Get selected supplier display name (prioritize store name)
  const selectedSupplier = suppliers.find(s => s.user_id === selectedSupplierId)
  const getSupplierDisplayName = (supplier: SupplierInfo | undefined) => {
    if (!supplier) return ''
    return supplier.store_name || supplier.owner_name || supplier.email || `Supplier ${supplier.user_id}`
  }
  const selectedSupplierDisplay = getSupplierDisplayName(selectedSupplier)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'sellingPrice' || name === 'stockAmount' ? parseFloat(value) || 0 : value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const togglePackageInclude = (option: string) => {
    setFormData(prev => {
      const current = prev.packageIncludes
      const next = current.includes(option)
        ? current.filter(x => x !== option)
        : [...current, option]
      return { ...prev, packageIncludes: next }
    })
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const currentCount = formData.images.length
    const maxImages = 5
    
    // Limit to maximum 5 images
    const remainingSlots = maxImages - currentCount
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      setErrors(prev => ({
        ...prev,
        images: `Maximum 5 images allowed. Only ${remainingSlots} more image(s) can be added.`
      }))
    } else {
      setErrors(prev => ({
        ...prev,
        images: ''
      }))
    }

    const newImages = [...formData.images, ...filesToAdd]
    
    setFormData(prev => ({
      ...prev,
      images: newImages
    }))
  }

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      images: newImages
    }))
    
    // Clear any previous errors when removing images
    setErrors(prev => ({
      ...prev,
      images: ''
    }))
  }


  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: crypto.randomUUID(),
          sizeCategory: '',
          sizeValue: '',
          color: '',
          price: prev.sellingPrice || 0,
          stock: 0,
          images: []
        }
      ]
    }))
  }

  const removeVariant = (id: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== id)
    }))
  }

  const updateVariant = (id: string, field: keyof Variant, value: string | number | string[]) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => {
        if (v.id !== id) return v
        const next = { ...v, [field]: value }
        if (field === 'sizeCategory') next.sizeValue = ''
        return next
      })
    }))
  }


  const handleVariantImageChange = (variantId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => {
        if (v.id !== variantId) return v
        const currentCount = v.images.length
        const maxImages = 5
        const remainingSlots = maxImages - currentCount
        const filesToAdd = files.slice(0, remainingSlots)
        return { ...v, images: [...v.images, ...filesToAdd] }
      })
    }))
  }

  const removeVariantImage = (variantId: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === variantId
          ? { ...v, images: v.images.filter((_, i) => i !== index) }
          : v
      )
    }))
  }


  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Product title is required'
    }

    if (!formData.material.trim()) {
      newErrors.material = 'Material is required'
    }

    const hasVariants = formData.variants.length > 0
    const allVariantsHaveImages = hasVariants && formData.variants.every(v => v.images?.length > 0)
    if (!hasVariants) {
      if (formData.images.length === 0) {
        newErrors.images = 'Please upload at least 1 product image'
      } else if (formData.images.length > 5) {
        newErrors.images = 'Maximum 5 images allowed'
      }
    } else {
      if (formData.images.length === 0 && !allVariantsHaveImages) {
        newErrors.images = 'Please upload at least 1 product image or add at least 1 image per variant'
      } else if (formData.images.length > 5) {
        newErrors.images = 'Maximum 5 images allowed'
      }
    }

    if (!hasVariants) {
      if (formData.sellingPrice <= 0) {
        newErrors.sellingPrice = 'Selling price must be greater than 0'
      }
      if (formData.stockAmount < 0) {
        newErrors.stockAmount = 'Stock amount cannot be negative'
      }
    }

    // Validate main size value if category requires it (only when no variants)
    if (!hasVariants && shouldShowSizeValues(formData.sizeCategory)) {
      if (isCustomInputCategory(formData.sizeCategory) || isPredefinedSizeCategory(formData.sizeCategory)) {
        if (!formData.sizeValue || !formData.sizeValue.trim()) {
          newErrors.sizeValue = 'Size value is required for this size category'
        }
      }
    }

    // For purchasers and admin, supplier selection is required
    if ((userRole === 'purchaser' || userRole === 'admin') && !selectedSupplierId) {
      newErrors.supplier = 'Please select a supplier'
    }

    // If no variants, product is saved as single row from main form (no variant validation)
    if (formData.variants.length > 0) {
      formData.variants.forEach((variant, index) => {
        // Validate size value if category requires it
        if (shouldShowSizeValues(variant.sizeCategory)) {
          if (isCustomInputCategory(variant.sizeCategory) || isPredefinedSizeCategory(variant.sizeCategory)) {
            if (!variant.sizeValue || !variant.sizeValue.trim()) {
              newErrors[`variant_sizeValue_${index}`] = 'Size value is required for this size category'
            }
          }
        }
        
        if (!variant.price || variant.price <= 0) {
          newErrors[`variant_price_${index}`] = 'Variant price must be greater than 0'
        }
        if (variant.stock === undefined || variant.stock < 0) {
          newErrors[`variant_stock_${index}`] = 'Stock cannot be negative'
        }
        if (!variant.images || variant.images.length === 0) {
          newErrors[`variant_images_${index}`] = 'Please upload at least 1 image for this variant'
        } else if (variant.images.length > 5) {
          newErrors[`variant_images_${index}`] = 'Maximum 5 images per variant'
        }
      })
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setError('Please fix the errors before saving')
      return
    }

    if (!userFriendlyId) {
      setError('User not authenticated. Please log in again.')
      router.push('/login')
      return
    }

    // Determine supplier being used for the product
    const supplierOwnerId = (userRole === 'purchaser' || userRole === 'admin') && selectedSupplierId
      ? selectedSupplierId
      : userFriendlyId

    setIsSaving(true)
    setError('')
    setShowSuccessScreen(false)

    try {
      // Determine the owner ID based on user role (for image upload path)
      const ownerId = supplierOwnerId

      if (!ownerId) {
        setError('Product owner could not be determined. Please select a supplier or log in again.')
        setIsSaving(false)
        return
      }

      // Helper to upload files and return URLs
      const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
        const urls: string[] = []
        for (const imageFile of files) {
          const fileExt = imageFile.name.split('.').pop()
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 9)
          const fileName = `${ownerId}/${timestamp}-${randomStr}.${fileExt}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('product_images')
            .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })
          if (uploadError) throw new Error(`${imageFile.name}: ${uploadError.message}`)
          const { data: urlData } = supabase.storage.from('product_images').getPublicUrl(uploadData.path)
          if (urlData?.publicUrl) urls.push(urlData.publicUrl)
        }
        return urls
      }

      // Upload main product images to Supabase Storage (always when user added images)
      const imageUrls: string[] = []
      if (formData.images.length > 0) {
        try {
          const urls = await uploadFilesToStorage(formData.images)
          imageUrls.push(...urls)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Failed to upload images'
          setError(`Failed to upload image: ${msg}`)
          setIsSaving(false)
          return
        }
      }

      // Base product data (without product_id and variant_id - they're auto-generated)
      const baseProductData = {
        product_title: formData.title,
        brand_name: formData.brandName || null,
        material: formData.material.trim() || null,
        package_includes: formData.packageIncludes.length > 0
          ? formData.packageIncludes.map((x) =>
              x === 'Other' ? (packageIncludesOtherText.trim() || 'Other') : x
            )
          : null,
        fk_owned_by: ownerId,
        image: imageUrls.length > 0 ? imageUrls : null,
        status: 'active',
      }

      if (formData.hasVariants && formData.variants.length > 0) {
        // Upload each variant's images and build variant image URL map
        const variantImageUrls: { [variantId: string]: string[] } = {}
        for (const variant of formData.variants) {
          if (variant.images.length > 0) {
            try {
              variantImageUrls[variant.id] = await uploadFilesToStorage(variant.images)
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to upload variant images'
              setError(`Failed to upload images for variant: ${msg}`)
              setIsSaving(false)
              return
            }
          } else {
            variantImageUrls[variant.id] = []
          }
        }

        // Build variant rows (one row per variant - no expansion)
        const allVariantRows = formData.variants.map((variant, index) => {
          const variantUrls = variantImageUrls[variant.id]?.length > 0 ? variantImageUrls[variant.id] : null
          const imageForRow = variantUrls ?? (imageUrls.length > 0 ? imageUrls : null)
          return {
            ...baseProductData,
            image: imageForRow,
            variant_id: index + 1, // 1, 2, 3... for each product
            size_category: variant.sizeCategory || null,
            size: variant.sizeValue || null,
            color: variant.color || null,
            variant_selling_price: variant.price,
            variant_stock: variant.stock ?? 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        })

        if (allVariantRows.length === 0) {
          setError('Please add at least one variant')
          setIsSaving(false)
          return
        }

        // Insert first row to get product_id
        const { data: firstInsert, error: firstError } = await supabase
          .from('products')
          .insert([allVariantRows[0]])
          .select()
          .single()

        if (firstError) {
          console.error('Error creating product:', firstError)
          if (firstError.code === '23503') {
            setError('Invalid user ID. Please log out and log in again.')
          } else {
            setError(firstError.message || 'Failed to create product. Please try again.')
          }
          setIsSaving(false)
          return
        }

        if (!firstInsert) {
          setError('Failed to create product. Please try again.')
          setIsSaving(false)
          return
        }

        const productId = firstInsert.product_id

        // Insert remaining rows with the same product_id
        if (allVariantRows.length > 1) {
          const rest = allVariantRows.slice(1).map(r => ({ ...r, product_id: productId }))
          
          const { error: variantsError } = await supabase
            .from('products')
            .insert(rest)

          if (variantsError) {
            console.error('Error creating additional variants:', variantsError)
            setError('Product created but failed to save all variants. Please edit the product to add missing variants.')
            setIsSaving(false)
            return
          }
        }

        setShowSuccessScreen(true)
      } else {
        // Product without variants - insert one row using main form values
        const { data: insertedData, error: productError } = await supabase
          .from('products')
          .insert([{
            ...baseProductData,
            variant_id: 1, // First (and only) variant for this product
            size_category: formData.sizeCategory || null,
            size: formData.sizeValue || null,
            color: formData.color || null,
            variant_selling_price: formData.sellingPrice,
            variant_stock: formData.stockAmount,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }])
          .select()
          .single()

        if (productError) {
          console.error('Error creating product:', productError)
          if (productError.code === '23503') {
            setError('Invalid user ID. Please log out and log in again.')
          } else {
            setError(productError.message || 'Failed to create product. Please try again.')
          }
          setIsSaving(false)
          return
        }

        if (insertedData) {
          setShowSuccessScreen(true)
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  // Success screen after product submission
  if (showSuccessScreen) {
    return (
      <div className="flex h-screen bg-gray-100 transition-colors">
        <Sidebar />
        <div className="flex-1 overflow-auto">
          <Header />
          <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 sm:p-8">
            <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8 sm:p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <Save className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Product submitted successfully</h2>
              <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-6">
                Thank you for listing with Zambeel. Our team will review your product and approve/refuse in 2-3 business days.
              </p>
              <p className="text-sm text-gray-500 mb-6">Redirecting to products page...</p>
              <button
                type="button"
                onClick={() => router.push('/products')}
                className="px-6 py-3 bg-primary-blue text-white font-medium rounded-xl hover:opacity-90 transition-all"
              >
                Go to Products
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 transition-colors">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-2 sm:gap-4 mb-6 sm:mb-8">
            <button
              onClick={() => router.push('/products')}
              className="p-2 rounded-lg hover:bg-gray-200 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Add New Product</h2>
              <p className="text-sm sm:text-base text-gray-600 hidden sm:block">Fill in the details to add a new product to your inventory</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="bg-white border border-gray-300 rounded-2xl p-4 sm:p-6 lg:p-8">
              {/* Supplier Selector (for purchasers and admin) */}
              {(userRole === 'purchaser' || userRole === 'admin') && (
                <div className="mb-6 relative">
                  <label htmlFor="supplier" className="block text-sm font-semibold text-gray-900 mb-2">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  
                  {suppliers.length > 0 ? (
                    <div className="relative">
                      {/* Single Searchable Input Field */}
                      <input
                        type="text"
                        id="supplier"
                        placeholder="Search by store name, email, or ID..."
                        value={selectedSupplierId && !showSupplierDropdown ? selectedSupplierDisplay : supplierSearch}
                        onChange={(e) => {
                          setSupplierSearch(e.target.value)
                          setShowSupplierDropdown(true)
                          if (selectedSupplierId) {
                            setSelectedSupplierId('')
                          }
                          if (errors.supplier) {
                            setErrors(prev => ({ ...prev, supplier: '' }))
                          }
                        }}
                        onFocus={() => setShowSupplierDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowSupplierDropdown(false), 200)
                        }}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.supplier ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        autoComplete="off"
                        required
                      />
                      
                      {/* Dropdown Icon */}
                      <ChevronDown 
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" 
                        size={20} 
                      />
                      
                      {/* Dropdown List */}
                      {showSupplierDropdown && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {filteredSuppliers.length > 0 ? (
                            filteredSuppliers.map(supplier => (
                              <div
                                key={supplier.user_id}
                                onClick={() => {
                                  setSelectedSupplierId(supplier.user_id)
                                  setSupplierSearch('')
                                  setShowSupplierDropdown(false)
                                  if (errors.supplier) {
                                    setErrors(prev => ({ ...prev, supplier: '' }))
                                  }
                                }}
                                className={`px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                                  selectedSupplierId === supplier.user_id
                                    ? 'bg-primary-blue text-white'
                                    : 'hover:bg-gray-50 text-gray-900'
                                }`}
                              >
                                <div className="font-medium">
                                  {supplier.store_name || supplier.owner_name || `Supplier ${supplier.user_id}`}
                                </div>
                                <div className={`text-sm ${
                                  selectedSupplierId === supplier.user_id ? 'text-white/80' : 'text-gray-500'
                                }`}>
                                  ID: {supplier.user_id}{supplier.email ? ` • ${supplier.email}` : ''}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500">
                              No suppliers match your search
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      No active suppliers available. <button type="button" onClick={() => router.push('/suppliers/new')} className="text-primary-blue hover:underline">Create one</button>
                    </p>
                  )}
                  
                  {errors.supplier && (
                    <p className="mt-1 text-sm text-red-500">{errors.supplier}</p>
                  )}
                </div>
              )}

              {/* 1. Product Title */}
              <div className="mb-6">
                <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                    errors.title ? 'border-red-500' : 'border-gray-200'
                  } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                  placeholder="e.g., Wireless Bluetooth Headphones"
                  required
                />
                {errors.title && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.title}</span>
                )}
              </div>

              {/* 2. Material */}
              <div className="mb-6">
                <label htmlFor="material" className="block text-sm font-semibold text-gray-900 mb-2">
                  Material <span className="text-red-500">*</span>
                </label>
                <input
                  id="material"
                  name="material"
                  type="text"
                  value={formData.material}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                    errors.material ? 'border-red-500' : 'border-gray-200'
                  } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                  placeholder="e.g., Plastic, Metal, Wood"
                  required
                />
                {errors.material && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.material}</span>
                )}
              </div>

              {/* 3. Brand Name */}
              <div className="mb-6">
                <label htmlFor="brandName" className="block text-sm font-semibold text-gray-900 mb-2">
                  Brand Name <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  id="brandName"
                  name="brandName"
                  type="text"
                  value={formData.brandName}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                    errors.brandName ? 'border-red-500' : 'border-gray-200'
                  } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                  placeholder="e.g., Nike, Samsung, Apple"
                />
                {errors.brandName && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.brandName}</span>
                )}
              </div>

              {/* 4. Package Includes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Package Includes <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">Select all that apply</p>
                <div className="flex flex-wrap gap-2 p-4 border-2 border-gray-200 rounded-xl bg-white min-h-[120px]">
                  {PACKAGE_INCLUDES_OPTIONS.map((option) => {
                    const selected = formData.packageIncludes.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => togglePackageInclude(option)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          selected
                            ? 'bg-primary-blue text-white border-2 border-primary-blue'
                            : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
                {formData.packageIncludes.includes('Other') && (
                  <div className="mt-3">
                    <label htmlFor="packageIncludesOther" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Specify other (optional)
                    </label>
                    <input
                      id="packageIncludesOther"
                      type="text"
                      value={packageIncludesOtherText}
                      onChange={(e) => setPackageIncludesOtherText(e.target.value)}
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:border-primary-blue focus:outline-none placeholder:text-gray-400"
                      placeholder="e.g., Custom accessory name"
                    />
                  </div>
                )}
                {formData.packageIncludes.length > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    {formData.packageIncludes.length} selected
                  </p>
                )}
              </div>

              {/* 5. Color */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Color <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all border-gray-200 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none"
                >
                  <option value="">Select a color</option>
                  {COLOR_OPTIONS.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>

              {/* 6. Size Category */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Size Category <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <select
                  value={formData.sizeCategory}
                  onChange={(e) => setFormData(prev => ({ ...prev, sizeCategory: e.target.value, sizeValue: '' }))}
                  className="w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all border-gray-200 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none"
                >
                  <option value="">Select size category</option>
                  {SIZE_CATEGORY_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* 7. Size Value - Conditional based on Size Category */}
              {shouldShowSizeValues(formData.sizeCategory) && (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Size Value (Only one size value is allowed for each variant){(isCustomInputCategory(formData.sizeCategory) || isPredefinedSizeCategory(formData.sizeCategory)) && <span className="text-red-500">*</span>}
                  </label>
                  
                  {isPredefinedSizeCategory(formData.sizeCategory) ? (
                    // For "Size" category - single select from XS, S, M, L, XL, XXL
                    <>
                      <p className="text-sm text-gray-500 mb-3">Select one size</p>
                      <select
                        value={formData.sizeValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, sizeValue: e.target.value }))}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.sizeValue ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                      >
                        <option value="">Select a size</option>
                        {SIZE_OPTIONS.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    // For numeric categories (ML, Inches, etc) - single text input
                    <>
                      <p className="text-sm text-gray-500 mb-3">Enter size value (e.g., 4 for {formData.sizeCategory})</p>
                      <input
                        type="text"
                        value={formData.sizeValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, sizeValue: e.target.value }))}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.sizeValue ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder={`e.g., 500 for ${formData.sizeCategory}`}
                      />
                    </>
                  )}
                  {errors.sizeValue && (
                    <span className="block text-xs text-red-500 mt-1.5">{errors.sizeValue}</span>
                  )}
                </div>
              )}

              {/* 8. Product Selling Price */}
              <div className="mb-6">
                <label htmlFor="mainSellingPrice" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                  Product Selling Price <span>(Product Price + Fulfillment Cost + Margin)</span> <span className="text-red-500">*</span>
                </label>
                <div className={`flex items-stretch rounded-xl overflow-hidden border-2 focus-within:border-primary-blue focus-within:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] ${errors.sellingPrice ? 'border-red-500' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-center min-w-[56px] sm:min-w-[64px] px-2 sm:px-3 py-3 rounded-l-xl bg-gray-100 border-r border-gray-200 text-sm font-semibold text-gray-700">
                    {priceCurrency}
                  </div>
                  <input
                    id="mainSellingPrice"
                    name="sellingPrice"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.sellingPrice || ''}
                    onChange={handleChange}
                    className="flex-1 min-w-0 px-4 py-3 border-0 rounded-r-xl bg-white text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none focus:ring-0"
                    placeholder="0"
                    required
                  />
                </div>
                {errors.sellingPrice && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.sellingPrice}</span>
                )}
              </div>

              {/* 9. Stock Available in Your Shop */}
              <div className="mb-6">
                <label htmlFor="mainStockAmount" className="block text-sm font-semibold text-gray-900 mb-2">
                  Stock Available in Your Shop <span className="text-red-500">*</span>
                </label>
                <input
                  id="mainStockAmount"
                  name="stockAmount"
                  type="number"
                  min="0"
                  value={formData.stockAmount || ''}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                    errors.stockAmount ? 'border-red-500' : 'border-gray-200'
                  } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                  placeholder="0"
                  required
                />
                {errors.stockAmount && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.stockAmount}</span>
                )}
              </div>

              {/* 10. Product Pictures */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Pictures (Box Pictures and Original Product Pictures) <span className="text-red-500">*</span> (Max 5)
                </label>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Product ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.images.length < 5 && (
                      <label className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 transition-all">
                        <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-1 sm:mb-2" />
                        <span className="text-xs text-gray-600">Add Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {errors.images && (
                    <span className="block text-[13px] text-red-500 font-medium">{errors.images}</span>
                  )}
                  <p className="text-sm text-gray-500">
                    {formData.images.length} / 5 images (maximum 5 images allowed)
                  </p>
                </div>
              </div>

              {/* 11. Variants Section */}
              {(
                <div className="mb-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                  {!isVariantsSectionOpen ? (
                    <div className="p-4 sm:p-6">
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                          Click below to add product variants
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsVariantsSectionOpen(true)
                            if (formData.variants.length === 0) {
                              addVariant()
                            }
                          }}
                          className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-all flex items-center gap-2 text-xs sm:text-sm font-medium mx-auto"
                        >
                          <Plus className="w-4 h-4" />
                          ADD VARIANT
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div 
                        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer border-b border-gray-300"
                        onClick={() => setIsVariantsSectionOpen(false)}
                      >
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Product Variants</h3>
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                        >
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        </button>
                      </div>

                      <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-4 sm:pt-6">
                        {formData.variants.length === 0 ? (
                          <div className="text-center py-6 sm:py-8">
                            <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                              No variants added yet. Click &quot;Add Another Variant&quot; to get started.
                            </p>
                            <button
                              type="button"
                              onClick={addVariant}
                              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-all flex items-center gap-2 text-xs sm:text-sm font-medium mx-auto"
                            >
                              <Plus className="w-4 h-4" />
                              ADD ANOTHER VARIANT
                            </button>
                          </div>
                  ) : (
                    <div className="space-y-4 sm:space-y-6">
                      {formData.variants.map((variant, index) => (
                        <div key={variant.id} className="p-4 sm:p-6 bg-white rounded-xl border-2 border-gray-200 shadow-sm">
                          <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h4 className="text-sm sm:text-base font-semibold text-gray-900">Variant {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeVariant(variant.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          </div>

                          {/* Color */}
                          <div className="mb-4 sm:mb-5">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                              Color <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                            </label>
                            <select
                              value={variant.color}
                              onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                              className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                errors[`variant_color_${index}`] ? 'border-red-500' : 'border-gray-200'
                              } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            >
                              <option value="">Select a color</option>
                              {COLOR_OPTIONS.map(color => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                            {errors[`variant_color_${index}`] && (
                              <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_color_${index}`]}</span>
                            )}
                          </div>

                          {/* Size Category */}
                          <div className="mb-4 sm:mb-5">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                              Size Category <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                            </label>
                            <select
                              value={variant.sizeCategory}
                              onChange={(e) => updateVariant(variant.id, 'sizeCategory', e.target.value)}
                              className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                errors[`variant_sizeCategory_${index}`] ? 'border-red-500' : 'border-gray-200'
                              } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            >
                              <option value="">Select size category</option>
                              {SIZE_CATEGORY_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                            {errors[`variant_sizeCategory_${index}`] && (
                              <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_sizeCategory_${index}`]}</span>
                            )}
                          </div>

                          {/* Size Value - Conditional based on Size Category */}
                          {shouldShowSizeValues(variant.sizeCategory) && (
                            <div className="mb-4 sm:mb-5">
                              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                                Size Value (Only one size value is allowed for each variant){(isCustomInputCategory(variant.sizeCategory) || isPredefinedSizeCategory(variant.sizeCategory)) && <span className="text-red-500">*</span>}
                              </label>
                              
                              {isPredefinedSizeCategory(variant.sizeCategory) ? (
                                // For "Size" category - single select from XS, S, M, L, XL, XXL
                                <>
                                  <p className="text-xs sm:text-sm text-gray-500 mb-3">Select one size</p>
                                  <select
                                    value={variant.sizeValue}
                                    onChange={(e) => updateVariant(variant.id, 'sizeValue', e.target.value)}
                                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                      errors[`variant_sizeValue_${index}`] ? 'border-red-500' : 'border-gray-200'
                                    } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                                  >
                                    <option value="">Select a size</option>
                                    {SIZE_OPTIONS.map(size => (
                                      <option key={size} value={size}>{size}</option>
                                    ))}
                                  </select>
                                </>
                              ) : (
                                // For numeric categories (ML, Inches, etc) - single text input
                                <>
                                  <p className="text-sm text-gray-500 mb-3">Enter size value (e.g., 500 for {variant.sizeCategory})</p>
                                  <input
                                    type="text"
                                    value={variant.sizeValue}
                                    onChange={(e) => updateVariant(variant.id, 'sizeValue', e.target.value)}
                                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                      errors[`variant_sizeValue_${index}`] ? 'border-red-500' : 'border-gray-200'
                                    } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                                    placeholder={`e.g., 500 for ${variant.sizeCategory}`}
                                  />
                                </>
                              )}
                              {errors[`variant_sizeValue_${index}`] && (
                                <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_sizeValue_${index}`]}</span>
                              )}
                            </div>
                          )}

                          {/* Variant Selling Price */}
                          <div className="mb-4 sm:mb-5">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                              Product Selling Price <span>(Product Price + Fulfillment Cost + Margin)</span> <span className="text-red-500">*</span>
                            </label>
                            <div className={`flex items-stretch rounded-xl overflow-hidden border-2 focus-within:border-primary-blue focus-within:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] ${errors[`variant_price_${index}`] ? 'border-red-500' : 'border-gray-200'}`}>
                              <div className="flex items-center justify-center min-w-[56px] sm:min-w-[64px] px-2 sm:px-3 py-3 rounded-l-xl bg-gray-100 border-r border-gray-200 text-sm font-semibold text-gray-700">
                                {priceCurrency}
                              </div>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={variant.price || ''}
                                onChange={(e) => updateVariant(variant.id, 'price', Number(e.target.value) || 0)}
                                className="flex-1 min-w-0 px-4 py-3 border-0 rounded-r-xl bg-white text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                placeholder="0"
                                required
                              />
                            </div>
                            {errors[`variant_price_${index}`] && (
                              <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_price_${index}`]}</span>
                            )}
                          </div>

                          {/* Stock Available in Your Shop (per variant) */}
                          <div className="mb-4 sm:mb-5">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                              Stock Available in Your Shop <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={variant.stock ?? ''}
                              onChange={(e) => updateVariant(variant.id, 'stock', parseInt(e.target.value, 10) || 0)}
                              className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                errors[`variant_stock_${index}`] ? 'border-red-500' : 'border-gray-200'
                              } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                              placeholder="0"
                              required
                            />
                            {errors[`variant_stock_${index}`] && (
                              <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_stock_${index}`]}</span>
                            )}
                          </div>

                          {/* Product Pictures (per variant) */}
                          <div className="mb-0">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
                              Product Pictures <span className="hidden sm:inline">(Box Pictures and Original Product Pictures)</span> <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(Max 5)</span>
                            </label>
                            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                              {variant.images.map((image, imgIndex) => (
                                <div key={imgIndex} className="relative group">
                                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                                    <img
                                      src={URL.createObjectURL(image)}
                                      alt={`Variant ${index + 1} image ${imgIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeVariantImage(variant.id, imgIndex)}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {variant.images.length < 5 && (
                                <label className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 transition-all">
                                  <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mb-0.5 sm:mb-1" />
                                  <span className="text-xs text-gray-600">Add</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => handleVariantImageChange(variant.id, e)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>
                            {errors[`variant_images_${index}`] && (
                              <span className="block text-xs text-red-500 mt-1.5">{errors[`variant_images_${index}`]}</span>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {variant.images.length} / 5 images
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Add Another Variant Button */}
                      <button
                        type="button"
                        onClick={addVariant}
                        className="w-full py-3 sm:py-4 border-2 border-dashed border-gray-300 rounded-xl text-primary-blue font-semibold hover:border-primary-blue hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                      >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        ADD ANOTHER VARIANT
                      </button>
                    </div>
                  )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/products')}
                  className="w-full sm:w-auto px-4 sm:px-6 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all text-gray-700 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Saving Product...</span>
                      <span className="sm:hidden">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save Product</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}

