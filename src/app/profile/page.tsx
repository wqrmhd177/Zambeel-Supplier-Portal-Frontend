'use client'

import { useState, useEffect } from 'react'
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
  Save,
  ArrowLeft,
  Mail,
  Edit2,
  Trash2,
  AlertTriangle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

interface ProfileData {
  userId: string
  ownerName: string
  storeName: string
  email: string
  cnic: string
  pickupAddress: string
  city: string
  phoneNumber: string
  bankName: string
  iban: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  
  const [profileData, setProfileData] = useState<ProfileData>({
    userId: '',
    ownerName: '',
    storeName: '',
    email: '',
    cnic: '',
    pickupAddress: '',
    city: '',
    phoneNumber: '',
    bankName: '',
    iban: ''
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Fetch user profile data
  useEffect(() => {
    // Redirect agents to listings page (admin can access everything)
    const userRole = localStorage.getItem('userRole')
    if (userRole === 'agent') {
      router.push('/listings')
      return
    }

    const fetchProfile = async () => {
      const userId = localStorage.getItem('userId')
      if (!userId) {
        router.push('/login')
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()

        if (fetchError) {
          console.error('Error fetching profile:', fetchError)
          // If user doesn't exist, clear auth and redirect
          if (fetchError.code === 'PGRST116') {
            localStorage.clear()
            router.push('/login')
            return
          }
          setError('Failed to load profile data')
          setIsLoading(false)
          return
        }

        if (data) {
          // Check if account is deleted
          if (data.archived === true) {
            setError('This account has been deleted. You will be logged out.')
            localStorage.clear()
            setTimeout(() => router.push('/login'), 2000)
            return
          }

          setProfileData({
            userId: data.user_id || '',
            ownerName: data.owner_name || '',
            storeName: data.store_name || '',
            email: data.email || '',
            cnic: data.cnic || '',
            pickupAddress: data.pickup_address || '',
            city: data.city || '',
            phoneNumber: data.phone_number || '',
            bankName: data.bank_name || '',
            iban: data.iban || ''
          })
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError('An unexpected error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setProfileData(prev => ({
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

  // Format CNIC as user types
  const handleCNICChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '')
    if (value.length > 13) value = value.slice(0, 13)
    
    if (value.length > 5 && value.length <= 12) {
      value = value.slice(0, 5) + '-' + value.slice(5)
    } else if (value.length > 12) {
      value = value.slice(0, 5) + '-' + value.slice(5, 12) + '-' + value.slice(12)
    }
    
    setProfileData(prev => ({ ...prev, cnic: value }))
    if (errors.cnic) setErrors(prev => ({ ...prev, cnic: '' }))
  }

  // Format phone number
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+\-]/g, '')
    setProfileData(prev => ({ ...prev, phoneNumber: value }))
    if (errors.phoneNumber) setErrors(prev => ({ ...prev, phoneNumber: '' }))
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    if (!profileData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required'
    }
    if (!profileData.storeName.trim()) {
      newErrors.storeName = 'Store name is required'
    }
    if (!profileData.cnic.trim()) {
      newErrors.cnic = 'CNIC is required'
    } else if (profileData.cnic.replace(/\D/g, '').length !== 13) {
      newErrors.cnic = 'CNIC must be 13 digits'
    }
    if (!profileData.pickupAddress.trim()) {
      newErrors.pickupAddress = 'Pickup address is required'
    }
    if (!profileData.city.trim()) {
      newErrors.city = 'City is required'
    }
    if (!profileData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      setError('Please fix the errors before saving')
      return
    }

    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/login')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const { data, error: updateError } = await supabase
        .from('users')
        .update({
          owner_name: profileData.ownerName,
          store_name: profileData.storeName,
          cnic: profileData.cnic,
          pickup_address: profileData.pickupAddress,
          city: profileData.city,
          phone_number: profileData.phoneNumber,
          bank_name: profileData.bankName || null,
          iban: profileData.iban || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating profile:', updateError)
        setError(updateError.message || 'Failed to save profile. Please try again.')
        setIsSaving(false)
        return
      }

      if (data) {
        // Update localStorage
        localStorage.setItem('supplierInfo', JSON.stringify(profileData))
        setSuccess('Profile updated successfully!')
        setIsEditing(false)
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleArchiveAccount = async () => {
    const userId = localStorage.getItem('userId')
    if (!userId) {
      router.push('/login')
      return
    }

    setIsArchiving(true)
    setError('')
    setSuccess('')

    try {
      const { error: archiveError } = await supabase
        .from('users')
        .update({
          archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)

      if (archiveError) {
        console.error('Error deleting account:', archiveError)
        setError(archiveError.message || 'Failed to delete account. Please try again.')
        setIsArchiving(false)
        return
      }

      // Account deleted successfully, clear auth and redirect
      localStorage.clear()
      router.push('/login')
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsArchiving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100 dark:bg-dark-bg">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-bg transition-colors">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white dark:bg-dark-card border-b border-gray-300 dark:border-gray-800 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-all"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  My Profile
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your supplier information</p>
              </div>
            </div>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setErrors({})
                    // Reload data to discard changes
                    window.location.reload()
                  }}
                  className="px-6 py-2.5 border-2 border-gray-300 dark:border-gray-700 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-dark-hover transition-all text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="p-8">
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

          <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User ID (Read-only, displayed prominently) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  User ID
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Package size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.userId || 'Not assigned yet'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-dark-hover text-gray-700 dark:text-gray-300 font-mono font-semibold cursor-not-allowed"
                  />
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5">Your unique supplier ID (auto-generated)</p>
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Owner Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <User size={20} />
                  </div>
                  <input
                    name="ownerName"
                    type="text"
                    value={profileData.ownerName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.ownerName ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="e.g., Ahmed Khan"
                  />
                </div>
                {errors.ownerName && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.ownerName}</span>
                )}
              </div>

              {/* Store Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Store Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Store size={20} />
                  </div>
                  <input
                    name="storeName"
                    type="text"
                    value={profileData.storeName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.storeName ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="e.g., Khan Electronics"
                  />
                </div>
                {errors.storeName && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.storeName}</span>
                )}
              </div>

              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-dark-hover text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1.5">Email cannot be changed</p>
              </div>

              {/* CNIC */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  CNIC Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <CreditCard size={20} />
                  </div>
                  <input
                    name="cnic"
                    type="text"
                    value={profileData.cnic}
                    onChange={handleCNICChange}
                    disabled={!isEditing}
                    maxLength={15}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.cnic ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="12345-1234567-1"
                  />
                </div>
                {errors.cnic && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.cnic}</span>
                )}
              </div>

              {/* Pickup Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Pickup Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <MapPin size={20} />
                  </div>
                  <textarea
                    name="pickupAddress"
                    value={profileData.pickupAddress}
                    onChange={handleChange}
                    disabled={!isEditing}
                    rows={3}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all resize-y ${
                      errors.pickupAddress ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="e.g., Shop 123, Main Market, F-10 Markaz"
                  />
                </div>
                {errors.pickupAddress && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.pickupAddress}</span>
                )}
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  City <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Building size={20} />
                  </div>
                  <select
                    name="city"
                    value={profileData.city}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.city ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none`}
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

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Phone size={20} />
                  </div>
                  <input
                    name="phoneNumber"
                    type="tel"
                    value={profileData.phoneNumber}
                    onChange={handlePhoneChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.phoneNumber ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="+92-300-1234567"
                  />
                </div>
                {errors.phoneNumber && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.phoneNumber}</span>
                )}
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Bank Name
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Landmark size={20} />
                  </div>
                  <select
                    name="bankName"
                    value={profileData.bankName}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.bankName ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none`}
                  >
                    <option value="">Select Bank</option>
                    {['Meezan Bank', 'Habib Bank Limited (HBL)', 'United Bank Limited (UBL)', 'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Faysal Bank', 'Standard Chartered', 'JS Bank', 'Askari Bank', 'Other'].map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* IBAN */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  IBAN Number
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <CreditCard size={20} />
                  </div>
                  <input
                    name="iban"
                    type="text"
                    value={profileData.iban}
                    onChange={handleChange}
                    disabled={!isEditing}
                    maxLength={34}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl bg-white dark:bg-dark-hover text-gray-900 dark:text-white transition-all ${
                      errors.iban ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                    } ${!isEditing ? 'cursor-not-allowed opacity-60' : 'focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="PK36MEZN0000001234567890"
                  />
                </div>
                {errors.iban && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.iban}</span>
                )}
              </div>
            </div>

            {/* Delete Account Section */}
            <div className="mt-8 pt-8 border-t border-gray-300 dark:border-gray-700">
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Delete My Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      This action is irreversible. Deleting your account will prevent you from logging in. You will have to sign up again.
                    </p>
                    {!showArchiveConfirm ? (
                      <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete My Account
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                          Are you sure you want to delete your account? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={handleArchiveAccount}
                            disabled={isArchiving}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {isArchiving ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Yes, Delete My Account
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setShowArchiveConfirm(false)}
                            disabled={isArchiving}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

