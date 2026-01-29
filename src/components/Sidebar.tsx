'use client'

import { Package, LayoutDashboard, ShoppingCart, LogOut, List, Users, CheckCircle, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

const supplierMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
]

const agentMenuItems = [
  { icon: List, label: 'Listings', path: '/listings' },
  { icon: CheckCircle, label: 'Approvals', path: '/approvals' },
]

const adminMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Suppliers', path: '/suppliers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
  { icon: List, label: 'Listings', path: '/listings' },
  { icon: Settings, label: 'User Settings', path: '/settings/users' },
]

const purchaserMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Suppliers', path: '/suppliers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { userRole, isLoading } = useAuth()
  const [activeItem, setActiveItem] = useState('Dashboard')

  // Get menu items based on user role
  const getMenuItems = () => {
    if (!userRole) return [] // Return empty array while loading
    if (userRole === 'admin') {
      return adminMenuItems
    } else if (userRole === 'agent') {
      return agentMenuItems
    } else if (userRole === 'purchaser') {
      return purchaserMenuItems
    } else {
      return supplierMenuItems
    }
  }
  const menuItems = getMenuItems()

  useEffect(() => {
    // Set active item based on current pathname
    const currentItem = menuItems.find(item => pathname?.startsWith(item.path))
    if (currentItem) {
      setActiveItem(currentItem.label)
    }
  }, [pathname, menuItems])

  const handleMenuClick = (label: string, path: string) => {
    setActiveItem(label)
    router.push(path)
  }

  const handleLogout = () => {
    // Clear all user data from localStorage
    localStorage.removeItem('userId')
    localStorage.removeItem('userFriendlyId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('supplierInfo')
    localStorage.removeItem('isOnboarded')
    
    // Redirect to login page
    router.push('/login')
  }

  return (
    <div className="w-64 bg-white dark:bg-dark-card border-r border-gray-300 dark:border-gray-800 flex flex-col transition-colors">
      {/* Logo */}
      <div className="p-6 border-b border-gray-300 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">Zambeel Supplier Portal</span>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4">
        {isLoading ? (
          // Loading skeleton
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-12 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2 animate-pulse"
              />
            ))}
          </>
        ) : (
          menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.label
            
            return (
              <button
                key={item.label}
                onClick={() => handleMenuClick(item.label, item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-hover hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            )
          })
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-300 dark:border-gray-800">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}

