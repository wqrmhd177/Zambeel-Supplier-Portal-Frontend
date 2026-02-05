'use client'

import { Package, LayoutDashboard, ShoppingCart, LogOut, List, Users, CheckCircle, Settings, MessageCircle, Phone } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { clearSessionCookie } from '@/lib/authCookie'

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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
    clearSessionCookie()
    // Clear all user data from localStorage
    localStorage.removeItem('userId')
    localStorage.removeItem('userFriendlyId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('supplierInfo')
    localStorage.removeItem('isOnboarded')
    localStorage.removeItem('userRole')
    
    // Redirect to login page
    router.push('/login')
  }

  return (
    <div
      className="hidden lg:flex w-64 flex-col relative"
      style={{
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
        boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04), 8px 0 24px rgba(0,0,0,0.25)',
        borderRight: '1px solid rgba(0,0,0,0.3)',
      }}
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/10 relative" style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, rgba(124,58,237,0.4) 0%, rgba(79,70,229,0.2) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Package className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white drop-shadow-sm">Zambeel Supplier Portal</span>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-12 rounded-lg mb-2 animate-pulse"
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
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
                className={`w-full flex items-center gap-3 py-3 rounded-lg mb-2 transition-all relative overflow-hidden pl-4 ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-white/85 hover:text-white hover:bg-white/8'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(90deg, #7c3aed 0%, #5b21b6 40%, #4f46e5 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 3px 10px rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                } : undefined}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l"
                    style={{ background: '#f59e0b', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }}
                  />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            )
          })
        )}
      </nav>

      {/* Zambeel WhatsApp Support */}
      <div
        className="mx-4 mb-4 p-4 rounded-xl"
        style={{
          background: 'linear-gradient(145deg, rgba(30,27,75,0.9) 0%, rgba(45,27,105,0.6) 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 12px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)', boxShadow: '0 2px 8px rgba(13,148,136,0.4)' }}
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Zambeel WhatsApp Support</span>
        </div>
        <a href="https://wa.me/971568472271" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/90 hover:text-white text-sm transition-colors">
          <Phone className="w-4 h-4" />
          <span>+971 56 847 2271</span>
        </a>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-white/10 relative" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/85 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}

