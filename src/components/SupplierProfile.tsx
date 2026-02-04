'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupplierProfile() {
  const [profileData, setProfileData] = useState<{
    storeName: string
    ownerName: string
    cnic: string
    city: string
    phone: string
    address: string
    bank: string
    iban: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const userId = localStorage.getItem('userId')
      if (!userId) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('store_name, owner_name, cnic, city, phone_number, pickup_address, bank_name, iban')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
          setIsLoading(false)
          return
        }

        if (data) {
          setProfileData({
            storeName: data.store_name || 'Not set',
            ownerName: data.owner_name || 'Not set',
            cnic: data.cnic || 'Not set',
            city: data.city || 'Not set',
            phone: data.phone_number || 'Not set',
            address: data.pickup_address || 'Not set',
            bank: data.bank_name || 'Not set',
            iban: data.iban || 'Not set',
          })
        }
      } catch (err) {
        console.error('Unexpected error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [])

  if (isLoading) {
    return (
      <div className="theme-card rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-6 theme-heading-gradient">Your Supplier Profile</h2>
        <div className="text-center py-4">
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return null
  }

  const displayData = [
    { label: 'STORE NAME', value: profileData.storeName },
    { label: 'OWNER NAME', value: profileData.ownerName },
    { label: 'CNIC', value: profileData.cnic },
    { label: 'CITY', value: profileData.city },
    { label: 'PHONE', value: profileData.phone },
    { label: 'ADDRESS', value: profileData.address },
    { label: 'BANK', value: profileData.bank },
    { label: 'IBAN', value: profileData.iban },
  ]

  return (
    <div className="theme-card rounded-2xl p-6 mb-8">
      <h2 className="text-xl font-bold mb-6 theme-heading-gradient">Your Supplier Profile</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayData.map((item, index) => (
          <div key={index}>
            <p className="theme-muted text-xs mb-2 font-medium">{item.label}</p>
            <p className="theme-heading font-medium">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

