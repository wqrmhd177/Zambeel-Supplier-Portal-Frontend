'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  User,
  Mail,
  Lock,
  Store,
  CreditCard,
  MapPin,
  Phone,
  Building,
  Landmark,
  Loader2,
  Briefcase,
  Tag,
  Globe,
  Home,
  Wallet,
  CheckCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { getPurchaserIntegerId, getPurchaserCountry } from '@/lib/supplierHelpers'
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
  getCurrencyForCountry,
} from '@/lib/countryData'
import {
  formatIDNumber,
  formatPhoneNumber,
  formatIBAN,
  validateIDNumber,
  validatePhoneNumber,
  validateIBAN,
} from '@/lib/formatters'

// Same options as onboarding
const SUPPLIER_TYPES = ['Trader', 'Wholesaler', 'Retailer', 'Selling from Home'] as const
const CATEGORIES = [
  'Electronics', 'Mobile Phones & Accessories', 'Computers & IT Accessories', 'Home Appliances', 'Garments / Apparel',
  'Footwear', 'Fashion Accessories', 'Cosmetics & Beauty Products', 'Personal Care & Hygiene', 'Health & Wellness',
  'Baby Care Products', 'Toys & Games', 'Sports & Fitness Equipment', 'Home & Kitchen', 'Furniture', 'Home Décor',
  'Grocery & Food Items', 'Stationery & Office Supplies', 'Books & Educational Material', 'Automotive Parts & Accessories',
  'Tools & Hardware', 'Jewellery & Watches', 'Bags & Luggage', 'Pet Supplies',
] as const
const PAYMENT_METHODS = ['Bank Account', 'Paypal', 'Crypto Payments'] as const
const CRYPTO_EXCHANGES = ['Binance', 'OKX', 'MEXC', 'Crypto.com'] as const

interface SupplierFormData {
  email: string
  password: string
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
}

const initialFormData: SupplierFormData = {
  email: '',
  password: '',
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
}

function isSupportedCountry(country: string) {
  return (COUNTRIES as readonly string[]).includes(country)
}

export default function CreateSupplierPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [currentStep, setCurrentStep] = useState(1)
  const [useSameAsPhone, setUseSameAsPhone] = useState(false)
  const [useSameAsPickup, setUseSameAsPickup] = useState(false)

  // Load purchaser country when user is purchaser (auto-fill country and stock location)
  const isCountryLocked = userRole === 'purchaser'
  useEffect(() => {
    if (authLoading || !isAuthenticated || userRole !== 'purchaser' || !userId) return
    getPurchaserCountry(userId).then((result) => {
      if (result) {
        setFormData(prev => ({
          ...prev,
          country: result.country,
          stockLocationCountry: result.stockLocationCountry,
        }))
      }
    })
  }, [authLoading, isAuthenticated, userRole, userId])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    if (!authLoading && isAuthenticated && userRole !== 'purchaser' && userRole !== 'admin') {
      router.push('/dashboard')
      return
    }
  }, [isAuthenticated, authLoading, userRole, router])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'bankCountry' ? { bankName: '', customBank: '', iban: '' } : {}),
      ...(name === 'bankName' && value !== 'Other' ? { customBank: '' } : {}),
      ...(name === 'pickupCity' && value !== 'Other' ? { customPickupCity: '' } : {}),
      ...(name === 'returnCity' && value !== 'Other' ? { customReturnCity: '' } : {}),
      ...(useSameAsPickup && name === 'pickupAddress' ? { returnAddress: value } : {}),
      ...(useSameAsPickup && name === 'pickupCity' ? { returnCity: value, customReturnCity: value === 'Other' ? formData.customPickupCity : '' } : {}),
      ...(useSameAsPickup && name === 'customPickupCity' ? { customReturnCity: value } : {}),
    }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }, [errors, useSameAsPickup, formData.customPickupCity])

  const handleCountryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCountry = e.target.value
    setFormData(prev => ({ ...prev, country: newCountry, cnic: '' }))
    setErrors(prev => ({ ...prev, country: '' }))
  }, [])

  const handleIDNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIDNumber(e.target.value, formData.country)
    setFormData(prev => ({ ...prev, cnic: formatted }))
    if (errors.cnic) setErrors(prev => ({ ...prev, cnic: '' }))
  }, [formData.country, errors.cnic])

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, formData.country)
    setFormData(prev => ({
      ...prev,
      phoneNumber: formatted,
      ...(useSameAsPhone ? { whatsappPhoneNumber: formatted } : {}),
    }))
    if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }))
    if (useSameAsPhone && errors.whatsappPhoneNumber) setErrors(prev => ({ ...prev, whatsappPhoneNumber: '' }))
  }, [formData.country, errors.phoneNumber, useSameAsPhone, errors.whatsappPhoneNumber])

  const handleWhatsAppChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, formData.country)
    setFormData(prev => ({ ...prev, whatsappPhoneNumber: formatted }))
    if (errors.whatsappPhoneNumber) setErrors(prev => ({ ...prev, whatsappPhoneNumber: '' }))
  }, [formData.country, errors.whatsappPhoneNumber])

  const handleIbanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIBAN(e.target.value, formData.bankCountry)
    setFormData(prev => ({ ...prev, iban: formatted }))
    if (errors.iban) setErrors(prev => ({ ...prev, iban: '' }))
  }, [formData.bankCountry, errors.iban])

  const cities = useMemo(() => getCitiesForCountry(formData.stockLocationCountry), [formData.stockLocationCountry])
  const banks = useMemo(() => getBanksForCountry(formData.bankCountry), [formData.bankCountry])

  function validateStep(step: number): boolean {
    const newErrors: { [key: string]: string } = {}

    if (step === 1) {
      if (!formData.email.trim()) newErrors.email = 'Email is required'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email'
      if (!formData.password.trim()) newErrors.password = 'Password is required'
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Full name is required'
      if (!formData.country.trim()) newErrors.country = 'Country is required'
      if (formData.country) {
        if (!formData.cnic.trim()) newErrors.cnic = isSupportedCountry(formData.country) ? `${getIdNumberLabel(formData.country)} is required` : 'National ID is required'
        else if (isSupportedCountry(formData.country) && !validateIDNumber(formData.cnic, formData.country)) newErrors.cnic = `Invalid ${getIdNumberLabel(formData.country)} format`
      }
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required'
      else if (formData.country && isSupportedCountry(formData.country) && !validatePhoneNumber(formData.phoneNumber, formData.country)) newErrors.phoneNumber = `Use format ${getPhonePlaceholder(formData.country)}`
      if (!formData.whatsappPhoneNumber.trim()) newErrors.whatsappPhoneNumber = 'WhatsApp number is required'
      else if (formData.country && isSupportedCountry(formData.country) && !validatePhoneNumber(formData.whatsappPhoneNumber, formData.country)) newErrors.whatsappPhoneNumber = `Use format ${getPhonePlaceholder(formData.country)}`
    }

    if (step === 2) {
      if (!formData.supplierType.trim()) newErrors.supplierType = 'Supplier type is required'
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
      if (!formData.pickupCity.trim()) newErrors.pickupCity = 'Pickup city is required'
      else if (formData.pickupCity === 'Other' && !formData.customPickupCity.trim()) newErrors.customPickupCity = 'Enter pickup city name'
      if (!formData.returnAddress.trim()) newErrors.returnAddress = 'Return address is required'
      if (!formData.returnCity.trim()) newErrors.returnCity = 'Return city is required'
      else if (formData.returnCity === 'Other' && !formData.customReturnCity.trim()) newErrors.customReturnCity = 'Enter return city name'
    }

    if (step === 3) {
      if (!formData.paymentMethod.trim()) newErrors.paymentMethod = 'Payment method is required'
      else if (formData.paymentMethod === 'Bank Account') {
        if (!formData.bankCountry.trim()) newErrors.bankCountry = 'Bank country is required'
        if (!formData.bankTitle.trim()) newErrors.bankTitle = 'Bank account title is required'
        if (!formData.bankName.trim()) newErrors.bankName = 'Bank name is required'
        else if (formData.bankName === 'Other' && !formData.customBank.trim()) newErrors.customBank = 'Enter bank name'
        if (!formData.iban.trim()) newErrors.iban = 'IBAN is required'
        else if (formData.bankCountry && isSupportedCountry(formData.bankCountry) && !validateIBAN(formData.iban, formData.bankCountry)) newErrors.iban = `Invalid IBAN. ${getIbanHint(formData.bankCountry)}`
      } else if (formData.paymentMethod === 'Paypal') {
        if (!formData.paypalEmail.trim()) newErrors.paypalEmail = 'PayPal email is required'
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.paypalEmail)) newErrors.paypalEmail = 'Valid email required'
        if (!formData.paypalAccountName.trim()) newErrors.paypalAccountName = 'PayPal account name is required'
      } else if (formData.paymentMethod === 'Crypto Payments') {
        if (!formData.exchangeName.trim()) newErrors.exchangeName = 'Exchange name is required'
        if (!formData.exchangeAccountName.trim()) newErrors.exchangeAccountName = 'Account name on exchange is required'
        if (!formData.exchangeId.trim()) newErrors.exchangeId = 'Exchange ID is required'
        if (!formData.exchangeCountry.trim()) newErrors.exchangeCountry = 'Exchange account country is required'
        if (!formData.binanceWallet.trim()) newErrors.binanceWallet = 'Wallet address is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault()
    if (validateStep(currentStep) && currentStep < 3) setCurrentStep(prev => prev + 1)
  }

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (currentStep !== 3 || !validateStep(3)) {
      setError('Please complete all steps and fix any errors.')
      return
    }

    if (!userId) {
      setError('User not authenticated. Please log in again.')
      router.push('/login')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email)
        .single()

      if (existingUser) {
        setError('An account with this email already exists')
        setIsSaving(false)
        return
      }

      let purchaserIntId: number | null = null
      if (userRole !== 'admin' && userId) {
        purchaserIntId = await getPurchaserIntegerId(userId)
        if (!purchaserIntId) {
          setError('Unable to get purchaser ID. Please try again.')
          setIsSaving(false)
          return
        }
      }

      const pickupCityVal = formData.pickupCity === 'Other' ? formData.customPickupCity : formData.pickupCity
      const returnCityVal = formData.returnCity === 'Other' ? formData.customReturnCity : formData.returnCity
      const bankNameVal = formData.paymentMethod === 'Bank Account'
        ? (formData.bankName === 'Other' ? formData.customBank : formData.bankName)
        : null
      const userCurrency = getCurrencyForCountry(formData.stockLocationCountry || formData.country || '')

      const insertRow: Record<string, unknown> = {
        email: formData.email,
        password: formData.password,
        role: 'supplier',
        purchaser_id: purchaserIntId,
        full_name: formData.ownerName,
        country: formData.country || null,
        cnic: formData.cnic || null,
        pickup_address: formData.pickupAddress || null,
        pickup_city: pickupCityVal || null,
        phone_number: formData.phoneNumber || null,
        whatsapp_phone_number: formData.whatsappPhoneNumber || null,
        supplier_type: formData.supplierType || null,
        category: formData.category || null,
        shop_name_on_zambeel: formData.shopNameOnZambeel || null,
        stock_location_country: formData.stockLocationCountry || null,
        currency: userCurrency,
        return_address: formData.returnAddress || null,
        return_city: returnCityVal || null,
        payment_method: formData.paymentMethod || null,
        bank_country: formData.paymentMethod === 'Bank Account' ? (formData.bankCountry || null) : null,
        bank_title: formData.paymentMethod === 'Bank Account' ? (formData.bankTitle || null) : null,
        bank_name: formData.paymentMethod === 'Bank Account' ? (bankNameVal || null) : null,
        iban: formData.paymentMethod === 'Bank Account' ? (formData.iban || null) : null,
        paypal_email: formData.paymentMethod === 'Paypal' ? (formData.paypalEmail || null) : null,
        paypal_account_name: formData.paymentMethod === 'Paypal' ? (formData.paypalAccountName || null) : null,
        exchange_name: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeName || null) : null,
        exchange_account_name: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeAccountName || null) : null,
        exchange_id: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeId || null) : null,
        exchange_country: formData.paymentMethod === 'Crypto Payments' ? (formData.exchangeCountry || null) : null,
        binance_wallet: formData.paymentMethod === 'Crypto Payments' ? (formData.binanceWallet || null) : null,
        onboarded: true,
        account_approval: 'Approved',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([insertRow])
        .select()
        .single()

      if (insertError) {
        console.error('Error creating supplier:', insertError)
        if (insertError.code === '23505') {
          setError('An account with this email already exists')
        } else {
          setError(insertError.message || 'Failed to create supplier account. Please try again.')
        }
        setIsSaving(false)
        return
      }

      if (newUser) {
        setSuccess('Supplier account created. They can sign in with the email and password you provided.')
        setTimeout(() => router.push('/suppliers'), 1500)
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
          <Loader2 className="w-8 h-8 animate-spin text-primary-blue" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => router.push('/suppliers')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Suppliers</span>
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Supplier</h1>
              <p className="text-sm text-gray-600 mb-4">
                Same flow and fields as supplier signup. Only purchasers and admins can create suppliers. {isCountryLocked && "Country is set from your account."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white border border-gray-300 rounded-2xl p-8">
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
              <div className="mb-6 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Step {currentStep} of 3</span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-blue rounded-full transition-all" style={{ width: `${(currentStep / 3) * 100}%` }} />
                </div>
              </div>

              <div className="space-y-6">
                {currentStep === 1 && (
                  <>
                {/* Step 1: Account + Personal (same as signup + onboarding step 1) */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Account &amp; Personal Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="email" name="email" value={formData.email} onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.email ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                          placeholder="supplier@example.com" />
                      </div>
                      {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="password" name="password" value={formData.password} onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.password ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                          placeholder="Minimum 6 characters" />
                      </div>
                      {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.ownerName ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                          placeholder="e.g. Ahmed Khan" />
                      </div>
                      {errors.ownerName && <p className="mt-1 text-sm text-red-500">{errors.ownerName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country <span className="text-red-500">*</span></label>
                      <select name="country" value={formData.country} onChange={handleCountryChange} disabled={isCountryLocked}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${isCountryLocked ? 'bg-gray-50' : ''} ${errors.country ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">Select Country</option>
                        {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {errors.country && <p className="mt-1 text-sm text-red-500">{errors.country}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {formData.country && isSupportedCountry(formData.country) ? getIdNumberLabel(formData.country) : 'National ID'} <span className="text-red-500">*</span>
                      </label>
                      <input type="text" name="cnic" value={formData.cnic}
                        onChange={formData.country && isSupportedCountry(formData.country) ? handleIDNumberChange : handleChange}
                        placeholder={formData.country && isSupportedCountry(formData.country) ? getIdNumberPlaceholder(formData.country) : 'National ID'}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.cnic ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                      {errors.cnic && <p className="mt-1 text-sm text-red-500">{errors.cnic}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handlePhoneChange}
                          placeholder={formData.country && isSupportedCountry(formData.country) ? getPhonePlaceholder(formData.country) : '+XXXXXXXXXXXX'}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.phoneNumber ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                      </div>
                      {errors.phoneNumber && <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="tel" name="whatsappPhoneNumber" value={formData.whatsappPhoneNumber} onChange={handleWhatsAppChange}
                          placeholder={formData.country && isSupportedCountry(formData.country) ? getPhonePlaceholder(formData.country) : '+XXXXXXXXXXXX'}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.whatsappPhoneNumber ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={useSameAsPhone} onChange={(e) => { setUseSameAsPhone(e.target.checked); if (e.target.checked) setFormData(prev => ({ ...prev, whatsappPhoneNumber: prev.phoneNumber })) }} className="rounded" />
                        Same as phone number
                      </label>
                      {errors.whatsappPhoneNumber && <p className="mt-1 text-sm text-red-500">{errors.whatsappPhoneNumber}</p>}
                    </div>
                  </div>
                </div>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                {/* Step 2: Business (same as onboarding step 2) */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5" />Business Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Type <span className="text-red-500">*</span></label>
                      <select name="supplierType" value={formData.supplierType} onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.supplierType ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">Select</option>
                        {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {errors.supplierType && <p className="mt-1 text-sm text-red-500">{errors.supplierType}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Categories <span className="text-red-500">*</span></label>
                      <div className="max-h-40 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-2">
                        {CATEGORIES.map(cat => {
                          let sel: string[] = []; try { sel = formData.category ? JSON.parse(formData.category) : [] } catch { sel = formData.category ? formData.category.split(',').map(s => s.trim()).filter(Boolean) : [] }
                          const checked = sel.includes(cat);
                          return (
                            <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox" checked={checked} onChange={() => {
                                const next = checked ? sel.filter(c => c !== cat) : [...sel, cat];
                                setFormData(prev => ({ ...prev, category: JSON.stringify(next) }));
                                if (errors.category) setErrors(prev => ({ ...prev, category: '' }));
                              }} className="rounded" />
                              {cat}
                            </label>
                          );
                        })}
                      </div>
                      {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Shop Name on Zambeel <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Store className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input type="text" name="shopNameOnZambeel" value={formData.shopNameOnZambeel} onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.shopNameOnZambeel ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}
                          placeholder="e.g. Khan Electronics" />
                      </div>
                      {errors.shopNameOnZambeel && <p className="mt-1 text-sm text-red-500">{errors.shopNameOnZambeel}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Stock Location Country <span className="text-red-500">*</span></label>
                      <select name="stockLocationCountry" value={formData.stockLocationCountry} onChange={handleChange} disabled={isCountryLocked}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${isCountryLocked ? 'bg-gray-50' : ''} ${errors.stockLocationCountry ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">Select</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {errors.stockLocationCountry && <p className="mt-1 text-sm text-red-500">{errors.stockLocationCountry}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pickup City <span className="text-red-500">*</span></label>
                      <select name="pickupCity" value={formData.pickupCity} onChange={handleChange} disabled={!formData.stockLocationCountry}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.pickupCity ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">{formData.stockLocationCountry ? 'Select city' : 'Select country first'}</option>
                        {cities.map(ci => <option key={ci} value={ci}>{ci}</option>)}
                      </select>
                      {formData.pickupCity === 'Other' && (
                        <input type="text" name="customPickupCity" value={formData.customPickupCity} onChange={handleChange} placeholder="City name" className="mt-2 w-full px-4 py-2 border-2 rounded-xl" />
                      )}
                      {errors.pickupCity && <p className="mt-1 text-sm text-red-500">{errors.pickupCity}</p>}
                      {errors.customPickupCity && <p className="mt-1 text-sm text-red-500">{errors.customPickupCity}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <textarea name="pickupAddress" value={formData.pickupAddress} onChange={handleChange} rows={2}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.pickupAddress ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                      </div>
                      {errors.pickupAddress && <p className="mt-1 text-sm text-red-500">{errors.pickupAddress}</p>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Return Address <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Home className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <textarea name="returnAddress" value={formData.returnAddress} onChange={handleChange} rows={2} disabled={useSameAsPickup}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${useSameAsPickup ? 'bg-gray-50' : ''} ${errors.returnAddress ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={useSameAsPickup} onChange={(e) => { const v = e.target.checked; setUseSameAsPickup(v); if (v) setFormData(prev => ({ ...prev, returnAddress: prev.pickupAddress, returnCity: prev.pickupCity, customReturnCity: prev.pickupCity === 'Other' ? prev.customPickupCity : '' })) }} className="rounded" />
                        Same as pickup address
                      </label>
                      {errors.returnAddress && <p className="mt-1 text-sm text-red-500">{errors.returnAddress}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Return City <span className="text-red-500">*</span></label>
                      <select name="returnCity" value={formData.returnCity} onChange={handleChange} disabled={!formData.stockLocationCountry || useSameAsPickup}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.returnCity ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">Select city</option>
                        {cities.map(ci => <option key={ci} value={ci}>{ci}</option>)}
                      </select>
                      {formData.returnCity === 'Other' && !useSameAsPickup && (
                        <input type="text" name="customReturnCity" value={formData.customReturnCity} onChange={handleChange} placeholder="City name" className="mt-2 w-full px-4 py-2 border-2 rounded-xl" />
                      )}
                      {errors.returnCity && <p className="mt-1 text-sm text-red-500">{errors.returnCity}</p>}
                    </div>
                  </div>
                </div>
                  </>
                )}

                {currentStep === 3 && (
                  <>
                {/* Step 3: Payment (same as onboarding step 3) */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2"><Wallet className="w-5 h-5" />Payment Method <span className="text-red-500">*</span></h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.paymentMethod ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                        <option value="">Select payment method</option>
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {errors.paymentMethod && <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>}
                    </div>
                    {formData.paymentMethod === 'Bank Account' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Bank Country <span className="text-red-500">*</span></label>
                          <select name="bankCountry" value={formData.bankCountry} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.bankCountry ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                            <option value="">Select</option>
                            {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {errors.bankCountry && <p className="mt-1 text-sm text-red-500">{errors.bankCountry}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account Title <span className="text-red-500">*</span></label>
                          <input type="text" name="bankTitle" value={formData.bankTitle} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.bankTitle ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.bankTitle && <p className="mt-1 text-sm text-red-500">{errors.bankTitle}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name <span className="text-red-500">*</span></label>
                          <select name="bankName" value={formData.bankName} onChange={handleChange} disabled={!formData.bankCountry}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.bankName ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                            <option value="">{formData.bankCountry ? 'Select bank' : 'Select country first'}</option>
                            {banks.map(b => <option key={b} value={b}>{b}</option>)}
                            {banks.length === 0 && formData.bankCountry && <option value="Other">Other</option>}
                          </select>
                          {formData.bankName === 'Other' && <input type="text" name="customBank" value={formData.customBank} onChange={handleChange} placeholder="Bank name" className="mt-2 w-full px-4 py-2 border-2 rounded-xl" />}
                          {errors.bankName && <p className="mt-1 text-sm text-red-500">{errors.bankName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">IBAN <span className="text-red-500">*</span></label>
                          <input type="text" name="iban" value={formData.iban}
                            onChange={formData.bankCountry && isSupportedCountry(formData.bankCountry) ? handleIbanChange : handleChange}
                            placeholder={formData.bankCountry && isSupportedCountry(formData.bankCountry) ? getIbanPlaceholder(formData.bankCountry) : 'IBAN'}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.iban ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.iban && <p className="mt-1 text-sm text-red-500">{errors.iban}</p>}
                        </div>
                      </>
                    )}
                    {formData.paymentMethod === 'Paypal' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">PayPal Email <span className="text-red-500">*</span></label>
                          <input type="email" name="paypalEmail" value={formData.paypalEmail} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.paypalEmail ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.paypalEmail && <p className="mt-1 text-sm text-red-500">{errors.paypalEmail}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">PayPal Account Name <span className="text-red-500">*</span></label>
                          <input type="text" name="paypalAccountName" value={formData.paypalAccountName} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.paypalAccountName ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.paypalAccountName && <p className="mt-1 text-sm text-red-500">{errors.paypalAccountName}</p>}
                        </div>
                      </>
                    )}
                    {formData.paymentMethod === 'Crypto Payments' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exchange <span className="text-red-500">*</span></label>
                          <select name="exchangeName" value={formData.exchangeName} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.exchangeName ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                            <option value="">Select</option>
                            {CRYPTO_EXCHANGES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                          </select>
                          {errors.exchangeName && <p className="mt-1 text-sm text-red-500">{errors.exchangeName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Account Name on Exchange <span className="text-red-500">*</span></label>
                          <input type="text" name="exchangeAccountName" value={formData.exchangeAccountName} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.exchangeAccountName ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.exchangeAccountName && <p className="mt-1 text-sm text-red-500">{errors.exchangeAccountName}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exchange ID <span className="text-red-500">*</span></label>
                          <input type="text" name="exchangeId" value={formData.exchangeId} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.exchangeId ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.exchangeId && <p className="mt-1 text-sm text-red-500">{errors.exchangeId}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Exchange Country <span className="text-red-500">*</span></label>
                          <select name="exchangeCountry" value={formData.exchangeCountry} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.exchangeCountry ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`}>
                            <option value="">Select</option>
                            {ALL_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {errors.exchangeCountry && <p className="mt-1 text-sm text-red-500">{errors.exchangeCountry}</p>}
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Wallet Address <span className="text-red-500">*</span></label>
                          <input type="text" name="binanceWallet" value={formData.binanceWallet} onChange={handleChange}
                            className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${errors.binanceWallet ? 'border-red-500' : 'border-gray-200 focus:border-primary-blue'}`} />
                          {errors.binanceWallet && <p className="mt-1 text-sm text-red-500">{errors.binanceWallet}</p>}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                  </>
                )}

                {/* Step navigation */}
                <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
                  <button type="button" onClick={() => router.push('/suppliers')}
                    className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <div className="flex items-center gap-3">
                    {currentStep > 1 && (
                      <button type="button" onClick={handlePrevious}
                        className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Previous
                      </button>
                    )}
                    {currentStep < 3 ? (
                      <button type="button" onClick={handleNext}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-medium text-white hover:opacity-90 transition-all inline-flex items-center gap-2">
                        Next
                      </button>
                    ) : (
                      <button type="submit" disabled={isSaving}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                        {isSaving ? <><Loader2 className="w-5 h-5 animate-spin" />Creating...</> : <><Save className="w-5 h-5" />Create Supplier</>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

