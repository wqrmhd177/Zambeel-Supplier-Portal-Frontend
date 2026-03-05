'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const router = useRouter()
  const [ownerName, setOwnerName] = useState('')
  const [shopName, setShopName] = useState('')

  useEffect(() => {
    const fetchUserData = async () => {
      const userId = localStorage.getItem('userId')
      if (!userId) return

      try {
        const { data, error } = await supabase
          .from('users')
          .select('owner_name, shop_name_on_zambeel')
          .eq('id', userId)
          .single()

        if (data) {
          if (data.owner_name) {
            setOwnerName(data.owner_name)
          }
          if (data.shop_name_on_zambeel) {
            setShopName(data.shop_name_on_zambeel)
          }
        }
      } catch (err) {
        console.error('Error fetching user data:', err)
      }
    }

    fetchUserData()
  }, [])

  const handleViewProfile = () => {
    router.push('/profile')
  }

  const displayName = ownerName || 'there'

  return (
    <header
      className="relative px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6"
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-sm truncate">
            Welcome back, <span className="text-white/95">{displayName}!</span> 👋
          </h1>
          <p className="text-white/75 mt-1 text-xs sm:text-sm hidden sm:block">Here&apos;s what&apos;s happening with your store today</p>
        </div>

        <button
          onClick={handleViewProfile}
          className="px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm md:text-base font-medium transition-all text-white relative overflow-hidden flex-shrink-0 flex flex-col items-center justify-center gap-0.5"
          style={{
            background: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 50%, #4f46e5 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 3px 10px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {shopName && (
            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">{shopName}</span>
          )}
          <span className="text-xs whitespace-nowrap">View Profile</span>
        </button>
      </div>
    </header>
  )
}

