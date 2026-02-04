'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import StatsCards from '@/components/StatsCards'
import RevenueChart from '@/components/RevenueChart'
import SupplierProfile from '@/components/SupplierProfile'
import QuickActions from '@/components/QuickActions'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const { isAuthenticated, isLoading, userRole } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }
    
    // Redirect agents to listings page (admin can access everything)
    if (!isLoading && isAuthenticated && userRole === 'agent') {
      router.push('/listings')
      return
    }
  }, [isAuthenticated, isLoading, userRole, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="flex h-screen bg-[#f5f3ff]">
      <Sidebar />
      
      <div className="flex-1 overflow-auto">
        <Header />
        
        <main className="p-8 bg-[#f5f3ff]">
          <StatsCards />
          <RevenueChart />
          <SupplierProfile />
          <QuickActions />
        </main>
      </div>
    </div>
  )
}

