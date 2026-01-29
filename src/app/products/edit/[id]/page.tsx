'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  X, 
  Upload,
  Trash2,
  Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { groupProductsByProductId } from '@/lib/productHelpers'
import { canPurchaserEditProduct, getPurchaserIntegerId } from '@/lib/supplierHelpers'
import { createPriceHistoryEntry } from '@/lib/priceHistoryHelpers'

interface Variant {
  id: string
  variant_id?: number
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
  existingImages: string[]
  hasVariants: boolean
  variants: Variant[]
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const { isAuthenticated, isLoading: authLoading, userFriendlyId, userRole, userId } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState<ProductFormData>({
    title: '',
    brandName: '',
    sellingPrice: 0,
    stockAmount: 0,
    bar_code: '',
    images: [],
    existingImages: [],
    hasVariants: false,
    variants: [],
  })

  // Store original prices to track changes for price history
  const [originalPrices, setOriginalPrices] = useState<Map<number, number>>(new Map())

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (isAuthenticated && productId) {
      fetchProduct()
    }
  }, [isAuthenticated, authLoading, productId, router])

  const fetchProduct = async () => {
    setIsLoading(true)
    try {
      // Convert productId from string to number
      const productIdNum = parseInt(productId, 10)
      if (isNaN(productIdNum)) {
        setError('Invalid product ID')
        setIsLoading(false)
        return
      }

      // Fetch all rows for this product_id (each variant is a separate row)
      const { data: productRows, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', productIdNum)

      if (productError || !productRows || productRows.length === 0) {
        console.error('Error fetching product:', productError)
        setError('Product not found')
        setIsLoading(false)
        return
      }

      // Check if product belongs to current user or (for purchasers/admin) to one of their suppliers
      const productOwnerId = productRows[0].fk_owned_by
      
      if (userRole === 'admin') {
        // Admin can edit any product - no permission check needed
      } else if (userRole === 'purchaser' && userId) {
        // For purchasers: check if product belongs to one of their suppliers
        // Get purchaser's integer ID
        const purchaserIntId = await getPurchaserIntegerId(userId)
        if (!purchaserIntId) {
          setError('Unable to verify purchaser permissions')
          setIsLoading(false)
          return
        }
        const canEdit = await canPurchaserEditProduct(purchaserIntId, productOwnerId)
        if (!canEdit) {
          setError('You do not have permission to edit this product')
          setIsLoading(false)
          return
        }
      } else {
        // For suppliers: check if product belongs to them
        if (productOwnerId !== userFriendlyId) {
          setError('You do not have permission to edit this product')
          setIsLoading(false)
          return
        }
      }

      // Group rows by product_id (should only be one product)
      const groupedProducts = groupProductsByProductId(productRows)
      const product = groupedProducts[0]

      if (!product) {
        setError('Product not found')
        setIsLoading(false)
        return
      }

      // Populate form with product data
      const hasVariants = product.variants && product.variants.length > 0
      
      // Get selling price and stock: from first variant if has variants, or from first row's variant_selling_price/variant_stock if no variants
      let sellingPrice = 0
      let stockAmount = 0
      if (hasVariants && product.variants.length > 0) {
        sellingPrice = product.variants[0].variant_selling_price || 0
        stockAmount = product.variants[0].variant_stock || 0
      } else if (productRows.length > 0) {
        // Product without variants - get price and stock from variant_selling_price and variant_stock columns
        sellingPrice = productRows[0].variant_selling_price || 0
        stockAmount = productRows[0].variant_stock || 0
      }
      
      // Handle image as JSONB array or single string (backward compatibility)
      const existingImages = Array.isArray(product.image) && product.image.length > 0
        ? product.image
        : (typeof product.image === 'string' && product.image ? [product.image] : [])
      
      // Store original prices for price history tracking
      const priceMap = new Map<number, number>()
      if (hasVariants && product.variants.length > 0) {
        product.variants.forEach(v => {
          if (v.variant_id) {
            priceMap.set(v.variant_id, v.variant_selling_price || 0)
          }
        })
      } else if (productRows.length > 0 && productRows[0].variant_id) {
        priceMap.set(productRows[0].variant_id, productRows[0].variant_selling_price || 0)
      }
      setOriginalPrices(priceMap)
      
      // Safely get brand_name, handling case where column might not exist yet
      const brandName = (productRows[0] as any)?.brand_name ?? ''
      
      setFormData({
        title: product.product_title || '',
        brandName: brandName,
        sellingPrice: sellingPrice,
        stockAmount: stockAmount,
        bar_code: product.bar_code || '',
        images: [],
        existingImages: existingImages,
        hasVariants: hasVariants,
        variants: hasVariants
          ? product.variants.map((v) => ({
              id: String(v.variant_id), // Convert to string for form
              variant_id: v.variant_id,
              size: v.size || '',
              color: v.color || '',
              ml: v.ml || '',
              price: v.variant_selling_price || 0,
              stock: v.variant_stock || 0,
              sku: v.bar_code || '',
            }))
          : [],
      })
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('Failed to load product data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'sellingPrice' || name === 'stockAmount' ? parseFloat(value) || 0 : value
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const currentCount = formData.images.length + formData.existingImages.length
    const maxImages = 5
    
    // Limit to maximum 5 images total (existing + new)
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

  const removeExistingImage = (index: number) => {
    const newExistingImages = formData.existingImages.filter((_, i) => i !== index)
    setFormData(prev => ({
      ...prev,
      existingImages: newExistingImages
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
          id: `temp-${Date.now()}`,
          size: '',
          color: '',
          ml: '',
          price: prev.sellingPrice,
          stock: 0,
          sku: '',
        }
      ]
    }))
  }

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }))
  }

  const updateVariant = (index: number, field: keyof Variant, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    }))
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Product title is required'
    }

    // Bar code is optional - no validation needed

    if (!formData.hasVariants && formData.sellingPrice <= 0) {
      newErrors.sellingPrice = 'Selling price must be greater than 0'
    }

    const totalImages = formData.images.length + formData.existingImages.length
    if (totalImages === 0) {
      newErrors.images = 'Please upload at least 1 product image'
    } else if (totalImages > 5) {
      newErrors.images = 'Maximum 5 images allowed'
    }

    if (!formData.hasVariants && formData.stockAmount < 0) {
      newErrors.stockAmount = 'Stock amount cannot be negative'
    }

    if (formData.hasVariants) {
      if (formData.variants.length === 0) {
        newErrors.variants = 'Please add at least one variant'
      } else {
        formData.variants.forEach((variant, index) => {
          if (!variant.price || variant.price <= 0) {
            newErrors[`variant_${index}_price`] = 'Variant price is required'
          }
          if (variant.stock === undefined || variant.stock < 0) {
            newErrors[`variant_${index}_stock`] = 'Variant stock is required'
          }
          // Bar code is optional - no validation needed
        })
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (isSaving) {
      return
    }
    
    if (!validateForm()) {
      setError('Please fix the errors before saving')
      return
    }

    if (!userFriendlyId) {
      setError('User not authenticated. Please log in again.')
      router.push('/login')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // Convert productId from string to number
      const productIdNum = parseInt(productId, 10)
      if (isNaN(productIdNum)) {
        setError('Invalid product ID')
        setIsSaving(false)
        return
      }

      // Fetch existing rows to get variant_ids, company_sku, and fk_owned_by values
      // We need this early to determine the image upload path
      const { data: existingRows } = await supabase
        .from('products')
        .select('variant_id, company_sku, fk_owned_by')
        .eq('product_id', productIdNum)

      // Get original owner from first row (should be same for all rows of same product)
      // Use this for image upload path (not the purchaser's ID)
      const originalOwnerId = existingRows && existingRows.length > 0 
        ? existingRows[0].fk_owned_by 
        : userFriendlyId

      // Upload new images to Supabase Storage
      const newImageUrls: string[] = []
      
      if (formData.images.length > 0) {
        for (const imageFile of formData.images) {
          try {
            // Generate unique filename using the product owner's ID (not purchaser's ID)
            const fileExt = imageFile.name.split('.').pop()
            const timestamp = Date.now()
            const randomStr = Math.random().toString(36).substring(2, 9)
            const fileName = `${originalOwnerId}/${timestamp}-${randomStr}.${fileExt}`
            
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
              newImageUrls.push(urlData.publicUrl)
            }
          } catch (err) {
            console.error('Error processing image:', err)
            setError(`Failed to process image "${imageFile.name}". Please try again.`)
            setIsSaving(false)
            return
          }
        }
      }

      // Combine existing images with new images
      const allImageUrls = [...formData.existingImages, ...newImageUrls]

      // existingRows and originalOwnerId are already fetched above for image uploads

      // Create a map of variant_id to company_sku for preservation
      const companySkuMap = new Map<number, string | null>()
      const existingVariantIds = new Set<number>()
      if (existingRows) {
        existingRows.forEach(row => {
          if (row.variant_id) {
            companySkuMap.set(row.variant_id, row.company_sku)
            existingVariantIds.add(row.variant_id)
          }
        })
      }

      // Prepare new rows to insert (product_id and variant_id are auto-generated)
      // Note: fk_owned_by should remain the same (original owner)
      const baseProductData = {
        product_title: formData.title,
        brand_name: formData.brandName || null,
        bar_code: formData.bar_code,
        fk_owned_by: originalOwnerId, // Keep original owner
        image: allImageUrls.length > 0 ? allImageUrls : null, // Store array of image URLs in JSONB column
        status: 'active',
      }

      if (formData.hasVariants && formData.variants.length > 0) {
        // Separate variants into existing (to update) and new (to insert)
        const variantsToUpdate: Array<{ variant: typeof formData.variants[0], variant_id: number }> = []
        const variantsToInsert: Array<typeof formData.variants[0]> = []

        formData.variants.forEach(variant => {
          // Check if this is an existing variant (has variant_id that exists in database)
          if (variant.variant_id && existingVariantIds.has(variant.variant_id)) {
            variantsToUpdate.push({ variant, variant_id: variant.variant_id })
          } else {
            // New variant (no variant_id or variant_id doesn't exist in database)
            variantsToInsert.push(variant)
          }
        })


        // Track if any price changes are pending approval
        let hasPendingPriceChanges = false

        // Update existing variants
        for (const { variant, variant_id } of variantsToUpdate) {
          const newPrice = variant.price || formData.sellingPrice
          const oldPrice = originalPrices.get(variant_id) || 0
          
          // Check if price changed
          const priceChanged = oldPrice !== newPrice
          
          const { error: updateError } = await supabase
            .from('products')
            .update({
              product_title: formData.title,
              brand_name: formData.brandName || null,
              bar_code: variant.sku || formData.bar_code,
              size: variant.size || null,
              color: variant.color || null,
              ml: variant.ml || null,
              // Keep old price if price changed (pending approval), otherwise use new price
              variant_selling_price: priceChanged ? oldPrice : newPrice,
              variant_stock: variant.stock || 0,
              image: allImageUrls.length > 0 ? allImageUrls : null, // Store array of image URLs in JSONB column
              status: 'active',
              // Preserve company_sku
              company_sku: companySkuMap.get(variant_id) || null,
              updated_at: new Date().toISOString(),
            })
            .eq('variant_id', variant_id)
            .eq('product_id', productIdNum)

          if (updateError) {
            console.error('Error updating variant:', variant_id, updateError)
            setError(`Failed to update variant. ${updateError.message}`)
            setIsSaving(false)
            return
          }

          // Create pending price history entry if price changed
          if (priceChanged && userFriendlyId) {
            const purchaserIntId = userRole === 'purchaser' && userId 
              ? await getPurchaserIntegerId(userId) 
              : null
            
            await createPriceHistoryEntry(
              productIdNum,
              variant_id,
              oldPrice,
              newPrice,
              userFriendlyId,  // Use userFriendlyId (SUP-000001 format)
              purchaserIntId,
              'pending'  // Create as pending for approval
            )
            
            hasPendingPriceChanges = true
          }
        }

        // Insert new variants
        if (variantsToInsert.length > 0) {
          const newVariants = variantsToInsert.map(variant => ({
            product_id: productIdNum,
            ...baseProductData,
            bar_code: variant.sku || formData.bar_code,
            size: variant.size || null,
            color: variant.color || null,
            ml: variant.ml || null,
            variant_selling_price: variant.price || formData.sellingPrice,
            variant_stock: variant.stock || 0,
            company_sku: null, // New variants don't have company_sku yet
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))

          const { error: insertError } = await supabase
            .from('products')
            .insert(newVariants)

          if (insertError) {
            console.error('Error inserting new variants:', insertError)
            setError(insertError.message || 'Failed to add new variants. Please try again.')
            setIsSaving(false)
            return
          }
        }

        // Delete variants that were removed from the form
        const formVariantIds = new Set(
          formData.variants
            .map(v => v.variant_id)
            .filter((id): id is number => id !== undefined && existingVariantIds.has(id))
        )

        const variantsToDelete = Array.from(existingVariantIds).filter(
          id => !formVariantIds.has(id)
        )

        if (variantsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('product_id', productIdNum)
            .in('variant_id', variantsToDelete)

          if (deleteError) {
            console.error('Error deleting removed variants:', deleteError)
          }
        }

        // Show appropriate success message based on whether price changes are pending
        if (hasPendingPriceChanges) {
          setSuccess('Request sent for approval! Other changes saved successfully.')
        } else {
          setSuccess('Product updated successfully!')
        }
        setIsSaving(false)
        setTimeout(() => {
          router.push('/products')
        }, 1500)
      } else {
        // Product without variants - update existing row
        const { data: existingProductRow } = await supabase
          .from('products')
          .select('variant_id')
          .eq('product_id', productIdNum)
          .limit(1)
          .single()

        // Track if any price changes are pending approval
        let hasPendingPriceChanges = false

        if (existingProductRow) {
          const variantId = existingProductRow.variant_id
          const oldPrice = originalPrices.get(variantId) || 0
          const newPrice = formData.sellingPrice
          
          // Check if price changed
          const priceChanged = oldPrice !== newPrice
          
          // Update existing product row
          const { error: updateError } = await supabase
            .from('products')
            .update({
              product_title: formData.title,
              brand_name: formData.brandName || null,
              bar_code: formData.bar_code,
              // Keep old price if price changed (pending approval), otherwise use new price
              variant_selling_price: priceChanged ? oldPrice : newPrice,
              variant_stock: formData.stockAmount,
              image: allImageUrls.length > 0 ? allImageUrls : null, // Store array of image URLs in JSONB column
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('product_id', productIdNum)

          if (updateError) {
            console.error('Error updating product:', updateError)
            setError(updateError.message || 'Failed to update product. Please try again.')
            setIsSaving(false)
            return
          }

          // Create pending price history entry if price changed
          if (priceChanged && userFriendlyId) {
            const purchaserIntId = userRole === 'purchaser' && userId 
              ? await getPurchaserIntegerId(userId) 
              : null
            
            await createPriceHistoryEntry(
              productIdNum,
              variantId,
              oldPrice,
              newPrice,
              userFriendlyId,  // Use userFriendlyId (SUP-000001 format)
              purchaserIntId,
              'pending'  // Create as pending for approval
            )
            
            hasPendingPriceChanges = true
          }
        } else {
          // Shouldn't happen in edit, but handle it
          const { error: insertError } = await supabase
            .from('products')
            .insert([{
              product_id: productIdNum,
              ...baseProductData,
              size: null,
              color: null,
              ml: null,
              variant_selling_price: formData.sellingPrice,
              variant_stock: formData.stockAmount,
              company_sku: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }])

          if (insertError) {
            console.error('Error inserting product:', insertError)
            setError(insertError.message || 'Failed to update product. Please try again.')
            setIsSaving(false)
            return
          }
        }

        // Update product-level fields (title, brand_name, image, status) for all rows
        // This ensures consistency across all variant rows
        const { error: bulkUpdateError } = await supabase
          .from('products')
          .update({
            product_title: formData.title,
            brand_name: formData.brandName || null,
            image: allImageUrls.length > 0 ? allImageUrls : null,
            status: 'active',
          })
          .eq('product_id', productIdNum)

        if (bulkUpdateError) {
          console.warn('Warning: Could not update product-level fields for all rows:', bulkUpdateError)
          // Don't fail the operation, just log the warning
        }

        // Show appropriate success message based on whether price changes are pending
        if (hasPendingPriceChanges) {
          setSuccess('Request sent for approval! Other changes saved successfully.')
        } else {
          setSuccess('Product updated successfully!')
        }
        setIsSaving(false)
        setTimeout(() => {
          router.push('/products')
        }, 1500)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsSaving(false)
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
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => router.push('/products')}
              className="mb-6 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Back to Products</span>
            </button>

            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Edit Product</h1>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl">
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">{success}</p>
              </div>
            )}

            <form 
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmit(e)
              }} 
              className="space-y-6"
            >
              <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-8">
                {/* Product Title */}
                <div className="mb-6">
                  <label htmlFor="title" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    value={formData.title}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.title ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
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
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Product Pictures (Max 5) <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {formData.existingImages.map((url, index) => (
                      <div key={`existing-${index}`} className="relative group">
                        <img
                          src={url}
                          alt={`Product ${index + 1}`}
                          className="w-32 h-32 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {formData.images.map((file, index) => (
                      <div key={`new-${index}`} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`New ${index + 1}`}
                          className="w-32 h-32 rounded-xl object-cover border-2 border-gray-200 dark:border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(formData.images.length + formData.existingImages.length) < 5 && (
                      <label className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <span className="text-xs text-gray-600 dark:text-gray-400">Add Image</span>
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
                    <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.images}</span>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    {(formData.images.length + formData.existingImages.length)} / 5 images (maximum 5 images allowed)
                  </p>
                </div>

                {/* Brand Name */}
                <div className="mb-6">
                  <label htmlFor="brandName" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Brand Name <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    id="brandName"
                    name="brandName"
                    type="text"
                    value={formData.brandName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.brandName ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
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
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
                    <label htmlFor="bar_code" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Bar Code
                    </label>
                    <input
                      id="bar_code"
                      name="bar_code"
                      type="text"
                      value={formData.bar_code}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all font-mono ${
                        errors.bar_code ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
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
                    <label htmlFor="sellingPrice" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Product Selling Price (PKR) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-gray-500">PKR</span>
                      <input
                        id="sellingPrice"
                        name="sellingPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.sellingPrice || ''}
                        onChange={handleChange}
                        className={`w-full pl-16 pr-4 py-3 border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                          errors.sellingPrice ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
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
                    <label htmlFor="stockAmount" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      Stock Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="stockAmount"
                      name="stockAmount"
                      type="number"
                      min="0"
                      value={formData.stockAmount || ''}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                        errors.stockAmount ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                      } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                      placeholder="0"
                      required
                    />
                    {errors.stockAmount && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.stockAmount}</span>
                    )}
                  </div>
                )}

                {/* Variants Details */}
                {formData.hasVariants && (
                  <div className="mb-6 p-6 bg-gray-50 dark:bg-dark-hover rounded-xl border-2 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Variants Details</h3>
                      <button
                        type="button"
                        onClick={addVariant}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-primary-blue-dark transition-colors text-sm font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add Variant
                      </button>
                    </div>

                    {formData.variants.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No variants added yet. Click &quot;Add Variant&quot; to create one.</p>
                    )}

                    {formData.variants.map((variant, index) => (
                      <div key={variant.id} className="mb-4 p-4 bg-white dark:bg-dark-card rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Variant {index + 1}</h4>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
                            <input
                              type="text"
                              value={variant.size || ''}
                              onChange={(e) => updateVariant(index, 'size', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm focus:border-primary-blue focus:outline-none"
                              placeholder="e.g., Large"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
                            <input
                              type="text"
                              value={variant.color || ''}
                              onChange={(e) => updateVariant(index, 'color', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm focus:border-primary-blue focus:outline-none"
                              placeholder="e.g., Red"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ML</label>
                            <input
                              type="text"
                              value={variant.ml || ''}
                              onChange={(e) => updateVariant(index, 'ml', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm focus:border-primary-blue focus:outline-none"
                              placeholder="e.g., 500ml"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Price (PKR) <span className="text-red-500">*</span></label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={variant.price || ''}
                              onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm focus:outline-none ${
                                errors[`variant_${index}_price`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-primary-blue'
                              }`}
                              placeholder="0.00"
                              required
                            />
                            {errors[`variant_${index}_price`] && (
                              <span className="block text-[11px] text-red-500 mt-1">{errors[`variant_${index}_price`]}</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stock <span className="text-red-500">*</span></label>
                            <input
                              type="number"
                              min="0"
                              value={variant.stock || ''}
                              onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm focus:outline-none ${
                                errors[`variant_${index}_stock`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-primary-blue'
                              }`}
                              placeholder="0"
                              required
                            />
                            {errors[`variant_${index}_stock`] && (
                              <span className="block text-[11px] text-red-500 mt-1">{errors[`variant_${index}_stock`]}</span>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bar Code</label>
                            <input
                              type="text"
                              value={variant.sku || ''}
                              onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                              className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-white text-sm font-mono focus:outline-none ${
                                errors[`variant_${index}_sku`] ? 'border-red-500' : 'border-gray-200 dark:border-gray-700 focus:border-primary-blue'
                              }`}
                              placeholder="e.g., PROD-001-RED-L"
                            />
                            {errors[`variant_${index}_sku`] && (
                              <span className="block text-[11px] text-red-500 mt-1">{errors[`variant_${index}_sku`]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {errors.variants && (
                      <span className="block text-[13px] text-red-500 mt-2 font-medium">{errors.variants}</span>
                    )}
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push('/products')
                    }}
                    className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

