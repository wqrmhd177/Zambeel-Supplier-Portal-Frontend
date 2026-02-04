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
  AlertTriangle,
  X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { getBanksForCountry, getIbanPlaceholder, getIbanHint } from '@/lib/countryData'
import { formatIBAN, validateIBAN } from '@/lib/formatters'

interface ProfileData {
  userId: string
  ownerName: string
  storeName: string
  email: string
  country: string
  cnic: string
  pickupAddress: string
  city: string
  phoneNumber: string
  bankTitle: string
  bankName: string
  iban: string
  userPictureUrl?: string
  storePictureUrl?: string
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
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [modalImageTitle, setModalImageTitle] = useState('')
  
  const [profileData, setProfileData] = useState<ProfileData>({
    userId: '',
    ownerName: '',
    storeName: '',
    email: '',
    country: '',
    cnic: '',
    pickupAddress: '',
    city: '',
    phoneNumber: '',
    bankTitle: '',
    bankName: '',
    iban: '',
    userPictureUrl: '',
    storePictureUrl: ''
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
            country: data.country || '',
            cnic: data.cnic || '',
            pickupAddress: data.pickup_address || '',
            city: data.city || '',
            phoneNumber: data.phone_number || '',
            bankTitle: data.bank_title || '',
            bankName: data.bank_name || '',
            iban: data.iban || '',
            userPictureUrl: data.user_picture_url || '',
            storePictureUrl: data.store_picture_url || ''
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

  // Format IBAN
  const handleIbanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIBAN(e.target.value, profileData.country)
    setProfileData(prev => ({ ...prev, iban: formatted }))
    if (errors.iban) setErrors(prev => ({ ...prev, iban: '' }))
  }

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    // Only validate bank details (optional fields, but if provided must be valid)
    // No validation needed for now as bank fields are optional

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
          bank_title: profileData.bankTitle || null,
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
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#f5f3ff]">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header
          className="px-8 py-6 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/90"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  My Profile
                </h1>
                <p className="text-white/75 mt-1">Manage your supplier information</p>
              </div>
            </div>
            
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Bank Details
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
                  className="px-6 py-2.5 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-all text-gray-700"
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

        <main className="p-8 bg-[#f5f3ff]">
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

          {/* Photos */}
          <div className="theme-card rounded-2xl p-8 shadow-sm mb-6">
            <h3 className="text-lg font-semibold theme-heading mb-6">Profile Photos</h3>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* User Picture */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-semibold theme-heading mb-3 text-center">
                  Your Picture
                </label>
                {profileData.userPictureUrl ? (
                  <img
                    src={profileData.userPictureUrl}
                    alt="User"
                    onClick={() => {
                      setModalImageUrl(profileData.userPictureUrl || '')
                      setModalImageTitle('Your Picture')
                      setImageModalOpen(true)
                    }}
                    className="w-40 h-40 object-cover rounded-2xl border-4 border-gray-200 shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-40 h-40 bg-gray-100 rounded-2xl border-4 border-gray-200 flex items-center justify-center shadow-lg">
                    <div className="text-center">
                      <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No image</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-3 text-center">Uploaded during onboarding</p>
              </div>

              {/* Store Picture */}
              <div className="flex flex-col items-center">
                <label className="block text-sm font-semibold text-gray-900 mb-3 text-center">
                  Your Store Picture
                </label>
                {profileData.storePictureUrl ? (
                  <img
                    src={profileData.storePictureUrl}
                    alt="Store"
                    onClick={() => {
                      setModalImageUrl(profileData.storePictureUrl || '')
                      setModalImageTitle('Your Store Picture')
                      setImageModalOpen(true)
                    }}
                    className="w-40 h-40 object-cover rounded-2xl border-4 border-gray-200 shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-40 h-40 bg-gray-100 rounded-2xl border-4 border-gray-200 flex items-center justify-center shadow-lg">
                    <div className="text-center">
                      <Store className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No image</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-3 text-center">Uploaded during onboarding</p>
              </div>
            </div>
          </div>

          {/* Basic Information Section - Read Only */}
          <div className="theme-card rounded-2xl p-8 shadow-sm mb-6">
            <h3 className="text-lg font-semibold theme-heading mb-6">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User ID (Read-only, displayed prominently) */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold theme-label mb-2">
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
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-mono font-semibold cursor-not-allowed"
                  />
                </div>
                <p className="text-[13px] theme-muted mt-1.5">Your unique supplier ID (auto-generated)</p>
              </div>

              {/* Owner Name - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  Owner Name
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <User size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.ownerName}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Store Name - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  Store Name
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Store size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.storeName}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Email - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
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
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Country - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  Country
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <MapPin size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.country || 'Not specified'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* CNIC - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  ID Number
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <CreditCard size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.cnic}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* City - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  City
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Building size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.city}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Pickup Address - Read Only */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold theme-label mb-2">
                  Pickup Address
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <MapPin size={20} />
                  </div>
                  <textarea
                    value={profileData.pickupAddress}
                    disabled
                    rows={3}
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed resize-none"
                  />
                </div>
              </div>

              {/* Phone Number - Read Only */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Phone size={20} />
                  </div>
                  <input
                    type="tel"
                    value={profileData.phoneNumber}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bank Details Section - Editable */}
          <div className="theme-card rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Banking Information</h3>
              {!isEditing && (
                <p className="text-sm text-gray-500">Click &quot;Edit Bank Details&quot; to update</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bank Account Title */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
                  Bank Account Title
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <User size={20} />
                  </div>
                  <input
                    name="bankTitle"
                    type="text"
                    value={profileData.bankTitle}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl transition-all ${
                      errors.bankTitle ? 'border-red-500' : 'border-gray-200'
                    } ${!isEditing ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder="e.g., Ahmed Khan"
                  />
                </div>
                {errors.bankTitle && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.bankTitle}</span>
                )}
                <p className="text-[13px] text-gray-500 mt-1.5">Name on the bank account</p>
              </div>

              {/* Bank Name */}
              <div>
                <label className="block text-sm font-semibold theme-label mb-2">
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
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl transition-all ${
                      errors.bankName ? 'border-red-500' : 'border-gray-200'
                    } ${!isEditing ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none`}
                  >
                    <option value="">Select Bank</option>
                    {(profileData.country ? getBanksForCountry(profileData.country) : getBanksForCountry('Pakistan')).map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* IBAN */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold theme-label mb-2">
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
                    onChange={handleIbanChange}
                    disabled={!isEditing}
                    maxLength={29}
                    className={`w-full py-3.5 px-4 pl-12 text-[15px] border-2 rounded-xl transition-all ${
                      errors.iban ? 'border-red-500' : 'border-gray-200'
                    } ${!isEditing ? 'bg-gray-50 text-gray-700 cursor-not-allowed' : 'bg-white text-gray-900 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)]'} focus:outline-none placeholder:text-gray-400`}
                    placeholder={profileData.country ? getIbanPlaceholder(profileData.country) : 'XXXXXXXXXXXX'}
                  />
                </div>
                {errors.iban && (
                  <span className="block text-[13px] text-red-500 mt-1.5 font-medium">{errors.iban}</span>
                )}
                {profileData.country && getIbanHint(profileData.country) && (
                  <p className="text-[13px] text-gray-500 mt-1.5">{getIbanHint(profileData.country)}</p>
                )}
              </div>
            </div>

            {/* Delete Account Section */}
            <div className="mt-8 pt-8 border-t border-gray-300">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Delete My Account
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
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
                        <p className="text-sm font-medium text-red-600">
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
                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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

      {/* Image Modal */}
      {imageModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{modalImageTitle}</h3>
              <button
                onClick={() => setImageModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Image */}
            <div className="p-4 flex items-center justify-center bg-gray-50">
              <img
                src={modalImageUrl}
                alt={modalImageTitle}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

