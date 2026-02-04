'use client'

import { useState, useEffect } from 'react'
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
  Loader2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import { getPurchaserIntegerId } from '@/lib/supplierHelpers'

interface SupplierFormData {
  email: string
  password: string
  ownerName: string
  storeName: string
  cnic: string
  pickupAddress: string
  city: string
  phoneNumber: string
  bankName: string
  iban: string
}

export default function CreateSupplierPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole, userId } = useAuth()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState<SupplierFormData>({
    email: '',
    password: '',
    ownerName: '',
    storeName: '',
    cnic: '',
    pickupAddress: '',
    city: '',
    phoneNumber: '',
    bankName: '',
    iban: ''
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleCNICChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 13) value = value.slice(0, 13)
    
    if (value.length > 5 && value.length <= 12) {
      value = value.slice(0, 5) + '-' + value.slice(5)
    } else if (value.length > 12) {
      value = value.slice(0, 5) + '-' + value.slice(5, 12) + '-' + value.slice(12)
    }
    
    setFormData(prev => ({ ...prev, cnic: value }))
    if (errors.cnic) setErrors(prev => ({ ...prev, cnic: '' }))
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+\-]/g, '')
    setFormData(prev => ({ ...prev, phoneNumber: value }))
    if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }))
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required'
    }

    if (!formData.storeName.trim()) {
      newErrors.storeName = 'Store name is required'
    }

    if (!formData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required'
    } else if (formData.cnic.replace(/\D/g, '').length !== 13) {
      newErrors.cnic = 'CNIC must be 13 digits'
    }

    if (!formData.pickupAddress.trim()) {
      newErrors.pickupAddress = 'Pickup address is required'
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required'
    }

    if (formData.iban && formData.iban.length > 0 && formData.iban.length < 24) {
      newErrors.iban = 'Please enter a valid IBAN'
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

    if (!userId) {
      setError('User not authenticated. Please log in again.')
      router.push('/login')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', formData.email)
        .single()

      if (existingUser) {
        setError('An account with this email already exists')
        setIsSaving(false)
        return
      }

      // Get purchaser's integer ID if not admin
      let purchaserIntId: number | null = null
      if (userRole !== 'admin' && userId) {
        purchaserIntId = await getPurchaserIntegerId(userId)
        if (!purchaserIntId) {
          setError('Unable to get purchaser ID. Please try again.')
          setIsSaving(false)
          return
        }
      }

      // Create new supplier account
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([
          {
            email: formData.email,
            password: formData.password, // Note: In production, hash passwords before storing
            role: 'supplier',
            purchaser_id: purchaserIntId, // Link to purchaser's integer ID
            owner_name: formData.ownerName,
            store_name: formData.storeName,
            cnic: formData.cnic,
            pickup_address: formData.pickupAddress,
            city: formData.city,
            phone_number: formData.phoneNumber,
            bank_name: formData.bankName || null,
            iban: formData.iban || null,
            onboarded: true, // Mark as onboarded since purchaser filled all info
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        ])
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
        setSuccess('Supplier account created successfully!')
        setTimeout(() => {
          router.push('/suppliers')
        }, 1500)
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
              <p className="text-gray-600">
                Add a new supplier account to manage their products
              </p>
            </div>

            {/* Form */}
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

              <div className="space-y-6">
                {/* Account Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Account Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                            errors.email
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 focus:border-primary-blue'
                          }`}
                          placeholder="supplier@example.com"
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                            errors.password
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 focus:border-primary-blue'
                          }`}
                          placeholder="Minimum 6 characters"
                        />
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business Information */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    Business Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Owner Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="ownerName"
                        value={formData.ownerName}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                          errors.ownerName
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 focus:border-primary-blue'
                        }`}
                        placeholder="John Doe"
                      />
                      {errors.ownerName && (
                        <p className="mt-1 text-sm text-red-500">{errors.ownerName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Store Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="storeName"
                        value={formData.storeName}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                          errors.storeName
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 focus:border-primary-blue'
                        }`}
                        placeholder="ABC Store"
                      />
                      {errors.storeName && (
                        <p className="mt-1 text-sm text-red-500">{errors.storeName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CNIC <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="cnic"
                        value={formData.cnic}
                        onChange={handleCNICChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                          errors.cnic
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 focus:border-primary-blue'
                        }`}
                        placeholder="12345-1234567-1"
                        maxLength={15}
                      />
                      {errors.cnic && (
                        <p className="mt-1 text-sm text-red-500">{errors.cnic}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handlePhoneChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                            errors.phoneNumber
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 focus:border-primary-blue'
                          }`}
                          placeholder="+92-300-1234567"
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <textarea
                          name="pickupAddress"
                          value={formData.pickupAddress}
                          onChange={handleChange}
                          rows={3}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                            errors.pickupAddress
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 focus:border-primary-blue'
                          }`}
                          placeholder="Street address, area"
                        />
                      </div>
                      {errors.pickupAddress && (
                        <p className="mt-1 text-sm text-red-500">{errors.pickupAddress}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                          errors.city
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 focus:border-primary-blue'
                        }`}
                        placeholder="Karachi"
                      />
                      {errors.city && (
                        <p className="mt-1 text-sm text-red-500">{errors.city}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Banking Information (Optional) */}
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Banking Information (Optional)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bank Name
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          name="bankName"
                          value={formData.bankName}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900 focus:outline-none focus:border-primary-blue"
                          placeholder="Bank Name"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        IBAN
                      </label>
                      <div className="relative">
                        <Landmark className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          name="iban"
                          value={formData.iban}
                          onChange={handleChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl bg-white text-gray-900 focus:outline-none ${
                            errors.iban
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-gray-200 focus:border-primary-blue'
                          }`}
                          placeholder="PK00XXXX0000000000000000"
                        />
                      </div>
                      {errors.iban && (
                        <p className="mt-1 text-sm text-red-500">{errors.iban}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => router.push('/suppliers')}
                    className="px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-medium text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Create Supplier
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

