'use client'

import { useState, useRef } from 'react'
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
  CheckCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FormData {
  ownerName: string
  storeName: string
  cnic: string
  pickupAddress: string
  city: string
  phoneNumber: string
  bankTitle: string
  bankName: string
  iban: string
}

interface Errors {
  [key: string]: string
}

export default function SupplierOnboarding() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Use ref to prevent race conditions during navigation
  const isNavigatingRef = useRef(false)
  const isSubmittingRef = useRef(false)

  // Form data state
  const [formData, setFormData] = useState<FormData>({
    ownerName: '',
    storeName: '',
    cnic: '',
    pickupAddress: '',
    city: '',
    phoneNumber: '',
    bankTitle: '',
    bankName: '',
    iban: ''
  })

  // Validation errors
  const [errors, setErrors] = useState<Errors>({})

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  // Format CNIC as user types (xxxxx-xxxxxxx-x)
  const handleCNICChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '') // Remove non-digits
    if (value.length > 13) value = value.slice(0, 13)
    
    // Format: xxxxx-xxxxxxx-x
    if (value.length > 5 && value.length <= 12) {
      value = value.slice(0, 5) + '-' + value.slice(5)
    } else if (value.length > 12) {
      value = value.slice(0, 5) + '-' + value.slice(5, 12) + '-' + value.slice(12)
    }
    
    setFormData(prev => ({ ...prev, cnic: value }))
    if (errors.cnic) setErrors(prev => ({ ...prev, cnic: '' }))
  }

  // Format phone number
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+\-]/g, '') // Keep only digits, +, -
    setFormData(prev => ({ ...prev, phoneNumber: value }))
    if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }))
  }

  // Validate current step
  const validateStep = (step: number): boolean => {
    const newErrors: Errors = {}

    if (step === 1) {
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
    }

    if (step === 2) {
      if (!formData.pickupAddress.trim()) {
        newErrors.pickupAddress = 'Pickup address is required'
      }
      if (!formData.city.trim()) {
        newErrors.city = 'City is required'
      }
      if (!formData.phoneNumber.trim()) {
        newErrors.phoneNumber = 'Phone number is required'
      }
    }

    if (step === 3) {
      // Bank info is optional but validate format if provided
      if (formData.iban && formData.iban.length > 0 && formData.iban.length < 24) {
        newErrors.iban = 'Please enter a valid IBAN'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle next step
  const handleNext = (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    // Prevent multiple clicks
    if (isNavigatingRef.current) {
      return
    }
    
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        isNavigatingRef.current = true
        setCurrentStep(prev => prev + 1)
        // Reset the flag after a short delay
        setTimeout(() => {
          isNavigatingRef.current = false
        }, 100)
      }
    }
  }

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only allow submission on step 3
    if (currentStep !== 3) {
      return
    }
    
    // Prevent double submission
    if (isSubmittingRef.current) {
      return
    }
    
    if (!validateStep(3)) return

    // Get fresh userId from localStorage
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
      // Update user record in Supabase with all onboarding data
      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          owner_name: formData.ownerName,
          store_name: formData.storeName,
          cnic: formData.cnic,
          pickup_address: formData.pickupAddress,
          city: formData.city,
          phone_number: formData.phoneNumber,
          bank_title: formData.bankTitle || null,
          bank_name: formData.bankName || null,
          iban: formData.iban || null,
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
        // Store supplier info in localStorage for dashboard
        localStorage.setItem('supplierInfo', JSON.stringify(formData))
        localStorage.setItem('isOnboarded', 'true')
        
        // Navigate to dashboard
        router.push('/dashboard')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      isSubmittingRef.current = false
      setIsLoading(false)
    }
  }

  // Progress calculation
  const progress = (currentStep / 3) * 100

  return (
    <div className="flex min-h-screen w-full bg-gray-50">
      {/* Left Panel - Progress */}
      <div className="flex-[0.9] bg-white p-16 flex flex-col justify-start relative border-r border-gray-200">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
              <Package size={32} strokeWidth={2} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SupplierHub</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">Complete Your Profile</h2>
            <p className="text-base text-gray-600 mb-10 leading-relaxed">
              Help us set up your supplier account. This will only take a few minutes.
            </p>

            {/* Progress Steps */}
            <div className="flex flex-col gap-5 mb-10">
              {[
                {
                  step: 1,
                  icon: currentStep > 1 ? <CheckCircle size={24} /> : <User size={24} />,
                  title: 'Basic Information',
                  desc: 'Owner details and business info'
                },
                {
                  step: 2,
                  icon: currentStep > 2 ? <CheckCircle size={24} /> : <MapPin size={24} />,
                  title: 'Contact Details',
                  desc: 'Address and phone number'
                },
                {
                  step: 3,
                  icon: <Landmark size={24} />,
                  title: 'Banking Information',
                  desc: 'Payment details (optional)'
                }
              ].map(({ step, icon, title, desc }) => (
                <div 
                  key={step}
                  className={`flex gap-4 items-start p-5 rounded-xl bg-gray-50 border-2 transition-all ${
                    currentStep >= step ? 'border-primary-blue bg-primary-blue/5' : 'border-gray-200'
                  } ${currentStep > step ? 'border-green-500 bg-green-50' : ''}`}
                >
                  <div className={`w-12 h-12 min-w-[48px] rounded-xl flex items-center justify-center transition-all ${
                    currentStep > step ? 'bg-green-500 text-white' :
                    currentStep === step ? 'bg-primary-blue text-white' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-sm text-gray-600 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Progress Bar */}
            <div className="mb-10">
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div 
                  className="h-full bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 font-medium text-center">Step {currentStep} of 3</p>
            </div>
          </div>

          {/* Benefits */}
          <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Why complete your profile?</h3>
            <ul className="space-y-2">
              {[
                'Start listing products immediately',
                'Receive payments directly to your account',
                'Get verified supplier badge',
                'Access to analytics dashboard'
              ].map((item, idx) => (
                <li key={idx} className="text-[15px] text-gray-700 py-1 flex items-center gap-2">
                  <span className="text-green-500">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-[1.1] bg-white flex items-center justify-center p-16 overflow-y-auto">
        <div className="w-full max-w-[560px] animate-slide-in-right">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}
          <form 
            onSubmit={handleSubmit}
            autoComplete="off"
            onKeyDown={(e) => {
              // Prevent form submission on Enter key on all steps
              if (e.key === 'Enter' && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
                e.preventDefault()
              }
            }}
          >
            <div className="animate-fade-in">
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Basic Information</h2>
                    <p className="text-base text-gray-600 leading-relaxed">Tell us about yourself and your business</p>
                  </div>

                  {[
                    {
                      id: 'ownerName',
                      label: 'Owner Name',
                      icon: <User size={20} />,
                      placeholder: 'e.g., Ahmed Khan',
                      value: formData.ownerName,
                      onChange: handleChange,
                      required: true
                    },
                    {
                      id: 'storeName',
                      label: 'Store Name',
                      icon: <Store size={20} />,
                      placeholder: 'e.g., Khan Electronics',
                      value: formData.storeName,
                      onChange: handleChange,
                      required: true
                    }
                  ].map(field => (
                    <div key={field.id} className="mb-6">
                      <label htmlFor={field.id} className="block text-sm font-semibold text-gray-900 mb-2">
                        {field.label} {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <div className="relative flex items-start">
                        <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                          {field.icon}
                        </div>
                        <input
                          id={field.id}
                          name={field.id}
                          type="text"
                          className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                            errors[field.id] ? 'border-red-500' : 'border-gray-200'
                          } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                          placeholder={field.placeholder}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </div>
                      {errors[field.id] && (
                        <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors[field.id]}</span>
                      )}
                    </div>
                  ))}

                  <div className="mb-6">
                    <label htmlFor="cnic" className="block text-sm font-semibold text-gray-900 mb-2">
                      CNIC Number <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <CreditCard size={20} />
                      </div>
                      <input
                        id="cnic"
                        name="cnic"
                        type="text"
                        className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.cnic ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="12345-1234567-1"
                        value={formData.cnic}
                        onChange={handleCNICChange}
                        maxLength={15}
                      />
                    </div>
                    {errors.cnic && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.cnic}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Format: xxxxx-xxxxxxx-x (13 digits)</p>
                  </div>
                </div>
              )}

              {/* Step 2: Contact Details */}
              {currentStep === 2 && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Contact Details</h2>
                    <p className="text-base text-gray-600 leading-relaxed">Where can customers reach you?</p>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="pickupAddress" className="block text-sm font-semibold text-gray-900 mb-2">
                      Pickup Address <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <MapPin size={20} />
                      </div>
                      <textarea
                        id="pickupAddress"
                        name="pickupAddress"
                        className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all resize-y min-h-[80px] leading-relaxed ${
                          errors.pickupAddress ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="e.g., Shop 123, Main Market, F-10 Markaz"
                        value={formData.pickupAddress}
                        onChange={handleChange}
                        rows={3}
                      />
                    </div>
                    {errors.pickupAddress && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.pickupAddress}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Full business address for product pickup</p>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="city" className="block text-sm font-semibold text-gray-900 mb-2">
                      City <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <Building size={20} />
                      </div>
                      <select
                        id="city"
                        name="city"
                        className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.city ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none`}
                        value={formData.city}
                        onChange={handleChange}
                      >
                        <option value="">Select City</option>
                        {['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Other'].map(city => (
                          <option key={city} value={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                    {errors.city && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.city}</span>
                    )}
                  </div>

                  <div className="mb-6">
                    <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-900 mb-2">
                      Phone Number <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <Phone size={20} />
                      </div>
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        type="tel"
                        className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.phoneNumber ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="+92-300-1234567"
                        value={formData.phoneNumber}
                        onChange={handlePhoneChange}
                      />
                    </div>
                    {errors.phoneNumber && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.phoneNumber}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Include country code (e.g., +92)</p>
                  </div>
                </div>
              )}

              {/* Step 3: Banking Information */}
              {currentStep === 3 && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">Banking Information</h2>
                    <p className="text-base text-gray-600 leading-relaxed">For receiving payments (you can skip this for now)</p>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="bankTitle" className="block text-sm font-semibold text-gray-900 mb-2">
                      Bank Account Title
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <User size={20} />
                      </div>
                      <input
                        id="bankTitle"
                        name="bankTitle"
                        type="text"
                        className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                        placeholder="e.g., Ahmed Khan"
                        value={formData.bankTitle}
                        onChange={handleChange}
                      />
                    </div>
                    <p className="text-[13px] text-gray-500 mt-1.5">Name on the bank account</p>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="bankName" className="block text-sm font-semibold text-gray-900 mb-2">
                      Bank Name
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <Landmark size={20} />
                      </div>
                      <select
                        id="bankName"
                        name="bankName"
                        className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none"
                        value={formData.bankName}
                        onChange={handleChange}
                      >
                        <option value="">Select Bank</option>
                        {['Meezan Bank', 'Habib Bank Limited (HBL)', 'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Faysal Bank', 'Standard Chartered', 'JS Bank', 'Askari Bank', 'Other'].map(bank => (
                          <option key={bank} value={bank}>{bank}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="iban" className="block text-sm font-semibold text-gray-900 mb-2">
                      IBAN Number
                    </label>
                    <div className="relative flex items-start">
                      <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none z-10">
                        <CreditCard size={20} />
                      </div>
                      <input
                        id="iban"
                        name="iban"
                        type="text"
                        className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white text-gray-900 transition-all ${
                          errors.iban ? 'border-red-500' : 'border-gray-200'
                        } focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400`}
                        placeholder="PK36MEZN0000001234567890"
                        value={formData.iban}
                        onChange={handleChange}
                        maxLength={34}
                      />
                    </div>
                    {errors.iban && (
                      <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.iban}</span>
                    )}
                    <p className="text-[13px] text-gray-500 mt-1.5">Pakistan IBAN format: PK + 2 digits + 20 characters</p>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mt-6">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      💡 <strong>Note:</strong> Banking information is optional but recommended. 
                      You can add or update this later in your profile settings.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8">
              {currentStep > 1 && (
                <button
                  type="button"
                  className="flex-1 py-4 px-6 text-base font-semibold text-gray-900 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center gap-2 transition-all hover:border-primary-blue hover:bg-primary-blue/5 disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={handlePrevious}
                  disabled={isLoading}
                >
                  <ArrowLeft size={20} />
                  <span>Previous</span>
                </button>
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  className={`flex-1 py-4 px-6 text-base font-semibold text-white bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(74,159,245,0.4)] transition-all ${
                    isNavigatingRef.current ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] active:translate-y-0'
                  }`}
                  onClick={handleNext}
                  disabled={isNavigatingRef.current}
                >
                  <span>Next</span>
                  <ArrowRight size={20} />
                </button>
              ) : (
                <button
                  type="submit"
                  className={`flex-1 py-4 px-6 text-base font-semibold text-white bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(74,159,245,0.4)] transition-all ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] active:translate-y-0'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Completing...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup</span>
                      <CheckCircle size={20} />
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Skip Link (only on step 3) */}
            {currentStep === 3 && !isLoading && (
              <button
                type="button"
                className="block w-full text-center py-3 mt-4 text-sm text-gray-600 transition-colors hover:text-primary-blue hover:underline"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  
                  // Skip banking info and submit
                  if (isSubmittingRef.current) return
                  
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
                    const { data, error: updateError } = await supabase
                      .from('users')
                      .update({
                        owner_name: formData.ownerName,
                        store_name: formData.storeName,
                        cnic: formData.cnic,
                        pickup_address: formData.pickupAddress,
                        city: formData.city,
                        phone_number: formData.phoneNumber,
                        bank_title: null,
                        bank_name: null,
                        iban: null,
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
                      localStorage.setItem('supplierInfo', JSON.stringify({ ...formData, bankTitle: '', bankName: '', iban: '' }))
                      localStorage.setItem('isOnboarded', 'true')
                      router.push('/dashboard')
                    }
                  } catch (err) {
                    console.error('Unexpected error:', err)
                    setError('An unexpected error occurred. Please try again.')
                    isSubmittingRef.current = false
                    setIsLoading(false)
                  }
                }}
              >
                Skip for now and complete profile later
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}