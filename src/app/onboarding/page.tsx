'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  User, 
  Store, 
  CreditCard, 
  MapPin, 
  Phone, 
  Building, 
  Landmark,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Briefcase,
  Tag,
  Globe,
  Home,
  Wallet,
  Mail
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { 
  COUNTRIES,
  ALL_COUNTRIES,
  getCitiesForCountry, 
  getBanksForCountry,
  getPhonePlaceholder,
  getPhoneHint,
  getIbanPlaceholder,
  getIbanHint,
  getIdNumberLabel,
  getIdNumberPlaceholder,
  getIdNumberHint
} from '@/lib/countryData'
import {
  formatIDNumber,
  formatPhoneNumber,
  formatIBAN,
  validateIDNumber,
  validatePhoneNumber,
  validateIBAN
} from '@/lib/formatters'

interface FormData {
  ownerName: string
  country: string
  cnic: string
  pickupAddress: string
  pickupCity: string
  customPickupCity: string
  phoneNumber: string
  whatsappPhoneNumber: string
  supplierType: string
  category: string
  shopNameOnZambeel: string
  stockLocationCountry: string
  returnAddress: string
  returnCity: string
  customReturnCity: string
  paymentMethod: string
  bankCountry: string
  bankTitle: string
  bankName: string
  customBank: string
  iban: string
  paypalEmail: string
  paypalAccountName: string
  exchangeName: string
  exchangeAccountName: string
  exchangeId: string
  exchangeCountry: string
  binanceWallet: string
  userPicture: File | null
  userPictureUrl?: string
}

interface Errors {
  [key: string]: string
}

// Supplier Type options
const SUPPLIER_TYPES = [
  'Trader',
  'Wholesaler',
  'Retailer',
  'Selling from Home'
] as const

// Category options
const CATEGORIES = [
  'Electronics',
  'Mobile Phones & Accessories',
  'Computers & IT Accessories',
  'Home Appliances',
  'Garments / Apparel',
  'Footwear',
  'Fashion Accessories',
  'Cosmetics & Beauty Products',
  'Personal Care & Hygiene',
  'Health & Wellness',
  'Baby Care Products',
  'Toys & Games',
  'Sports & Fitness Equipment',
  'Home & Kitchen',
  'Furniture',
  'Home Décor',
  'Grocery & Food Items',
  'Stationery & Office Supplies',
  'Books & Educational Material',
  'Automotive Parts & Accessories',
  'Tools & Hardware',
  'Jewellery & Watches',
  'Bags & Luggage',
  'Pet Supplies'
] as const

// Payment Method options
const PAYMENT_METHODS = [
  'Bank Account',
  'Paypal',
  'Crypto Payments'
] as const

// Crypto Exchange options
const CRYPTO_EXCHANGES = [
  'Binance',
  'OKX',
  'MEXC',
  'Crypto.com'
] as const

export default function SupplierOnboarding() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const isNavigatingRef = useRef(false)
  const isSubmittingRef = useRef(false)

  const [formData, setFormData] = useState<FormData>({
    ownerName: '',
    country: '',
    cnic: '',
    pickupAddress: '',
    pickupCity: '',
    customPickupCity: '',
    phoneNumber: '',
    whatsappPhoneNumber: '',
    supplierType: '',
    category: '',
    shopNameOnZambeel: '',
    stockLocationCountry: '',
    returnAddress: '',
    returnCity: '',
    customReturnCity: '',
    paymentMethod: '',
    bankCountry: '',
    bankTitle: '',
    bankName: '',
    customBank: '',
    iban: '',
    paypalEmail: '',
    paypalAccountName: '',
    exchangeName: '',
    exchangeAccountName: '',
    exchangeId: '',
    exchangeCountry: '',
    binanceWallet: '',
    userPicture: null,
  })

  const [errors, setErrors] = useState<Errors>({})
  const [useSameAsPhone, setUseSameAsPhone] = useState(false)
  const [useSameAsPickup, setUseSameAsPickup] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Memoized country-specific data
  const cities = useMemo(() => getCitiesForCountry(formData.country), [formData.country])
  const banks = useMemo(() => getBanksForCountry(formData.bankCountry), [formData.bankCountry])

  // Handle input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'bankName' && value !== 'Other' ? { customBank: '' } : {}),
      ...(name === 'pickupCity' && value !== 'Other' ? { customPickupCity: '' } : {}),
      ...(name === 'returnCity' && value !== 'Other' ? { customReturnCity: '' } : {}),
      // Sync return fields when checkbox is checked
      ...(useSameAsPickup && name === 'pickupAddress' ? { returnAddress: value } : {}),
      ...(useSameAsPickup && name === 'pickupCity' ? { returnCity: value, customReturnCity: value === 'Other' ? prev.customPickupCity : '' } : {}),
      ...(useSameAsPickup && name === 'customPickupCity' ? { customReturnCity: value } : {})
    }))
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    
    if (name === 'bankName' && errors.customBank) {
      setErrors(prev => ({ ...prev, customBank: '' }))
    }

    if (name === 'pickupCity' && errors.customPickupCity) {
      setErrors(prev => ({ ...prev, customPickupCity: '' }))
    }

    if (name === 'returnCity' && errors.customReturnCity) {
      setErrors(prev => ({ ...prev, customReturnCity: '' }))
    }

    if (useSameAsPickup) {
      if (name === 'pickupAddress' && errors.returnAddress) {
        setErrors(prev => ({ ...prev, returnAddress: '' }))
      }
      if (name === 'pickupCity' && errors.returnCity) {
        setErrors(prev => ({ ...prev, returnCity: '' }))
      }
      if (name === 'customPickupCity' && errors.customReturnCity) {
        setErrors(prev => ({ ...prev, customReturnCity: '' }))
      }
    }
  }, [errors, useSameAsPickup])

  // Handle ID number change with formatting
  const handleIDNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIDNumber(e.target.value, formData.country)
    setFormData(prev => ({ ...prev, cnic: formatted }))
    if (errors.cnic) setErrors(prev => ({ ...prev, cnic: '' }))
  }, [formData.country, errors.cnic])

  // Handle phone number change with formatting
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, formData.country)
    setFormData(prev => ({
      ...prev,
      phoneNumber: formatted,
      ...(useSameAsPhone ? { whatsappPhoneNumber: formatted } : {})
    }))
    if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }))
    if (useSameAsPhone && errors.whatsappPhoneNumber) {
      setErrors(prev => ({ ...prev, whatsappPhoneNumber: '' }))
    }
  }, [formData.country, errors.phoneNumber, useSameAsPhone, errors.whatsappPhoneNumber])

  // Handle WhatsApp phone number change with formatting
  const handleWhatsAppPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, formData.country)
    setFormData(prev => ({ ...prev, whatsappPhoneNumber: formatted }))
    if (errors.whatsappPhoneNumber) setErrors(prev => ({ ...prev, whatsappPhoneNumber: '' }))
  }, [formData.country, errors.whatsappPhoneNumber])

  // Handle "Same as phone number" checkbox change
  const handleUseSameAsPhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseSameAsPhone(checked)
    if (checked) {
      // Copy phone number to WhatsApp
      setFormData(prev => ({ ...prev, whatsappPhoneNumber: prev.phoneNumber }))
      if (errors.whatsappPhoneNumber) {
        setErrors(prev => ({ ...prev, whatsappPhoneNumber: '' }))
      }
    }
  }, [errors.whatsappPhoneNumber])

  // Handle "Same as pickup address" checkbox change
  const handleUseSameAsPickupChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setUseSameAsPickup(checked)
    if (checked) {
      // Copy pickup address and city to return
      setFormData(prev => ({
        ...prev,
        returnAddress: prev.pickupAddress,
        returnCity: prev.pickupCity,
        customReturnCity: prev.pickupCity === 'Other' ? prev.customPickupCity : ''
      }))
      if (errors.returnAddress) {
        setErrors(prev => ({ ...prev, returnAddress: '' }))
      }
      if (errors.returnCity) {
        setErrors(prev => ({ ...prev, returnCity: '' }))
      }
      if (errors.customReturnCity) {
        setErrors(prev => ({ ...prev, customReturnCity: '' }))
      }
    }
  }, [errors.returnAddress, errors.returnCity, errors.customReturnCity])

  // Handle IBAN change with formatting
  const handleIbanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIBAN(e.target.value, formData.bankCountry)
    setFormData(prev => ({ ...prev, iban: formatted }))
    if (errors.iban) setErrors(prev => ({ ...prev, iban: '' }))
  }, [formData.bankCountry, errors.iban])

  // Handle file change
  const handleFileChange = useCallback((field: 'userPicture', file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }, [errors])

  // Handle country change
  const handleCountryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value
    setFormData(prev => ({
      ...prev,
      country: newCountry,
      cnic: '',
      bankName: '',
      customBank: '',
    }))
    setErrors(prev => ({
      ...prev,
      country: '',
      bankName: '',
      customBank: ''
    }))
  }, [])

  // Validate current step
  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Errors = {}

    if (step === 1) {
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Full name is required'
      if (!formData.country.trim()) newErrors.country = 'Country is required'
      
      if (formData.country) {
        if (!formData.cnic.trim()) {
          newErrors.cnic = `${getIdNumberLabel(formData.country)} is required`
        } else if (!validateIDNumber(formData.cnic, formData.country)) {
          newErrors.cnic = `Invalid ${getIdNumberLabel(formData.country)} format`
        }
      }
      
      if (!formData.phoneNumber.trim()) {
        newErrors.phoneNumber = 'Phone number is required'
      } else if (formData.country && !validatePhoneNumber(formData.phoneNumber, formData.country)) {
        newErrors.phoneNumber = `Phone number must be in format ${getPhonePlaceholder(formData.country)}`
      }
      
      if (!formData.whatsappPhoneNumber.trim()) {
        newErrors.whatsappPhoneNumber = 'WhatsApp phone number is required'
      } else if (formData.country && !validatePhoneNumber(formData.whatsappPhoneNumber, formData.country)) {
        newErrors.whatsappPhoneNumber = `WhatsApp phone number must be in format ${getPhonePlaceholder(formData.country)}`
      }
      
      if (!formData.userPicture) newErrors.userPicture = 'NIC front picture is required'
    }

    if (step === 2) {
      if (!formData.supplierType.trim()) newErrors.supplierType = 'Supplier type is required'
      // Parse category - could be JSON array string or comma-separated
      let selectedCategories: string[] = []
      try {
        selectedCategories = formData.category ? JSON.parse(formData.category) : []
      } catch {
        selectedCategories = formData.category ? formData.category.split(',').map(s => s.trim()).filter(Boolean) : []
      }
      if (selectedCategories.length === 0) newErrors.category = 'Select at least one category'
      if (!formData.shopNameOnZambeel.trim()) newErrors.shopNameOnZambeel = 'Shop name on Zambeel is required'
      if (!formData.stockLocationCountry.trim()) newErrors.stockLocationCountry = 'Stock location country is required'
      if (!formData.pickupAddress.trim()) newErrors.pickupAddress = 'Pickup address is required'
      if (!formData.pickupCity.trim()) {
        newErrors.pickupCity = 'Pickup city is required'
      } else if (formData.pickupCity === 'Other' && !formData.customPickupCity.trim()) {
        newErrors.customPickupCity = 'Please enter pickup city name'
      }
      if (!formData.returnAddress.trim()) newErrors.returnAddress = 'Return address is required'
      if (!formData.returnCity.trim()) {
        newErrors.returnCity = 'Return city is required'
      } else if (formData.returnCity === 'Other' && !formData.customReturnCity.trim()) {
        newErrors.customReturnCity = 'Please enter return city name'
      }
    }

    if (step === 3) {
      // Payment method is now mandatory
      if (!formData.paymentMethod.trim()) {
        newErrors.paymentMethod = 'Payment method is required'
      } else {
        if (formData.paymentMethod === 'Bank Account') {
          if (!formData.bankCountry.trim()) {
            newErrors.bankCountry = 'Bank country is required'
          }
          if (!formData.bankTitle.trim()) {
            newErrors.bankTitle = 'Bank account title is required'
          }
          if (!formData.bankName.trim()) {
            newErrors.bankName = 'Bank name is required'
          } else if (formData.bankName === 'Other' && !formData.customBank.trim()) {
            newErrors.customBank = 'Please enter bank name'
          }
          
          if (!formData.iban.trim()) {
            newErrors.iban = 'IBAN number is required'
          } else if (formData.bankCountry && !validateIBAN(formData.iban, formData.bankCountry)) {
            newErrors.iban = `Invalid IBAN format. ${getIbanHint(formData.bankCountry)}`
          }
        } else if (formData.paymentMethod === 'Paypal') {
          if (!formData.paypalEmail.trim()) {
            newErrors.paypalEmail = 'PayPal email is required'
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.paypalEmail)) {
            newErrors.paypalEmail = 'Please enter a valid email address'
          }
          if (!formData.paypalAccountName.trim()) {
            newErrors.paypalAccountName = 'PayPal account name is required'
          }
        } else if (formData.paymentMethod === 'Crypto Payments') {
          if (!formData.exchangeName.trim()) {
            newErrors.exchangeName = 'Exchange name is required'
          }
          if (!formData.exchangeAccountName.trim()) {
            newErrors.exchangeAccountName = 'Account name on exchange is required'
          }
          if (!formData.exchangeId.trim()) {
            newErrors.exchangeId = 'Exchange ID is required'
          }
          if (!formData.exchangeCountry.trim()) {
            newErrors.exchangeCountry = 'Exchange account country is required'
          }
          if (!formData.binanceWallet.trim()) {
            newErrors.binanceWallet = 'Wallet address is required'
          }
        }
      }
    }

    if (step === 4) {
      if (!termsAccepted) {
        newErrors.termsAccepted = 'You must accept the terms and conditions to continue'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, termsAccepted])

  // Handle next step
  const handleNext = useCallback((e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (isNavigatingRef.current) return
    
    if (validateStep(currentStep)) {
      if (currentStep < 4) {
        isNavigatingRef.current = true
        setCurrentStep(prev => prev + 1)
        setTimeout(() => {
          isNavigatingRef.current = false
        }, 100)
      }
    }
  }, [currentStep, validateStep])

  // Handle previous step
  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  // Upload image helper
  const uploadImage = useCallback(async (file: File, userId: string, key: 'user' | 'store'): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${key}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { data, error } = await supabase.storage
        .from('user_media')
        .upload(path, file, { upsert: false })

      if (error) {
        console.error('Error uploading file:', error)
        setError('Failed to upload images. Please try again.')
        return null
      }

      const { data: publicUrlData } = supabase.storage.from('user_media').getPublicUrl(data.path)
      return publicUrlData?.publicUrl || null
    } catch (err) {
      console.error('Unexpected upload error:', err)
      setError('Failed to upload images. Please try again.')
      return null
    }
  }, [])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (currentStep !== 4 || isSubmittingRef.current) return
    if (!validateStep(4)) return

    const currentUserId = localStorage.getItem('userId')
    if (!currentUserId) {
      setError('User session not found. Please start from the login page.')
      setTimeout(() => router.push('/login'), 1000)
      return
    }

    isSubmittingRef.current = true
    setIsLoading(true)
    setError('')

    try {
      const userImageUrl = formData.userPicture
        ? await uploadImage(formData.userPicture, currentUserId, 'user')
        : null

      if (!userImageUrl) {
        isSubmittingRef.current = false
        setIsLoading(false)
        return
      }

      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.ownerName,
          country: formData.country,
          cnic: formData.cnic || null,
          pickup_address: formData.pickupAddress,
          pickup_city: formData.pickupCity === 'Other' ? formData.customPickupCity : formData.pickupCity,
          phone_number: formData.phoneNumber,
          whatsapp_phone_number: formData.whatsappPhoneNumber,
          supplier_type: formData.supplierType || null,
          category: formData.category || null,
          shop_name_on_zambeel: formData.shopNameOnZambeel || null,
          stock_location_country: formData.stockLocationCountry || null,
          return_address: formData.returnAddress || null,
          return_city: formData.returnCity === 'Other' ? formData.customReturnCity : formData.returnCity,
          payment_method: formData.paymentMethod || null,
          bank_country: formData.paymentMethod === 'Bank Account' ? (formData.bankCountry || null) : null,
          bank_title: formData.paymentMethod === 'Bank Account' ? (formData.bankTitle || null) : null,
          bank_name: formData.paymentMethod === 'Bank Account' ? (formData.bankName === 'Other' ? formData.customBank : (formData.bankName || null)) : null,
          iban: formData.paymentMethod === 'Bank Account' ? (formData.iban || null) : null,
          paypal_email: formData.paymentMethod === 'Paypal' ? (formData.paypalEmail || null) : null,
          paypal_account_name: formData.paymentMethod === 'Paypal' ? (formData.paypalAccountName || null) : null,
          exchange_name: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeName || null) : null,
          exchange_account_name: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeAccountName || null) : null,
          exchange_id: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeId || null) : null,
          exchange_country: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeCountry || null) : null,
          binance_wallet: formData.paymentMethod === 'Crypto Payments' ? (formData.binanceWallet || null) : null,
          user_picture_url: userImageUrl,
          onboarded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUserId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating user:', updateError)
        setError(updateError.message || 'Failed to save information. Please try again.')
        isSubmittingRef.current = false
        setIsLoading(false)
        return
      }

      if (data) {
        localStorage.setItem('supplierInfo', JSON.stringify(formData))
        localStorage.setItem('isOnboarded', 'true')
        setIsLoading(false)
        isSubmittingRef.current = false
        setIsSubmitted(true)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      isSubmittingRef.current = false
      setIsLoading(false)
    }
  }


  const progress = (currentStep / 4) * 100

  // Show success screen after submission
  if (isSubmitted) {
    return (
      <div className="flex min-h-screen w-full bg-gray-50 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 md:p-10 lg:p-12 text-center">
            {/* Success Icon */}
            <div className="flex justify-center mb-4 md:mb-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-[#4A9FF5]/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 md:w-16 md:h-16 text-[#4A9FF5]" />
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#4A9FF5] mb-3 md:mb-4">
              Application Submitted Successfully!
            </h1>

            {/* Confirmation Message */}
            <p className="text-sm sm:text-base md:text-lg text-gray-700 mb-6 md:mb-8 leading-relaxed px-2">
              Thank you for your interest in becoming a Zambeel supplier. We have received your application and our team will review it within 2-3 business days.
            </p>

            {/* What happens next? Section */}
            <div className="bg-[#4A9FF5]/10 border-2 border-[#4A9FF5]/30 rounded-xl p-6 mb-8 text-left">
              <h2 className="text-2xl font-bold text-[#4A9FF5] mb-4 text-center">
                What happens next?
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-[#4A9FF5] font-bold text-xl mt-0.5">•</span>
                  <span className="text-gray-700 text-base">
                    You will be added to dedicated WhatsApp Groups & Get Training Materials (1-2 working days)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#4A9FF5] font-bold text-xl mt-0.5">•</span>
                  <span className="text-gray-700 text-base">
                    Account Approval
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#4A9FF5] font-bold text-xl mt-0.5">•</span>
                  <span className="text-gray-700 text-base">
                    Begin Listing Your Products
                  </span>
                </li>
              </ul>
            </div>

            {/* Close Button */}
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-[#4A9FF5] bg-white border-2 border-[#4A9FF5] rounded-xl hover:bg-[#4A9FF5]/10 transition-colors"
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-gray-50">
      {/* Left Panel - Progress */}
      <div className="hidden lg:flex lg:flex-[0.9] bg-white p-6 lg:p-12 xl:p-16 flex-col justify-start relative border-r border-gray-200">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8 lg:mb-12 xl:mb-16">
            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
              <Package size={28} className="lg:w-8 lg:h-8" strokeWidth={2} />
            </div>
            <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 tracking-tight">Zambeel Supplier Portal</h1>
          </div>

          <div className="mb-6 lg:mb-8 xl:mb-10">
            <h2 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-2 lg:mb-3 tracking-tight">Complete Your Profile</h2>
            <p className="text-sm lg:text-base text-gray-600 mb-6 lg:mb-8 xl:mb-10 leading-relaxed">
              Help us set up your supplier account. This will only take a few minutes.
            </p>

            {/* Progress Steps */}
            <div className="flex flex-col gap-3 lg:gap-4 xl:gap-5 mb-6 lg:mb-8 xl:mb-10">
              {[
                {
                  step: 1,
                  icon: currentStep > 1 ? <CheckCircle size={24} /> : <User size={24} />,
                  title: 'Your Personal Information',
                  desc: 'Owner details and contact information'
                },
                {
                  step: 2,
                  icon: currentStep > 2 ? <CheckCircle size={24} /> : <Briefcase size={24} />,
                  title: 'Business Details',
                  desc: 'Business information and address'
                },
                {
                  step: 3,
                  icon: currentStep > 3 ? <CheckCircle size={24} /> : <Landmark size={24} />,
                  title: 'Banking Details',
                  desc: 'Payment details'
                },
                {
                  step: 4,
                  icon: currentStep > 4 ? <CheckCircle size={24} /> : <CheckCircle size={24} />,
                  title: 'Terms & Conditions',
                  desc: 'Review and accept terms'
                }
              ].map(({ step, icon, title, desc }) => (
                <div 
                  key={step}
                  className={`flex gap-3 lg:gap-4 items-start p-3 lg:p-4 xl:p-5 rounded-xl bg-gray-50 border-2 transition-all ${
                    currentStep >= step ? 'border-[#4A9FF5] bg-[#4A9FF5]/10' : 'border-gray-200'
                  } ${currentStep > step ? 'border-[#4A9FF5] bg-[#4A9FF5]/10' : ''}`}
                >
                  <div className={`w-10 h-10 lg:w-11 lg:h-11 xl:w-12 xl:h-12 min-w-[40px] lg:min-w-[44px] xl:min-w-[48px] rounded-xl flex items-center justify-center transition-all ${
                    currentStep > step ? 'bg-[#4A9FF5] text-white' :
                    currentStep === step ? 'bg-[#4A9FF5] text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {icon}
                  </div>
                  <div>
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-xs lg:text-sm text-gray-600 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="mb-6 lg:mb-8 xl:mb-10">
              <div className="w-full h-1.5 lg:h-2 bg-gray-200 rounded-full overflow-hidden mb-2 lg:mb-3">
                <div 
                  className="h-full bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs lg:text-sm text-gray-600 font-medium text-center">Step {currentStep} of 4</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="p-4 lg:p-5 xl:p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Why complete your profile?</h3>
            <ul className="space-y-1.5 lg:space-y-2">
              {[
                'Start listing products',
                'Receive payments directly to your account',
                'Get verified supplier badge',
                'Access to analytics dashboard'
              ].map((item, idx) => (
                <li key={idx} className="text-sm lg:text-[15px] text-gray-700 py-1 flex items-center gap-2">
                  <span className="text-[#4A9FF5]">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-[1.1] bg-white flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-12 xl:p-16 overflow-y-auto">
        <div className="w-full max-w-[560px] animate-slide-in-right">
          {/* Mobile Header - Only visible on mobile/tablet */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
                  <Package size={24} strokeWidth={2} />
                </div>
                <h1 className="text-lg font-bold text-gray-900 tracking-tight">Zambeel Supplier Portal</h1>
              </div>
            </div>
            <div className="mb-4">
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div 
                  className="h-full bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 font-medium text-center">Step {currentStep} of 4</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-xs md:text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
          <form 
            onSubmit={handleSubmit}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault()
              }
            }}
          >
            <div className="animate-fade-in">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">Your Personal Information</h2>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed">Tell us about yourself</p>
                  </div>

                  <div className="mb-4 md:mb-6">
                    <label htmlFor="ownerName" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Full Name <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <User size={18} className="md:w-5 md:h-5" />
                      </div>
                      <input
                        id="ownerName"
                        name="ownerName"
                        type="text"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.ownerName ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="e.g., Ahmed Khan"
                        value={formData.ownerName}
                        onChange={handleChange}
                      />
                    </div>
                    {errors.ownerName && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.ownerName}</span>
                    )}
                  </div>

                  {/* Country Dropdown */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="country" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Country <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <MapPin size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="country"
                        name="country"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.country ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.country}
                        onChange={handleCountryChange}
                      >
                        <option value="">Select Country</option>
                        {ALL_COUNTRIES.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                    {errors.country && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.country}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Where do you live?</p>
                  </div>

                  {/* ID Number - Simple input for all countries */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="cnic" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      National ID Number <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <CreditCard size={18} className="md:w-5 md:h-5" />
                      </div>
                      <input
                        id="cnic"
                        name="cnic"
                        type="text"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.cnic ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="Enter your National ID Number"
                        value={formData.cnic}
                        onChange={handleChange}
                      />
                    </div>
                    {errors.cnic && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.cnic}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Your government-issued ID number</p>
                  </div>

                  {/* Phone Number */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="phoneNumber" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Phone Number <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <Phone size={18} className="md:w-5 md:h-5" />
                      </div>
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.phoneNumber ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="+XX-XXX-XXXXXXX"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                      />
                    </div>
                    {errors.phoneNumber && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.phoneNumber}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Include country code (e.g., +92-300-1234567)</p>
                  </div>

                  {/* WhatsApp Phone Number */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="whatsappPhoneNumber" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      WhatsApp Phone Number <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <Phone size={18} className="md:w-5 md:h-5" />
                      </div>
                      <input
                        id="whatsappPhoneNumber"
                        name="whatsappPhoneNumber"
                        type="tel"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.whatsappPhoneNumber ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400 ${
                          useSameAsPhone ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="+XX-XXX-XXXXXXX"
                        value={formData.whatsappPhoneNumber}
                        onChange={handleChange}
                        disabled={useSameAsPhone}
                      />
                    </div>
                    {errors.whatsappPhoneNumber && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.whatsappPhoneNumber}</span>
                    )}
                    {/* Checkbox for "Same as phone number" */}
                    <div className="mt-3 flex items-center">
                      <input
                        type="checkbox"
                        id="useSameAsPhone"
                        checked={useSameAsPhone}
                        onChange={handleUseSameAsPhoneChange}
                        className="w-4 h-4 text-primary-blue bg-gray-100 border-gray-300 rounded focus:ring-primary-blue focus:ring-2 cursor-pointer"
                      />
                      <label htmlFor="useSameAsPhone" className="ml-2 text-sm text-gray-700 cursor-pointer">
                        Same as phone number
                      </label>
                    </div>
                  </div>

                  {/* Required Images */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-white">
                      <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                        NIC Front Picture <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange('userPicture', e.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                      {errors.userPicture && (
                        <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.userPicture}</span>
                      )}
                      {formData.userPicture && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Preview:</p>
                          <img
                            src={URL.createObjectURL(formData.userPicture)}
                            alt="User preview"
                            className="h-32 w-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Business Details */}
              {currentStep === 2 && (
                <div>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">Business Details</h2>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed">Tell us about your business</p>
                  </div>

                  {/* Supplier Type */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="supplierType" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Supplier Type <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <Briefcase size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="supplierType"
                        name="supplierType"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.supplierType ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.supplierType}
                        onChange={handleChange}
                      >
                        <option value="">Select Supplier Type</option>
                        {SUPPLIER_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    {errors.supplierType && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.supplierType}</span>
                    )}
                  </div>

                  {/* Category - Multi-select */}
                  <div className="mb-4 md:mb-6">
                    <label className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      <span className="flex items-center gap-2">
                        <Tag size={18} className="text-gray-500" />
                        Category <span className="text-red-500 ml-0.5">*</span>
                      </span>
                    </label>
                    <p className="text-[13px] text-gray-500 mb-3">Select all categories that apply to your business</p>
                    <div
                      className={`max-h-48 overflow-y-auto border-2 rounded-xl p-4 bg-white ${
                        errors.category ? 'border-red-500' : 'border-gray-200'
                      } focus-within:border-primary-blue focus-within:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CATEGORIES.map(cat => {
                          let selectedCategories: string[] = []
                          try {
                            selectedCategories = formData.category ? JSON.parse(formData.category) : []
                          } catch {
                            selectedCategories = formData.category ? formData.category.split(',').map(s => s.trim()).filter(Boolean) : []
                          }
                          const isChecked = selectedCategories.includes(cat)
                          return (
                            <label
                              key={cat}
                              className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  let selected: string[] = []
                                  try {
                                    selected = formData.category ? JSON.parse(formData.category) : []
                                  } catch {
                                    selected = formData.category ? formData.category.split(',').map(s => s.trim()).filter(Boolean) : []
                                  }
                                  const next = isChecked ? selected.filter(c => c !== cat) : [...selected, cat]
                                  setFormData(prev => ({ ...prev, category: JSON.stringify(next) }))
                                  if (errors.category) setErrors(prev => ({ ...prev, category: '' }))
                                }}
                                className="w-4 h-4 text-primary-blue rounded border-gray-300 focus:ring-primary-blue cursor-pointer"
                              />
                              <span className="text-sm text-gray-900">{cat}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    {errors.category && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.category}</span>
                    )}
                    {formData.category && (() => {
                      try {
                        const selected = JSON.parse(formData.category)
                        return selected.length > 0 ? (
                          <p className="text-[13px] text-gray-500 mt-1.5">
                            Selected ({selected.length}): {selected.join(', ')}
                          </p>
                        ) : null
                      } catch {
                        return null
                      }
                    })()}
                  </div>

                  {/* Shop Name on Zambeel */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="shopNameOnZambeel" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Shop Name on Zambeel <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <Store size={18} className="md:w-5 md:h-5" />
                      </div>
                      <input
                        id="shopNameOnZambeel"
                        name="shopNameOnZambeel"
                        type="text"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.shopNameOnZambeel ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="e.g., Khan Electronics Store"
                        value={formData.shopNameOnZambeel}
                        onChange={handleChange}
                      />
                    </div>
                    {errors.shopNameOnZambeel && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.shopNameOnZambeel}</span>
                    )}
                  </div>

                  {/* Where Do you have Stock */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="stockLocationCountry" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Where Do you have Stock <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <Globe size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="stockLocationCountry"
                        name="stockLocationCountry"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.stockLocationCountry ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.stockLocationCountry}
                        onChange={handleChange}
                      >
                        <option value="">Select Country</option>
                        {COUNTRIES.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                    </div>
                    {errors.stockLocationCountry && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.stockLocationCountry}</span>
                    )}
                  </div>

                  {/* Pickup Address */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="pickupAddress" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Pickup Address <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <MapPin size={18} className="md:w-5 md:h-5" />
                      </div>
                      <textarea
                        id="pickupAddress"
                        name="pickupAddress"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all resize-y min-h-[80px] leading-relaxed ${
                          errors.pickupAddress ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="e.g., Shop 123, Main Market, F-10 Markaz"
                        value={formData.pickupAddress}
                        onChange={handleChange}
                        rows={3}
                      />
                    </div>
                    {errors.pickupAddress && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.pickupAddress}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Full business address for product pickup</p>
                  </div>

                  {/* Pickup City */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="pickupCity" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Pickup City <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <Building size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="pickupCity"
                        name="pickupCity"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.pickupCity ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.pickupCity}
                        onChange={handleChange}
                        disabled={!formData.stockLocationCountry}
                      >
                        <option value="">{formData.stockLocationCountry ? 'Select City' : 'Select Stock Location Country First'}</option>
                        {getCitiesForCountry(formData.stockLocationCountry).map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    {errors.pickupCity && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.pickupCity}</span>
                    )}
                  </div>

                  {/* Custom Pickup City Input - Shows when "Other" is selected */}
                  {formData.pickupCity === 'Other' && (
                    <div className="mb-4 md:mb-6">
                      <label htmlFor="customPickupCity" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                        Pickup City Name <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="relative flex items-start">
                        <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                          <Building size={18} className="md:w-5 md:h-5" />
                        </div>
                        <input
                          id="customPickupCity"
                          name="customPickupCity"
                          type="text"
                          className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                            errors.customPickupCity ? 'border-red-500' : 'border-gray-200'
                          } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                          placeholder="Enter pickup city name"
                          value={formData.customPickupCity}
                          onChange={handleChange}
                        />
                      </div>
                      {errors.customPickupCity && (
                        <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.customPickupCity}</span>
                      )}
                    </div>
                  )}

                  {/* Return Address */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="returnAddress" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Return Address <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                        <Home size={18} className="md:w-5 md:h-5" />
                      </div>
                      <textarea
                        id="returnAddress"
                        name="returnAddress"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all resize-y min-h-[80px] leading-relaxed ${
                          errors.returnAddress ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400 ${
                          useSameAsPickup ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                        placeholder="e.g., Shop 123, Main Market, F-10 Markaz"
                        value={formData.returnAddress}
                        onChange={handleChange}
                        rows={3}
                        disabled={useSameAsPickup}
                      />
                    </div>
                    {errors.returnAddress && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.returnAddress}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Address for product returns</p>
                    {/* Checkbox for "Same as pickup address" */}
                    <div className="mt-3 flex items-center">
                      <input
                        type="checkbox"
                        id="useSameAsPickup"
                        checked={useSameAsPickup}
                        onChange={handleUseSameAsPickupChange}
                        className="w-4 h-4 text-primary-blue bg-gray-100 border-gray-300 rounded focus:ring-primary-blue focus:ring-2 cursor-pointer"
                      />
                      <label htmlFor="useSameAsPickup" className="ml-2 text-sm text-gray-700 cursor-pointer">
                        Same as pickup address and city
                      </label>
                    </div>
                  </div>

                  {/* Return City */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="returnCity" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Return City <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <Building size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="returnCity"
                        name="returnCity"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.returnCity ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none ${
                          useSameAsPickup ? 'bg-gray-50 cursor-not-allowed' : ''
                        }`}
                        value={formData.returnCity}
                        onChange={handleChange}
                        disabled={!formData.stockLocationCountry || useSameAsPickup}
                      >
                        <option value="">{formData.stockLocationCountry ? 'Select City' : 'Select Stock Location Country First'}</option>
                        {getCitiesForCountry(formData.stockLocationCountry).map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    {errors.returnCity && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.returnCity}</span>
                    )}
                  </div>

                  {/* Custom Return City Input - Shows when "Other" is selected */}
                  {formData.returnCity === 'Other' && (
                    <div className="mb-4 md:mb-6">
                      <label htmlFor="customReturnCity" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                        Return City Name <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <div className="relative flex items-start">
                        <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                          <Building size={18} className="md:w-5 md:h-5" />
                        </div>
                        <input
                          id="customReturnCity"
                          name="customReturnCity"
                          type="text"
                          className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                            errors.customReturnCity ? 'border-red-500' : 'border-gray-200'
                          } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400 ${
                            useSameAsPickup ? 'bg-gray-50 cursor-not-allowed' : ''
                          }`}
                          placeholder="Enter return city name"
                          value={formData.customReturnCity}
                          onChange={handleChange}
                          disabled={useSameAsPickup}
                        />
                      </div>
                      {errors.customReturnCity && (
                        <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.customReturnCity}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Banking Information */}
              {currentStep === 3 && (
                <div>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 tracking-tight">Banking Information</h2>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed">For receiving payments</p>
                  </div>

                  {/* Payment Method */}
                  <div className="mb-4 md:mb-6">
                    <label htmlFor="paymentMethod" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                      Payment Method <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                        <Wallet size={18} className="md:w-5 md:h-5" />
                      </div>
                      <select
                        id="paymentMethod"
                        name="paymentMethod"
                        className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.paymentMethod ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.paymentMethod}
                        onChange={handleChange}
                      >
                        <option value="">Select Payment Method</option>
                        {PAYMENT_METHODS.map(method => (
                          <option key={method} value={method}>{method}</option>
                        ))}
                      </select>
                    </div>
                    {errors.paymentMethod && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.paymentMethod}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Choose how you want to receive payments</p>
                  </div>

                  {/* Bank Account Fields - Show when Bank Account is selected */}
                  {formData.paymentMethod === 'Bank Account' && (
                    <>
                      {/* Bank Country */}
                      <div className="mb-4 md:mb-6">
                        <label htmlFor="bankCountry" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Bank Country <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                            <Globe size={18} className="md:w-5 md:h-5" />
                          </div>
                          <select
                            id="bankCountry"
                            name="bankCountry"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.bankCountry ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            value={formData.bankCountry}
                            onChange={handleChange}
                      >
                        <option value="">Select bank country</option>
                        {ALL_COUNTRIES.map(country => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                        </div>
                        {errors.bankCountry && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.bankCountry}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Select the country where your bank account is located</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="bankTitle" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Bank Account Title <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <User size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="bankTitle"
                            name="bankTitle"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.bankTitle ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., Ahmed Khan"
                            value={formData.bankTitle}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.bankTitle && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.bankTitle}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Name on the bank account</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="bankName" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Bank Name <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                            <Landmark size={18} className="md:w-5 md:h-5" />
                          </div>
                          <select
                            id="bankName"
                            name="bankName"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.bankName ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            value={formData.bankName}
                            onChange={handleChange}
                            disabled={!formData.country}
                          >
                            <option value="">{formData.country ? 'Select Bank' : 'Select Country First'}</option>
                            {banks.map(bank => (
                              <option key={bank} value={bank}>{bank}</option>
                            ))}
                          </select>
                        </div>
                        {errors.bankName && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.bankName}</span>
                        )}
                      </div>

                      {/* Custom Bank Input - Shows when "Other" is selected */}
                      {formData.bankName === 'Other' && (
                        <div className="mb-4 md:mb-6">
                          <label htmlFor="customBank" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                            Bank Name <span className="text-red-500 ml-0.5">*</span>
                          </label>
                          <div className="relative flex items-start">
                            <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                              <Landmark size={18} className="md:w-5 md:h-5" />
                            </div>
                            <input
                              id="customBank"
                              name="customBank"
                              type="text"
                              className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                                errors.customBank ? 'border-red-500' : 'border-gray-200'
                              } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                              placeholder="Enter bank name"
                              value={formData.customBank}
                              onChange={handleChange}
                            />
                          </div>
                          {errors.customBank && (
                            <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.customBank}</span>
                          )}
                        </div>
                      )}

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="iban" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          IBAN / Account Number <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <CreditCard size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="iban"
                            name="iban"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.iban ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="Enter your IBAN or Account Number"
                            value={formData.iban}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.iban && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.iban}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">
                          International Bank Account Number or local account number
                        </p>
                      </div>
                    </>
                  )}

                  {/* PayPal Fields - Show when Paypal is selected */}
                  {formData.paymentMethod === 'Paypal' && (
                    <>
                      <div className="mb-4 md:mb-6">
                        <label htmlFor="paypalEmail" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          PayPal Email <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <Mail size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="paypalEmail"
                            name="paypalEmail"
                            type="email"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.paypalEmail ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., your.email@example.com"
                            value={formData.paypalEmail}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.paypalEmail && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.paypalEmail}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Enter your PayPal account email address</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="paypalAccountName" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          PayPal Account Name <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <User size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="paypalAccountName"
                            name="paypalAccountName"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.paypalAccountName ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., Ahmed Khan"
                            value={formData.paypalAccountName}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.paypalAccountName && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.paypalAccountName}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Name registered on your PayPal account</p>
                      </div>
                    </>
                  )}

                  {/* Crypto Payments Fields - Show when Crypto Payments is selected */}
                  {formData.paymentMethod === 'Crypto Payments' && (
                    <>
                      <div className="mb-4 md:mb-6">
                        <label htmlFor="exchangeName" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Exchange Name <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                            <Building size={18} className="md:w-5 md:h-5" />
                          </div>
                          <select
                            id="exchangeName"
                            name="exchangeName"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.exchangeName ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            value={formData.exchangeName}
                            onChange={handleChange}
                          >
                            <option value="">Select exchange</option>
                            {CRYPTO_EXCHANGES.map(exchange => (
                              <option key={exchange} value={exchange}>{exchange}</option>
                            ))}
                          </select>
                        </div>
                        {errors.exchangeName && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.exchangeName}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Select the crypto exchange you use</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="exchangeAccountName" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Account Name on Exchange <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <User size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="exchangeAccountName"
                            name="exchangeAccountName"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.exchangeAccountName ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., Ahmed Khan"
                            value={formData.exchangeAccountName}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.exchangeAccountName && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.exchangeAccountName}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Your registered name on the exchange</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="exchangeId" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Exchange ID <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <Wallet size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="exchangeId"
                            name="exchangeId"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.exchangeId ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., user@123456 or wallet address"
                            value={formData.exchangeId}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.exchangeId && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.exchangeId}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Your exchange user ID or wallet address</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="exchangeCountry" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Exchange Account Country <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-center">
                          <div className="absolute right-10 md:right-11 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
                            <Globe size={18} className="md:w-5 md:h-5" />
                          </div>
                          <select
                            id="exchangeCountry"
                            name="exchangeCountry"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pr-16 md:pr-[4.5rem] text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.exchangeCountry ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                            value={formData.exchangeCountry}
                            onChange={handleChange}
                          >
                            <option value="">Select country</option>
                            {ALL_COUNTRIES.map(country => (
                              <option key={country} value={country}>{country}</option>
                            ))}
                          </select>
                        </div>
                        {errors.exchangeCountry && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.exchangeCountry}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Country where your exchange account is registered</p>
                      </div>

                      <div className="mb-4 md:mb-6">
                        <label htmlFor="binanceWallet" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                          Wallet Address <span className="text-red-500 ml-0.5">*</span>
                        </label>
                        <div className="relative flex items-start">
                          <div className="absolute left-3 md:left-4 top-3 md:top-3.5 text-gray-400 pointer-events-none z-10">
                            <Wallet size={18} className="md:w-5 md:h-5" />
                          </div>
                          <input
                            id="binanceWallet"
                            name="binanceWallet"
                            type="text"
                            className={`w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                              errors.binanceWallet ? 'border-red-500' : 'border-gray-200'
                            } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                            placeholder="e.g., 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                            value={formData.binanceWallet}
                            onChange={handleChange}
                          />
                        </div>
                        {errors.binanceWallet && (
                          <span className="block text-xs md:text-[13px] text-red-500 mt-1.5 font-medium">{errors.binanceWallet}</span>
                        )}
                        <p className="text-[13px] text-gray-500 mt-1.5">Your crypto wallet address for receiving payments</p>
                      </div>
                    </>
                  )}

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mt-6">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      💡 <strong>Note:</strong> Select your preferred payment method and complete the required information.
                      You can update this later in your profile settings.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Terms & Conditions */}
              {currentStep === 4 && (
                <div>
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2"></h2>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#4A9FF5] mb-2 tracking-tight text-center">Terms & Conditions</h2>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed text-center">
                      Please read and accept the following terms and conditions to proceed with your supplier application.
                    </p>
                  </div>

                  <div className="mb-6 md:mb-8">
                    <h3 className="text-xl md:text-2xl font-bold text-[#4A9FF5] mb-3">Final Agreement</h3>
                    <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
                      By proceeding, you acknowledge and agree to the following terms:
                    </p>

                    <div className="space-y-3 md:space-y-4">
                      {/* Term 1: Claims and Disputes */}
                      <div className="border-2 border-[#4A9FF5]/30 rounded-xl p-4 md:p-5 bg-white">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-[#4A9FF5] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-bold text-[#4A9FF5] mb-2">Claims and Disputes:</h4>
                            <p className="text-sm md:text-base text-gray-900">
                              I acknowledge that in case of Claims and Disputes, I will follow all defined SOPs, and in case of non-compliance Zambeel will not be responsible to cater to those cases.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Term 2: Payment Terms */}
                      <div className="border-2 border-[#4A9FF5]/30 rounded-xl p-4 md:p-5 bg-white">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-[#4A9FF5] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-bold text-[#4A9FF5] mb-2">Payment Terms:</h4>
                            <p className="text-sm md:text-base text-gray-900">
                              I acknowledge and agree to the standard payment terms and timelines shared by the company.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Term 3: Information Accuracy */}
                      <div className="border-2 border-[#4A9FF5]/30 rounded-xl p-4 md:p-5 bg-white">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-[#4A9FF5] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-bold text-[#4A9FF5] mb-2">Information Accuracy:</h4>
                            <p className="text-sm md:text-base text-gray-900">
                              I confirm that all information provided by me is valid, accurate, and honest to the best of my knowledge.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Term 4: Dispatch and Return Guidelines */}
                      <div className="border-2 border-[#4A9FF5]/30 rounded-xl p-4 md:p-5 bg-white">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-[#4A9FF5] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-bold text-[#4A9FF5] mb-2">Dispatch and Return Guidelines:</h4>
                            <p className="text-sm md:text-base text-gray-900">
                              I will follow all the dispatch and return SLAs, otherwise company will not be liable to compensate me or can charge penalty on breach of SLA.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Term 5: Probation Period */}
                      <div className="border-2 border-[#4A9FF5]/30 rounded-xl p-4 md:p-5 bg-white">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="w-5 h-5 md:w-6 md:h-6 bg-[#4A9FF5] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-bold text-[#4A9FF5] mb-2">Probation Period:</h4>
                            <p className="text-sm md:text-base text-gray-900">
                              I acknowledge and agree to abide by the probation period terms as communicated.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Terms Acceptance Checkbox */}
                  <div className="mb-4 md:mb-6">
                    <div className="flex items-start gap-2 md:gap-3">
                      <input
                        type="checkbox"
                        id="termsAccepted"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked)
                          if (errors.termsAccepted) {
                            setErrors(prev => ({ ...prev, termsAccepted: '' }))
                          }
                        }}
                        className="w-4 h-4 md:w-5 md:h-5 mt-1 text-[#4A9FF5] bg-gray-100 border-gray-300 rounded focus:ring-[#4A9FF5] focus:ring-2 cursor-pointer"
                      />
                      <label htmlFor="termsAccepted" className="text-sm md:text-base text-gray-700 cursor-pointer">
                        I have read and accept all the terms and conditions stated above
                      </label>
                    </div>
                    {errors.termsAccepted && (
                      <span className="block text-xs md:text-[13px] text-red-500 mt-2 font-medium">{errors.termsAccepted}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6 md:mt-8">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="flex-1 py-3 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-2 transition-all hover:border-primary-blue hover:bg-primary-blue/5 disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={handlePrevious}
                  disabled={isLoading}
                >
                  <ArrowLeft size={18} className="md:w-5 md:h-5" />
                  <span>Previous</span>
                </button>
              )}

              {currentStep < 4 ? (
                <button
                  type="button"
                  className={`flex-1 py-3 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-white bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(74,159,245,0.4)] transition-all ${
                    isNavigatingRef.current ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] active:translate-y-0'
                  }`}
                  onClick={handleNext}
                  disabled={isNavigatingRef.current}
                >
                  <span>Next</span>
                  <ArrowRight size={18} className="md:w-5 md:h-5" />
                </button>
              ) : (
                <button
                  type="submit"
                  className={`flex-1 py-3 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-white ${
                    currentStep === 4 
                      ? 'bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] shadow-[0_4px_14px_rgba(74,159,245,0.4)] hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] hover:-translate-y-0.5'
                      : 'bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] shadow-[0_4px_14px_rgba(74,159,245,0.4)]'
                  } rounded-xl flex items-center justify-center gap-2 transition-all ${
                    isLoading || (currentStep === 4 && !termsAccepted) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  disabled={isLoading || (currentStep === 4 && !termsAccepted)}
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-[3px] border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Completing...</span>
                    </>
                  ) : currentStep === 4 ? (
                    <>
                      <span>Accept & Continue</span>
                      <CheckCircle size={18} className="md:w-5 md:h-5" />
                    </>
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <CheckCircle size={18} className="md:w-5 md:h-5" />
                    </>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
