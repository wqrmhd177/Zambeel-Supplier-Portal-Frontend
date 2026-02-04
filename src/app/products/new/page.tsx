'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  X, 
  Upload,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { fetchSuppliersForPurchaser, SupplierInfo, getPurchaserIntegerId, canSupplierAddProducts } from '@/lib/supplierHelpers'

interface Variant {
  id: string
  size?: string
  color?: string
  ml?: string
  price?: number
  stock?: number
  sku?: string
}

interface ProductFormData {
  title: string
  brandName: string
  sellingPrice: number
  stockAmount: number
  bar_code: string
  images: File[]
  hasVariants: boolean
  variants: Variant[]
}

export default function AddProductPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userFriendlyId, userRole, userId } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')

  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    brandName: '',
    sellingPrice: 0,
    stockAmount: 0,
    bar_code: '',
    images: [],
    hasVariants: false,
    variants: [],
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    // Fetch suppliers if user is a purchaser or admin
    if (isAuthenticated && (userRole === 'purchaser' || userRole === 'admin')) {
      fetchSuppliers()
    }
  }, [isAuthenticated, authLoading, userRole, userId, router])

  const fetchSuppliers = async () => {
    if (userRole === 'admin') {
      // Admin can see all suppliers
      const { data, error } = await supabase
        .from('users')
        .select('id, user_id, email, owner_name, store_name, phone_number, city, onboarded, created_at')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false })
      
      if (!error && data) {
        setSuppliers(data)
        if (data.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(data[0].user_id)
        }
      }
    } else if (userRole === 'purchaser' && userId) {
      // Purchaser sees only their suppliers
      // Get purchaser's integer ID first
      const purchaserIntId = await getPurchaserIntegerId(userId)
      if (purchaserIntId) {
        const supplierList = await fetchSuppliersForPurchaser(purchaserIntId)
        setSuppliers(supplierList)
        if (supplierList.length > 0 && !selectedSupplierId) {
          setSelectedSupplierId(supplierList[0].user_id)
        }
      } else {
        console.error('Failed to get purchaser integer ID')
        setSuppliers([])
      }
    }
  }

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

  const toggleVariants = () => {
    setFormData(prev => ({
      ...prev,
      hasVariants: !prev.hasVariants,
      variants: !prev.hasVariants ? [] : prev.variants
    }))
  }

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: Date.now().toString(),
          size: '',
          color: '',
          ml: '',
          price: prev.sellingPrice,
          stock: 0,
          sku: ''
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

  const updateVariant = (id: string, field: keyof Variant, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      )
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Product title is required'
    }

    if (formData.images.length === 0) {
      newErrors.images = 'Please upload at least 1 product image'
    } else if (formData.images.length > 5) {
      newErrors.images = 'Maximum 5 images allowed'
    }

    if (!formData.hasVariants && formData.sellingPrice <= 0) {
      newErrors.sellingPrice = 'Selling price must be greater than 0'
    }

    if (!formData.hasVariants && formData.stockAmount < 0) {
      newErrors.stockAmount = 'Stock amount cannot be negative'
    }

    // For purchasers and admin, supplier selection is required
    if ((userRole === 'purchaser' || userRole === 'admin') && !selectedSupplierId) {
      newErrors.supplier = 'Please select a supplier'
    }

    // Bar code is optional - no validation needed

    if (formData.hasVariants && formData.variants.length === 0) {
      newErrors.variants = 'Please add at least one variant'
    }

    if (formData.hasVariants) {
      formData.variants.forEach((variant, index) => {
        if (!variant.size && !variant.color && !variant.ml) {
          newErrors[`variant_${index}`] = 'Variant must have at least one attribute (Size, Color, or ML)'
        }
        if (!variant.price || variant.price <= 0) {
          newErrors[`variant_price_${index}`] = 'Variant price must be greater than 0'
        }
        if (variant.stock === undefined || variant.stock < 0) {
          newErrors[`variant_stock_${index}`] = 'Variant stock cannot be negative'
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

    // Block creation if listing approval is Refused
    const canAdd = await canSupplierAddProducts(supplierOwnerId)
    if (!canAdd) {
      setError('You cannot add products. Listing approval status is "Refused". Please contact an administrator.')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // Determine the owner ID based on user role (for image upload path)
      const ownerId = supplierOwnerId

      if (!ownerId) {
        setError('Product owner could not be determined. Please select a supplier or log in again.')
        setIsSaving(false)
        return
      }

      // Upload images to Supabase Storage
      const imageUrls: string[] = []
      
      if (formData.images.length > 0) {
        for (const imageFile of formData.images) {
          try {
            // Generate unique filename using the supplier's ID (ownerId)
            const fileExt = imageFile.name.split('.').pop()
            const timestamp = Date.now()
            const randomStr = Math.random().toString(36).substring(2, 9)
            const fileName = `${ownerId}/${timestamp}-${randomStr}.${fileExt}`
            
            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('product_images')
              .upload(fileName, imageFile, {
                cacheControl: '3600',
                upsert: false
              })

            if (uploadError) {
              console.error('Error uploading image:', uploadError)
              setError(`Failed to upload image "${imageFile.name}": ${uploadError.message}`)
              setIsSaving(false)
              return
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('product_images')
              .getPublicUrl(uploadData.path)

            if (urlData?.publicUrl) {
              imageUrls.push(urlData.publicUrl)
            }
          } catch (err) {
            console.error('Error processing image:', err)
            setError(`Failed to process image "${imageFile.name}". Please try again.`)
            setIsSaving(false)
            return
          }
        }
      }

      // Base product data (without product_id and variant_id - they're auto-generated)
      // ownerId is already determined above for image uploads
      const baseProductData = {
        product_title: formData.title,
        brand_name: formData.brandName || null,
        bar_code: formData.bar_code,
        fk_owned_by: ownerId, // Use selected supplier for purchasers/admin, or own ID for suppliers
        image: imageUrls.length > 0 ? imageUrls : null, // Store array of image URLs in JSONB column
        status: 'active',
      }

      if (formData.hasVariants && formData.variants.length > 0) {
        // Product with variants: Insert first variant to get product_id, then insert rest
        const firstVariant = formData.variants[0]
        
        // Insert first row (first variant)
        const { data: firstInsert, error: firstError } = await supabase
          .from('products')
          .insert([{
            ...baseProductData,
            bar_code: firstVariant.sku || formData.bar_code,
            size: firstVariant.size || null,
            color: firstVariant.color || null,
            ml: firstVariant.ml || null,
            variant_selling_price: firstVariant.price || formData.sellingPrice,
            variant_stock: firstVariant.stock || 0,
            company_sku: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }])
          .select()
          .single()

        if (firstError) {
          console.error('Error creating product:', firstError)
          if (firstError.code === '23503') {
            setError('Invalid user ID. Please log out and log in again.')
          } else if (firstError.code === '23505') {
            setError('A product with this Bar Code already exists. Please use a different Bar Code.')
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

        // Insert remaining variants with the same product_id
        if (formData.variants.length > 1) {
          const remainingVariants = formData.variants.slice(1).map(variant => ({
            product_id: productId, // Use the product_id from first insert
            ...baseProductData,
            bar_code: variant.sku || formData.bar_code,
            size: variant.size || null,
            color: variant.color || null,
            ml: variant.ml || null,
            variant_selling_price: variant.price || formData.sellingPrice,
            variant_stock: variant.stock || 0,
            company_sku: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))

          const { error: variantsError } = await supabase
            .from('products')
            .insert(remainingVariants)

          if (variantsError) {
            console.error('Error creating additional variants:', variantsError)
            setError('Product created but failed to save all variants. Please edit the product to add missing variants.')
            setIsSaving(false)
            return
          }
        }

        // Images are already stored in the images JSONB column in baseProductData

        setSuccess('Product created successfully!')
        setTimeout(() => {
          router.push('/products')
        }, 1500)
      } else {
        // Product without variants - insert one row with variant_id auto-generated
        // variant_selling_price and variant_stock are filled, but size/color/ml are NULL
        const { data: insertedData, error: productError } = await supabase
          .from('products')
          .insert([{
            ...baseProductData,
            // variant_id will be auto-generated by DB
            size: null,
            color: null,
            ml: null,
            variant_selling_price: formData.sellingPrice,
            variant_stock: formData.stockAmount,
            company_sku: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }])
          .select()
          .single()

        if (productError) {
          console.error('Error creating product:', productError)
          if (productError.code === '23503') {
            setError('Invalid user ID. Please log out and log in again.')
          } else if (productError.code === '23505') {
            setError('A product with this Bar Code already exists. Please use a different Bar Code.')
          } else {
            setError(productError.message || 'Failed to create product. Please try again.')
          }
          setIsSaving(false)
          return
        }

        if (insertedData) {
          // Images are already stored in the images JSONB column in baseProductData
          setSuccess('Product created successfully!')
          setTimeout(() => {
            router.push('/products')
          }, 1500)
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

  return (
    <div className="flex h-screen bg-gray-100 transition-colors">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => router.push('/products')}
              className="p-2 rounded-lg hover:bg-gray-200 transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Add New Product</h2>
              <p className="text-gray-600">Fill in the details to add a new product to your inventory</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
              <p className="text-sm text-green-600 font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white border border-gray-300 rounded-2xl p-8">
              {/* Supplier Selector (for purchasers and admin) */}
              {(userRole === 'purchaser' || userRole === 'admin') && (
                <div className="mb-6">
                  <label htmlFor="supplier" className="block text-sm font-semibold text-gray-900 mb-2">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="supplier"
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value)
                      if (errors.supplier) {
                        setErrors(prev => ({ ...prev, supplier: '' }))
                      }
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                      errors.supplier ? 'border-red-500' : 'border-gray-200'
                    } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                    required
                  >
                    <option value="">Select a supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.user_id} value={supplier.user_id}>
                        {supplier.store_name || supplier.owner_name || supplier.email}
                      </option>
                    ))}
                  </select>
                  {errors.supplier && (
                    <p className="mt-1 text-sm text-red-500">{errors.supplier}</p>
                  )}
                  {suppliers.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      No suppliers available. <button type="button" onClick={() => router.push('/suppliers/new')} className="text-primary-blue hover:underline">Create one</button>
                    </p>
                  )}
                </div>
              )}

              {/* Product Title */}
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


              {/* Product Images */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Pictures <span className="text-red-500">*</span> (Max 5)
                </label>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="w-32 h-32 rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Product ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.images.length < 5 && (
                      <label className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 transition-all">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
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

              {/* Brand Name */}
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

              {/* Variants Toggle */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasVariants}
                    onChange={toggleVariants}
                    className="w-5 h-5 text-primary-blue border-gray-300 rounded focus:ring-primary-blue cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-900">
                    This product has variants (Size, Color, ML, etc.)
                  </span>
                </label>
                {errors.variants && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.variants}</span>
                )}
              </div>

              {/* Bar Code (hidden if has variants) */}
              {!formData.hasVariants && (
                <div className="mb-6">
                  <label htmlFor="bar_code" className="block text-sm font-semibold text-gray-900 mb-2">
                    Bar Code
                  </label>
                  <input
                    id="bar_code"
                    name="bar_code"
                    type="text"
                    value={formData.bar_code}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all font-mono ${
                      errors.bar_code ? 'border-red-500' : 'border-gray-200'
                    } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                    placeholder="e.g., PROD-001"
                  />
                  {errors.bar_code && (
                    <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.bar_code}</span>
                  )}
                </div>
              )}

              {/* Selling Price (hidden if has variants) */}
              {!formData.hasVariants && (
                <div className="mb-6">
                  <label htmlFor="sellingPrice" className="block text-sm font-semibold text-gray-900 mb-2">
                    Product Selling Price (Product Price + Fulfillment Cost + Margin) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-gray-500">Amount</span>
                    <input
                      id="sellingPrice"
                      name="sellingPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.sellingPrice || ''}
                      onChange={handleChange}
                      className={`w-full pl-16 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 transition-all ${
                        errors.sellingPrice ? 'border-red-500' : 'border-gray-200'
                      } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {errors.sellingPrice && (
                    <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.sellingPrice}</span>
                  )}
                </div>
              )}

              {/* Stock Amount (hidden if has variants) */}
              {!formData.hasVariants && (
                <div className="mb-6">
                  <label htmlFor="stockAmount" className="block text-sm font-semibold text-gray-900 mb-2">
                    Stock Units <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="stockAmount"
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
              )}

              {/* Variants Section */}
              {formData.hasVariants && (
                <div className="mb-6 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Product Variants</h3>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-all flex items-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add Variant
                    </button>
                  </div>

                  {formData.variants.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No variants added yet. Click &quot;Add Variant&quot; to get started.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {formData.variants.map((variant, index) => (
                        <div key={variant.id} className="p-4 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-gray-900">Variant {index + 1}</h4>
                            <button
                              type="button"
                              onClick={() => removeVariant(variant.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Size</label>
                              <input
                                type="text"
                                value={variant.size || ''}
                                onChange={(e) => updateVariant(variant.id, 'size', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                placeholder="e.g., S, M, L, XL"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
                              <input
                                type="text"
                                value={variant.color || ''}
                                onChange={(e) => updateVariant(variant.id, 'color', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                placeholder="e.g., Red, Blue, Black"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">ML</label>
                              <input
                                type="text"
                                value={variant.ml || ''}
                                onChange={(e) => updateVariant(variant.id, 'ml', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                placeholder="e.g., 250ml, 500ml"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Price (PKR) *</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variant.price || ''}
                                onChange={(e) => updateVariant(variant.id, 'price', parseFloat(e.target.value) || 0)}
                                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none ${
                                  errors[`variant_price_${index}`] ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'
                                }`}
                                placeholder="0.00"
                                required
                              />
                              {errors[`variant_price_${index}`] && (
                                <span className="block text-xs text-red-500 mt-1">{errors[`variant_price_${index}`]}</span>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Stock Units*</label>
                              <input
                                type="number"
                                min="0"
                                value={variant.stock || ''}
                                onChange={(e) => updateVariant(variant.id, 'stock', parseInt(e.target.value) || 0)}
                                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white text-gray-900 focus:outline-none ${
                                  errors[`variant_stock_${index}`] ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'
                                }`}
                                placeholder="0"
                                required
                              />
                              {errors[`variant_stock_${index}`] && (
                                <span className="block text-xs text-red-500 mt-1">{errors[`variant_stock_${index}`]}</span>
                              )}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Bar Code</label>
                              <input
                                type="text"
                                value={variant.sku || ''}
                                onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 font-mono focus:border-primary-blue focus:outline-none"
                                placeholder="e.g., PROD-001-RED-L"
                              />
                            </div>
                          </div>
                          {errors[`variant_${index}`] && (
                            <span className="block text-xs text-red-500 mt-2">{errors[`variant_${index}`]}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => router.push('/products')}
                  className="px-6 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving Product...</span>
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

