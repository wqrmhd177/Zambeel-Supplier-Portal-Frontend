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
  ArrowLeft,
  Mail,
  X,
  FileImage
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

interface ProfileData {
  userId: string
  fullName: string
  email: string
  phoneNumber: string
  shopNameOnZambeel: string
  pickupAddress: string
  pickupCity: string
  bankTitle: string
  bankName: string
  iban: string
  nicPictureUrl: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [modalImageUrl, setModalImageUrl] = useState('')
  const [profileData, setProfileData] = useState<ProfileData>({
    userId: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    shopNameOnZambeel: '',
    pickupAddress: '',
    pickupCity: '',
    bankTitle: '',
    bankName: '',
    iban: '',
    nicPictureUrl: ''
  })

  useEffect(() => {
    const fetchProfile = async () => {
      const userId = localStorage.getItem('userId')
      if (!userId) {
        router.push('/login')
        return
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select(`
            user_id,
            full_name,
            owner_name,
            email,
            phone_number,
            shop_name_on_zambeel,
            pickup_address,
            pickup_city,
            bank_title,
            bank_name,
            iban,
            user_picture_url,
            archived
          `)
          .eq('id', userId)
          .single()

        if (fetchError) {
          console.error('Error fetching profile:', fetchError)
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
          const row = data as { archived?: boolean }
          if (row.archived === true) {
            setError('This account has been deleted. You will be logged out.')
            localStorage.clear()
            setTimeout(() => router.push('/login'), 2000)
            return
          }

          setProfileData({
            userId: data.user_id != null ? String(data.user_id) : '',
            fullName: data.full_name || data.owner_name || '',
            email: data.email || '',
            phoneNumber: data.phone_number || '',
            shopNameOnZambeel: data.shop_name_on_zambeel || '',
            pickupAddress: data.pickup_address || '',
            pickupCity: data.pickup_city || '',
            bankTitle: data.bank_title || '',
            bankName: data.bank_name || '',
            iban: data.iban || '',
            nicPictureUrl: data.user_picture_url || ''
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
        {/* Header - no Edit Bank Details button */}
        <header
          className="px-8 py-6 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-lg hover:bg-white/10 transition-all text-white/90"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white">My Profile</h1>
              <p className="text-white/75 mt-1">View your account information</p>
            </div>
          </div>
        </header>

        <main className="p-8 bg-[#f5f3ff]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* 1. Basic Information */}
          <div className="theme-card rounded-2xl p-8 shadow-sm mb-6 bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-gray-600" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">User ID</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Package size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.userId || 'Not assigned'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-mono cursor-not-allowed"
                  />
                </div>
                <p className="text-[13px] text-gray-500 mt-1.5">Your unique user ID (auto-generated)</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <User size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.fullName}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
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

          {/* 2. Business Information - no inventory country */}
          <div className="theme-card rounded-2xl p-8 shadow-sm mb-6 bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Store className="w-5 h-5 text-gray-600" />
              Business Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Shop Name on Zambeel</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Store size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.shopNameOnZambeel}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup Address</label>
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup City</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Building size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.pickupCity}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Banking Information - read-only */}
          <div className="theme-card rounded-2xl p-8 shadow-sm mb-6 bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-gray-600" />
              Banking Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Account Title</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <User size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.bankTitle || 'Not provided'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bank Name</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <Landmark size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.bankName || 'Not provided'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">IBAN / Account Number</label>
                <div className="relative">
                  <div className="absolute left-4 top-3.5 text-gray-400 pointer-events-none">
                    <CreditCard size={20} />
                  </div>
                  <input
                    type="text"
                    value={profileData.iban || 'Not provided'}
                    disabled
                    className="w-full py-3.5 px-4 pl-12 text-[15px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Attachments - NIC Picture only */}
          <div className="theme-card rounded-2xl p-8 shadow-sm bg-white border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <FileImage className="w-5 h-5 text-gray-600" />
              Attachments
            </h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">NIC Picture</label>
              {profileData.nicPictureUrl ? (
                <div
                  onClick={() => {
                    setModalImageUrl(profileData.nicPictureUrl)
                    setImageModalOpen(true)
                  }}
                  className="inline-block cursor-pointer"
                >
                  <img
                    src={profileData.nicPictureUrl}
                    alt="NIC / ID Card"
                    className="w-48 h-32 object-cover rounded-xl border-2 border-gray-200 shadow-md hover:opacity-90 transition-opacity"
                  />
                  <p className="text-xs text-gray-500 mt-2">Click to view full size</p>
                </div>
              ) : (
                <div className="w-48 h-32 bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <FileImage className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No image uploaded</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Image Modal for NIC */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">NIC Picture</h3>
              <button
                onClick={() => setImageModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-gray-50">
              <img
                src={modalImageUrl}
                alt="NIC / ID Card"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
