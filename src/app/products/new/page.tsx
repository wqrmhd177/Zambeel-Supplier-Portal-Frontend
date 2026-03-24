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
  'Purple', 'Gray', 'Brown', 'Beige', 'Navy', 'Teal', 'Maroon', 'Gold', 'Silver',
  'Burgundy', 'Coral', 'Salmon', 'Rust', 'Brick Red', 'Crimson', 'Scarlet', 'Wine',
  'Sky Blue', 'Royal Blue', 'Baby Blue', 'Turquoise', 'Aqua', 'Cobalt', 'Indigo',
  'Olive', 'Forest Green', 'Mint', 'Sage', 'Lime', 'Army Green', 'Hunter Green',
  'Lavender', 'Lilac', 'Plum', 'Violet', 'Magenta', 'Fuchsia', 'Mauve',
  'Charcoal', 'Slate', 'Ash', 'Smoke', 'Stone', 'Taupe', 'Khaki',
  'Cream', 'Ivory', 'Off-White', 'Eggshell', 'Tan', 'Camel', 'Caramel', 'Bronze',
  'Mustard', 'Amber', 'Honey', 'Champagne', 'Blush', 'Dusty Rose', 'Rose', 'Peach',
  'Denim', 'Cobalt Blue', 'Electric Blue', 'Midnight Blue', 'Steel Blue'
]

const SIZE_VARIANT_OPTIONS = ['Small', 'Medium', 'Large', 'XL', 'XXL', 'XXXL']

const VARIANT_NAME_SUGGESTIONS = [
  'Color', 'Size', 'Weight', 'Volume', 'Length'
]

type VariantValueType = 'list' | 'colors' | 'number'
const VARIANT_VALUE_CONFIG: Record<string, { type: VariantValueType; unit?: string; options?: string[] }> = {
  Size: { type: 'list', options: SIZE_VARIANT_OPTIONS },
  Color: { type: 'colors', options: COLOR_OPTIONS },
  Weight: { type: 'number', unit: 'grams' },
  Volume: { type: 'number', unit: 'ml' },
  Length: { type: 'number', unit: 'inches' },
}

function getVariantValueConfig(variantName: string): { type: VariantValueType; unit?: string; options?: string[] } | null {
  const key = variantName.trim() || ''
  return VARIANT_VALUE_CONFIG[key] || null
}

function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ')
}

interface ProductOption {
  id: string
  name: string
  values: string[]
}

interface VariantRow {
  id: string
  optionValues: Record<string, string>
  active: boolean
  price: number
  stock: number
  sku: string
  images: File[]
}

interface LegacyVariant {
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
  options: ProductOption[]
  variants: VariantRow[]
  legacyVariants: LegacyVariant[]
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
    hasVariants: false,
    options: [],
    variants: [],
    legacyVariants: [],
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [packageIncludesOtherText, setPackageIncludesOtherText] = useState('')
  const [isVariantsSectionOpen, setIsVariantsSectionOpen] = useState(false)
  const [sellingPriceInput, setSellingPriceInput] = useState('')
  const [stockAmountInput, setStockAmountInput] = useState('')
  const [newOptionName, setNewOptionName] = useState('')
  const [newOptionValue, setNewOptionValue] = useState('')
  const [numericValueByOptionId, setNumericValueByOptionId] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (isAuthenticated && (userRole === 'purchaser' || userRole === 'admin')) {
      fetchSuppliers()
    }
  }, [authLoading, isAuthenticated, userRole, userId, router])

  useEffect(() => {
    if (!showSuccessScreen) return
    const t = setTimeout(() => router.push('/products'), 5000)
    return () => clearTimeout(t)
  }, [showSuccessScreen, router])

  // Auto-generate variant combinations when options/values change (no button)
  useEffect(() => {
    if (!formData.hasVariants || formData.options.length === 0) return
    const validOptions = formData.options.filter(o => o.name.trim() && o.values.length > 0)
    if (validOptions.length === 0) {
      setFormData(prev => ({ ...prev, variants: [] }))
      return
    }

    const generateCombinations = (opts: ProductOption[]): Record<string, string>[] => {
      if (opts.length === 0) return [{}]
      const [first, ...rest] = opts
      const restCombinations = generateCombinations(rest)
      const result: Record<string, string>[] = []
      for (const value of first.values) {
        for (const combo of restCombinations) {
          result.push({ [first.name]: value, ...combo })
        }
      }
      return result
    }

    const combinations = generateCombinations(validOptions)
    if (combinations.length > 50) {
      setError(`Too many combinations (${combinations.length}). Maximum 50 variants. Reduce variant values.`)
      return
    }
    setError('')

    setFormData(prev => {
      const existingMap = new Map(prev.variants.map(v => [JSON.stringify(v.optionValues), v]))
      const newVariants = combinations.map(optionValues => {
        const key = JSON.stringify(optionValues)
        const existing = existingMap.get(key)
        if (existing) return existing
        return {
          id: crypto.randomUUID(),
          optionValues,
          active: true,
          price: prev.sellingPrice || 0,
          stock: 0,
          sku: '',
          images: []
        }
      })
      return { ...prev, variants: newVariants }
    })
  }, [
    formData.hasVariants,
    JSON.stringify(formData.options.map(o => ({ name: o.name, values: o.values }))),
    formData.sellingPrice
  ])

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
    if (userRole === 'admin') {
      // Admin can see all active suppliers in the system
      const { data, error } = await supabase
        .from('users')
        .select('id, user_id, email, shop_name_on_zambeel, country, phone_number, onboarded, account_approval, created_at')
        .eq('role', 'supplier')
        .eq('archived', false)
        .eq('account_approval', 'Approved')
        .order('shop_name_on_zambeel', { ascending: true })

      if (!error && data) {
        setSuppliers(data)
      }
    } else if (userRole === 'purchaser' && userId) {
      // Purchaser can only see suppliers from their own country
      const supplierList = await fetchSuppliersForPurchaser(userId)
      setSuppliers(supplierList)
    }
  }
  
  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier => {
    if (!supplierSearch) return true
    const searchLower = supplierSearch.toLowerCase()
    return (
      (supplier.shop_name_on_zambeel?.toLowerCase().includes(searchLower)) ||
      (supplier.email?.toLowerCase().includes(searchLower)) ||
      (supplier.user_id?.toLowerCase().includes(searchLower))
    )
  })
  
  // Get selected supplier display name (show only shop_name_on_zambeel)
  const selectedSupplier = suppliers.find(s => s.user_id === selectedSupplierId)
  const selectedSupplierDisplay = selectedSupplier?.shop_name_on_zambeel || ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    if (name === 'sellingPrice') {
      setSellingPriceInput(value)
      const num = value === '' ? 0 : parseFloat(value)
      setFormData(prev => ({ ...prev, sellingPrice: Number.isNaN(num) ? 0 : num }))
    } else if (name === 'stockAmount') {
      setStockAmountInput(value)
      const num = value === '' ? 0 : parseInt(value, 10)
      setFormData(prev => ({ ...prev, stockAmount: Number.isNaN(num) ? 0 : num }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
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
    
    // Limit to maximum 5 media files
    const remainingSlots = maxImages - currentCount
    const filesToAdd = files.slice(0, remainingSlots)
    
    if (files.length > remainingSlots) {
      setErrors(prev => ({
        ...prev,
        images: `Maximum 5 media files allowed. Only ${remainingSlots} more file(s) can be added.`
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


  // New Shopify-style variant functions
  const addOption = () => {
    if (formData.options.length >= 3) {
      setError('Maximum 3 options allowed per product')
      return
    }
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        {
          id: crypto.randomUUID(),
          name: '',
          values: []
        }
      ]
    }))
  }

  const removeOption = (optionId: string) => {
    setFormData(prev => {
      const option = prev.options.find(o => o.id === optionId)
      if (!option) return prev
      
      const newOptions = prev.options.filter(o => o.id !== optionId)
      const newVariants = prev.variants.map(v => {
        const newOptionValues = { ...v.optionValues }
        delete newOptionValues[option.name]
        return { ...v, optionValues: newOptionValues }
      })
      
      return {
        ...prev,
        options: newOptions,
        variants: newVariants
      }
    })
  }

  const updateOptionName = (optionId: string, newName: string) => {
    const normalizedName = toTitleCase(newName)
    setFormData(prev => {
      const option = prev.options.find(o => o.id === optionId)
      if (!option) return prev
      
      const oldName = option.name
      const newOptions = prev.options.map(o =>
        o.id === optionId ? { ...o, name: normalizedName } : o
      )
      
      const newVariants = prev.variants.map(v => {
        if (!oldName || !v.optionValues[oldName]) return v
        const newOptionValues = { ...v.optionValues }
        newOptionValues[normalizedName] = newOptionValues[oldName]
        delete newOptionValues[oldName]
        return { ...v, optionValues: newOptionValues }
      })
      
      return {
        ...prev,
        options: newOptions,
        variants: newVariants
      }
    })
  }

  const addOptionValue = (optionId: string, value: string) => {
    if (!value.trim()) return
    
    setFormData(prev => ({
      ...prev,
      options: prev.options.map(o => {
        if (o.id !== optionId) return o
        if (o.values.includes(value.trim())) return o
        return { ...o, values: [...o.values, value.trim()] }
      })
    }))
  }

  const removeOptionValue = (optionId: string, value: string) => {
    setFormData(prev => {
      const option = prev.options.find(o => o.id === optionId)
      if (!option) return prev
      
      const newOptions = prev.options.map(o =>
        o.id === optionId
          ? { ...o, values: o.values.filter(v => v !== value) }
          : o
      )
      
      const newVariants = prev.variants.filter(v =>
        v.optionValues[option.name] !== value
      )
      
      return {
        ...prev,
        options: newOptions,
        variants: newVariants
      }
    })
  }

  const generateVariantCombinations = () => {
    const validOptions = formData.options.filter(o => o.name && o.values.length > 0)
    
    if (validOptions.length === 0) {
      setError('Please define at least one option with values before generating variants')
      return
    }

    const generateCombinations = (opts: ProductOption[]): Record<string, string>[] => {
      if (opts.length === 0) return [{}]
      
      const [first, ...rest] = opts
      const restCombinations = generateCombinations(rest)
      const result: Record<string, string>[] = []
      
      for (const value of first.values) {
        for (const combo of restCombinations) {
          result.push({ [first.name]: value, ...combo })
        }
      }
      
      return result
    }

    const combinations = generateCombinations(validOptions)
    
    if (combinations.length > 50) {
      setError(`This would generate ${combinations.length} variants. Maximum 50 allowed. Please reduce option values or use manual mode.`)
      return
    }

    setFormData(prev => {
      const existingMap = new Map(
        prev.variants.map(v => [JSON.stringify(v.optionValues), v])
      )
      
      const newVariants = combinations.map(optionValues => {
        const key = JSON.stringify(optionValues)
        const existing = existingMap.get(key)
        
        if (existing) {
          return existing
        }

        return {
          id: crypto.randomUUID(),
          optionValues,
          active: true,
          price: prev.sellingPrice || 0,
          stock: 0,
          sku: '',
          images: []
        }
      })
      
      return {
        ...prev,
        variants: newVariants
      }
    })
    
    setError('')
  }

  const addManualVariant = () => {
    const validOptions = formData.options.filter(o => o.name && o.values.length > 0)
    
    if (validOptions.length === 0) {
      setError('Please define at least one option with values before adding variants')
      return
    }

    if (formData.variants.length >= 50) {
      setError('Maximum 50 variants allowed per product')
      return
    }

    const defaultOptionValues: Record<string, string> = {}
    validOptions.forEach(opt => {
      defaultOptionValues[opt.name] = opt.values[0] || ''
    })

    setFormData(prev => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: crypto.randomUUID(),
          optionValues: defaultOptionValues,
          active: true,
          price: prev.sellingPrice || 0,
          stock: 0,
          sku: '',
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

  const updateVariant = (id: string, field: keyof VariantRow, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === id ? { ...v, [field]: value } : v
      )
    }))
  }

  const updateVariantOptionValue = (variantId: string, optionName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v =>
        v.id === variantId
          ? { ...v, optionValues: { ...v.optionValues, [optionName]: value } }
          : v
      )
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

  const getVariantDisplayName = (variant: VariantRow): string => {
    const parts = Object.entries(variant.optionValues)
      .map(([optName, value]) => {
        if (!value) return ''
        const config = getVariantValueConfig(optName)
        if (config?.type === 'number' && config.unit) return `${value} ${config.unit}`
        // For custom "Other" option names (e.g., Pieces), include the option name
        // so labels look like "50 Pieces / 50 Grams" instead of "50 / 50 Grams".
        if (!config) return `${value} ${toTitleCase(optName)}`.trim()
        return value
      })
      .filter(Boolean)
    return parts.join(' / ') || 'Variant'
  }

  // (Option-level media removed; media is now required only at variant level.)


  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Product title is required'
    }

    if ((userRole === 'purchaser' || userRole === 'admin') && !selectedSupplierId) {
      newErrors.supplier = 'Please select a supplier'
    }

    if (!formData.hasVariants) {
      if (formData.images.length === 0) {
        newErrors.images = 'Please upload at least 1 product image or video'
      } else if (formData.images.length > 5) {
        newErrors.images = 'Maximum 5 media files allowed'
      }
      
      if (formData.sellingPrice <= 0) {
        newErrors.sellingPrice = 'Selling price must be greater than 0'
      }
      if (formData.stockAmount < 0) {
        newErrors.stockAmount = 'Stock amount cannot be negative'
      }
    } else {
      if (formData.options.length === 0) {
        newErrors.options = 'Please define at least one option'
      }

      formData.options.forEach((option, optIndex) => {
        if (!option.name.trim()) {
          newErrors[`option_name_${optIndex}`] = 'Variant name is required'
        }
        if (option.values.length === 0) {
          newErrors[`option_values_${optIndex}`] = 'At least one value is required'
        }
      })

      if (formData.variants.length === 0) {
        newErrors.variants = 'Please generate or add at least one variant'
      }

      const activeVariants = formData.variants.filter(v => v.active)
      if (activeVariants.length === 0) {
        newErrors.variants = 'At least one variant must be active'
      }

      formData.variants.forEach((variant, index) => {
        if (variant.active) {
          if (!variant.price || variant.price <= 0) {
            newErrors[`variant_price_${index}`] = 'Price must be greater than 0'
          }
          if (variant.stock === undefined || variant.stock < 0) {
            newErrors[`variant_stock_${index}`] = 'Stock cannot be negative'
          }
          if (variant.images.length === 0 && formData.images.length === 0) {
            newErrors[`variant_images_${index}`] = 'At least 1 media file (image or video) is required for this variant'
          }
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

    const supplierOwnerId = (userRole === 'purchaser' || userRole === 'admin') && selectedSupplierId
      ? selectedSupplierId
      : userFriendlyId

    setIsSaving(true)
    setError('')
    setShowSuccessScreen(false)

    try {
      const ownerId = supplierOwnerId

      if (!ownerId) {
        setError('Product owner could not be determined. Please select a supplier or log in again.')
        setIsSaving(false)
        return
      }

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

      const productData = {
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
        status: 'pending',
        has_variants: formData.hasVariants,
        options: formData.hasVariants && formData.options.length > 0
          ? formData.options.map(o => ({ name: o.name, values: o.values }))
          : null,
      }

      const { data: insertedProduct, error: productError } = await supabase
        .from('products')
        .insert([productData])
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

      if (!insertedProduct) {
        setError('Failed to create product. Please try again.')
        setIsSaving(false)
        return
      }

      const productId = insertedProduct.product_id

      if (formData.hasVariants && formData.variants.length > 0) {
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

        const variantRows = formData.variants.map(variant => {
          let variantUrls = variantImageUrls[variant.id]?.length > 0 ? variantImageUrls[variant.id] : null
          const imageForVariant = variantUrls ?? (imageUrls.length > 0 ? imageUrls : null)
          
          return {
            product_id: productId,
            option_values: variant.optionValues,
            sku: variant.sku || null,
            price: variant.price,
            stock: variant.stock,
            image: imageForVariant,
            active: variant.active,
          }
        })

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantRows)

        if (variantsError) {
          console.error('Error creating variants:', variantsError)
          setError('Product created but failed to save variants. Please try again.')
          setIsSaving(false)
          return
        }

        setShowSuccessScreen(true)
      } else {
        const singleVariant = {
          product_id: productId,
          option_values: {},
          sku: null,
          price: formData.sellingPrice,
          stock: formData.stockAmount,
          image: imageUrls.length > 0 ? imageUrls : null,
          active: true,
        }

        const { error: variantError } = await supabase
          .from('product_variants')
          .insert([singleVariant])

        if (variantError) {
          console.error('Error creating variant:', variantError)
          setError('Product created but failed to save variant. Please try again.')
          setIsSaving(false)
          return
        }

        setShowSuccessScreen(true)
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
                        placeholder="Search store name..."
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
                            filteredSuppliers.map(supplier => {
                              // Skip suppliers without shop_name_on_zambeel
                              if (!supplier.shop_name_on_zambeel) return null
                              
                              return (
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
                                  {supplier.shop_name_on_zambeel}
                                </div>
                              )
                            })
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
                  Material <span className="text-gray-500 text-xs font-normal">(Optional)</span>
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

              {/* 5. Product Variants Toggle */}
              <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Does this product have variants?
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Variants are different versions of the same product (e.g., different colors, sizes, or weights)
                </p>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, hasVariants: false, options: [], variants: [] }))}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                      !formData.hasVariants
                        ? 'bg-primary-blue text-white border-2 border-primary-blue'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, hasVariants: true }))
                      setIsVariantsSectionOpen(true)
                    }}
                    className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                      formData.hasVariants
                        ? 'bg-primary-blue text-white border-2 border-primary-blue'
                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Yes, this product has variants
                  </button>
                </div>
              </div>

              {/* 6. Simple Product Fields (when no variants) */}
              {!formData.hasVariants && (
                <>
                  {/* Product Selling Price */}
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
                        value={sellingPriceInput}
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

                  {/* Stock Available in Your Shop */}
                  <div className="mb-6">
                    <label htmlFor="mainStockAmount" className="block text-sm font-semibold text-gray-900 mb-2">
                      Stock Available in Your Shop <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="mainStockAmount"
                      name="stockAmount"
                      type="number"
                      min="0"
                      value={stockAmountInput}
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
                </>
              )}

              {/* 7. Product Media (images & videos) - only when product has NO variants */}
              {!formData.hasVariants && (
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Media (Images and Videos) <span className="text-red-500">*</span> (Max 5)
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Upload product images and/or short videos (e.g. unboxing, product demo)
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    {formData.images.map((file, index) => {
                      const isVideo = file.type.startsWith('video/')
                      return (
                      <div key={index} className="relative group">
                        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                          {isVideo ? (
                            <video
                              src={URL.createObjectURL(file)}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                            />
                          ) : (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Product media ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      )
                    })}
                    {formData.images.length < 5 && (
                      <label className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 transition-all">
                        <Upload className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-1 sm:mb-2" />
                        <span className="text-xs text-gray-600">Add Media</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
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
                    {formData.images.length} / 5 media files
                  </p>
                </div>
              </div>
              )}
              {formData.hasVariants && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-gray-700">
                    Add pictures for each variant in the variant details below. Main product images are not used when the product has variants.
                  </p>
                </div>
              )}

              {/* 8. Create variants (when hasVariants = true) */}
              {formData.hasVariants && (
                <div className="mb-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                  <div 
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer border-b border-gray-300"
                    onClick={() => setIsVariantsSectionOpen(!isVariantsSectionOpen)}
                  >
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Create variants</h3>
                    <button
                      type="button"
                      className="p-2 hover:bg-gray-200 rounded-lg transition-all"
                    >
                      {isVariantsSectionOpen ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>
                  </div>

                  {isVariantsSectionOpen && (
                    <div className="p-4 sm:p-6 space-y-6">
                      {/* Step 1: Define Options */}
                      <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Step 1: Define variant options (Max 3)</h4>
                        <p className="text-sm text-gray-600 mb-4">
                          Define up to 3 variant dimensions like Color, Size, Weight, Volume, etc.
                        </p>

                        {formData.options.map((option, optIndex) => (
                          <div key={option.id} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-sm font-semibold text-gray-900">
                                Variant option {optIndex + 1}
                              </label>
                              <button
                                type="button"
                                onClick={() => removeOption(option.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mb-3">
                              <label className="block text-xs font-medium text-gray-700 mb-2">Variant name</label>
                              <select
                                value={VARIANT_NAME_SUGGESTIONS.includes(option.name) ? option.name : (option.name ? 'Other' : '')}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === 'Other') updateOptionName(option.id, '')
                                  else updateOptionName(option.id, v)
                                }}
                                className={`w-full px-3 py-2 border-2 rounded-lg bg-white text-gray-900 ${
                                  errors[`option_name_${optIndex}`] ? 'border-red-500' : 'border-gray-200'
                                } focus:border-primary-blue focus:outline-none`}
                              >
                                <option value="">Select variant name</option>
                                {VARIANT_NAME_SUGGESTIONS.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                                <option value="Other">Other</option>
                              </select>
                              {!VARIANT_NAME_SUGGESTIONS.includes(option.name) && (
                                <input
                                  type="text"
                                  value={option.name}
                                  onChange={(e) => updateOptionName(option.id, e.target.value)}
                                  placeholder="Custom variant name"
                                  className="mt-2 w-full px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                />
                              )}
                              {errors[`option_name_${optIndex}`] && (
                                <span className="block text-xs text-red-500 mt-1">{errors[`option_name_${optIndex}`]}</span>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">Values</label>
                              {(() => {
                                const config = getVariantValueConfig(option.name)
                                if (config?.type === 'list' && config.options) {
                                  return (
                                    <div className="flex flex-wrap gap-2">
                                      {config.options.map(val => {
                                        const selected = option.values.includes(val)
                                        return (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() => {
                                              if (selected) removeOptionValue(option.id, val)
                                              else addOptionValue(option.id, val)
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                              selected ? 'bg-primary-blue text-white border-2 border-primary-blue' : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-primary-blue'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )
                                }
                                if (config?.type === 'colors' && config.options) {
                                  return (
                                    <div className="flex flex-wrap gap-2">
                                      {config.options.map(val => {
                                        const selected = option.values.includes(val)
                                        return (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() => {
                                              if (selected) removeOptionValue(option.id, val)
                                              else addOptionValue(option.id, val)
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                              selected ? 'bg-primary-blue text-white border-2 border-primary-blue' : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-primary-blue'
                                            }`}
                                          >
                                            {val}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )
                                }
                                if (config?.type === 'number' && config.unit) {
                                  return (
                                    <div className="flex gap-2 flex-wrap items-center">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          min="0"
                                          step="1"
                                          placeholder={`Number (${config.unit})`}
                                          value={numericValueByOptionId[option.id] ?? ''}
                                          onChange={(e) => setNumericValueByOptionId(prev => ({ ...prev, [option.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault()
                                              const v = (e.target as HTMLInputElement).value.trim()
                                              if (v !== '') {
                                                addOptionValue(option.id, v)
                                                setNumericValueByOptionId(prev => ({ ...prev, [option.id]: '' }))
                                              }
                                            }
                                          }}
                                          className="w-32 px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                        />
                                        <span className="text-sm text-gray-500">{config.unit}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const v = (numericValueByOptionId[option.id] ?? '').trim()
                                            if (v !== '') {
                                              addOptionValue(option.id, v)
                                              setNumericValueByOptionId(prev => ({ ...prev, [option.id]: '' }))
                                            }
                                          }}
                                          className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:opacity-90 transition-all"
                                        >
                                          Add
                                        </button>
                                      </div>
                                    </div>
                                  )
                                }
                                return (
                                  <div className="flex gap-2 mb-2">
                                    <input
                                      type="text"
                                      placeholder="e.g., Custom value"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          const input = e.currentTarget
                                          if (input.value.trim()) { addOptionValue(option.id, input.value.trim()); input.value = '' }
                                        }
                                      }}
                                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-900 focus:border-primary-blue focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                                        if (input?.value.trim()) { addOptionValue(option.id, input.value.trim()); input.value = '' }
                                      }}
                                      className="px-4 py-2 bg-primary-blue text-white rounded-lg hover:opacity-90 transition-all"
                                    >
                                      Add
                                    </button>
                                  </div>
                                )
                              })()}
                              <div className="space-y-2 mt-3">
                                {option.values.map(value => {
                                  const numConfig = getVariantValueConfig(option.name)
                                  const displayValue = numConfig?.type === 'number' && numConfig.unit
                                    ? `${value} ${numConfig.unit}`
                                    : value
                                  
                                  return (
                                    <div key={value} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                                        {displayValue}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeOptionValue(option.id, value)}
                                        className="ml-auto p-1 hover:bg-red-50 text-red-500 rounded-full transition-all"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                              {errors[`option_values_${optIndex}`] && (
                                <span className="block text-xs text-red-500 mt-1">{errors[`option_values_${optIndex}`]}</span>
                              )}
                            </div>
                          </div>
                        ))}

                        {formData.options.length < 3 && (
                          <button
                            type="button"
                            onClick={addOption}
                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-primary-blue font-medium hover:border-primary-blue hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Add Another Option
                          </button>
                        )}

                        {errors.options && (
                          <span className="block text-sm text-red-500 mt-2">{errors.options}</span>
                        )}
                      </div>

                      {/* Step 2: Variant details */}
                      {formData.variants.length > 0 && (
                        <div className="bg-white rounded-xl border-2 border-gray-200 p-4 sm:p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Step 2: Variant details ({formData.variants.length} / 50)
                            </h4>
                            {errors.variants && (
                              <span className="text-sm text-red-500">{errors.variants}</span>
                            )}
                          </div>

                          <div className="space-y-4">
                            {formData.variants.map((variant, index) => (
                              <div key={variant.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={variant.active}
                                      onChange={(e) => updateVariant(variant.id, 'active', e.target.checked)}
                                      className="w-5 h-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">
                                        {getVariantDisplayName(variant)}
                                      </div>
                                      {!variant.active && (
                                        <span className="text-xs text-gray-500">Inactive - will not be sold</span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeVariant(variant.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Price <span className="text-red-500">*</span>
                                    </label>
                                    <div className={`flex items-stretch rounded-lg overflow-hidden border-2 ${errors[`variant_price_${index}`] ? 'border-red-500' : 'border-gray-200'}`}>
                                      <div className="flex items-center justify-center px-2 py-2 bg-gray-100 border-r border-gray-200 text-xs font-semibold text-gray-700">
                                        {priceCurrency}
                                      </div>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={variant.price === 0 ? '' : variant.price}
                                        onChange={(e) => updateVariant(variant.id, 'price', e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                                        className="flex-1 min-w-0 px-3 py-2 border-0 bg-white text-gray-900 focus:outline-none"
                                        placeholder="0"
                                      />
                                    </div>
                                    {errors[`variant_price_${index}`] && (
                                      <span className="block text-xs text-red-500 mt-1">{errors[`variant_price_${index}`]}</span>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Stock <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={variant.stock === 0 ? '' : variant.stock}
                                      onChange={(e) => updateVariant(variant.id, 'stock', e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                                      className={`w-full px-3 py-2 border-2 rounded-lg bg-white text-gray-900 ${
                                        errors[`variant_stock_${index}`] ? 'border-red-500' : 'border-gray-200'
                                      } focus:border-primary-blue focus:outline-none`}
                                      placeholder="0"
                                    />
                                    {errors[`variant_stock_${index}`] && (
                                      <span className="block text-xs text-red-500 mt-1">{errors[`variant_stock_${index}`]}</span>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-2">
                                    Media (Images & Videos) <span className="text-red-500">*</span> <span className="text-gray-500">(Max 5)</span>
                                  </label>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {variant.images.map((file, imgIndex) => {
                                      const isVideo = file.type.startsWith('video/')
                                      return (
                                      <div key={imgIndex} className="relative group">
                                        <div className="w-16 h-16 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50">
                                          {isVideo ? (
                                            <video
                                              src={URL.createObjectURL(file)}
                                              className="w-full h-full object-cover"
                                              muted
                                              loop
                                              playsInline
                                            />
                                          ) : (
                                            <img
                                              src={URL.createObjectURL(file)}
                                              alt={`Variant media ${imgIndex + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeVariantImage(variant.id, imgIndex)}
                                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )})}
                                    {variant.images.length < 5 && (
                                      <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary-blue hover:bg-blue-50 transition-all">
                                        <Upload className="w-4 h-4 text-gray-400" />
                                        <input
                                          type="file"
                                          accept="image/*,video/*"
                                          multiple
                                          onChange={(e) => handleVariantImageChange(variant.id, e)}
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                  </div>
                                  {errors[`variant_images_${index}`] && (
                                    <span className="block text-xs text-red-500 mt-1">{errors[`variant_images_${index}`]}</span>
                                  )}
                                  <p className="text-xs text-gray-500 mt-1">
                                    {variant.images.length} / 5 media files
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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

