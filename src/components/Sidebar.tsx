'use client'

import {
  Package, LayoutDashboard, ShoppingCart, LogOut, List, Users,
  Settings, MessageCircle, Phone, X, ClipboardList, RotateCcw,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { clearSessionCookie } from '@/lib/authCookie'
import { getPendingListingsCount } from '@/lib/productHelpers'
import { getPendingApprovalsCount } from '@/lib/priceHistoryHelpers'
import { getPendingProductAvailabilityCount } from '@/lib/productAvailabilityHelpers'

const supplierMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
  { icon: RotateCcw, label: 'Return Management', path: '/returns' },
  { icon: ClipboardList, label: 'Product Availability', path: '/product-availability', showPendingCount: true as const },
]

const agentMenuItems = [
  { icon: ClipboardList, label: 'Product Availability', path: '/product-availability', showPendingCount: true as const },
]

const adminMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Suppliers', path: '/suppliers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
  { icon: RotateCcw, label: 'Return Management', path: '/returns' },
  { icon: List, label: 'Listings', path: '/listings', showPendingCount: true as const },
  { icon: ClipboardList, label: 'Product Availability', path: '/product-availability', showPendingCount: true as const },
  { icon: Settings, label: 'User Settings', path: '/settings/users' },
]

const purchaserMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Suppliers', path: '/suppliers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ClipboardList, label: 'Product Availability', path: '/product-availability', showPendingCount: true as const },
]

const managerMenuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Suppliers', path: '/suppliers' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: ShoppingCart, label: 'Orders', path: '/orders' },
  { icon: RotateCcw, label: 'Return Management', path: '/returns' },
  { icon: List, label: 'Listings', path: '/listings' },
  { icon: ClipboardList, label: 'Product Availability', path: '/product-availability', showPendingCount: true as const },
]

const listingAgentMenuItems = [
  { icon: Package, label: 'Products', path: '/products' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const { userRole, isLoading, userFriendlyId } = useAuth()
  const [activeItem, setActiveItem] = useState('Dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [, setListingPendingCount] = useState<number | null>(null)
  const [, setApprovalsPendingCount] = useState<number | null>(null)
  const [, setAvailabilityPendingCount] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    const loadCounts = async () => {
      if (!userRole) return
      if (userRole === 'admin' || userRole === 'manager') {
        const listings = await getPendingListingsCount()
        if (isMounted) setListingPendingCount(listings)
      }
      if (userRole === 'admin') {
        const approvals = await getPendingApprovalsCount()
        if (isMounted) setApprovalsPendingCount(approvals)
      }
      if (userFriendlyId) {
        const availability = await getPendingProductAvailabilityCount(userRole, userFriendlyId)
        if (isMounted) setAvailabilityPendingCount(availability)
      }
    }

    loadCounts()
    const interval = setInterval(loadCounts, 15000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [userRole, userFriendlyId, pathname])

  const getMenuItems = () => {
    if (!userRole) return []
    if (userRole === 'admin') return adminMenuItems
    if (userRole === 'agent') return agentMenuItems
    if (userRole === 'purchaser') return purchaserMenuItems
    if (userRole === 'manager') return managerMenuItems
    if (userRole === 'listing_agent') return listingAgentMenuItems
    return supplierMenuItems
  }
  const menuItems = getMenuItems()

  useEffect(() => {
    const currentItem = menuItems.find((item) => pathname?.startsWith(item.path))
    if (currentItem) setActiveItem(currentItem.label)
  }, [pathname, menuItems])

  useEffect(() => {
    const openMobileMenu = () => setIsMobileMenuOpen(true)
    window.addEventListener('open-mobile-sidebar', openMobileMenu as EventListener)
    return () => window.removeEventListener('open-mobile-sidebar', openMobileMenu as EventListener)
  }, [])

  useEffect(() => { setIsMobileMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!isMobileMenuOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = originalOverflow }
  }, [isMobileMenuOpen])

  const handleMenuClick = (label: string, path: string) => {
    setActiveItem(label)
    setIsMobileMenuOpen(false)
    router.push(path)
  }

  const handleLogout = () => {
    clearSessionCookie()
    localStorage.removeItem('userId')
    localStorage.removeItem('userFriendlyId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('supplierInfo')
    localStorage.removeItem('isOnboarded')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userCountry')
    setIsMobileMenuOpen(false)
    router.push('/login')
  }

  const renderSidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/10 relative" style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(145deg, rgba(124,58,237,0.4) 0%, rgba(79,70,229,0.2) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold text-white drop-shadow-sm leading-tight">
              Zambeel<br />
              <span className="text-xs font-medium text-white/80">Supplier Portal</span>
            </span>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-11 rounded-lg mb-1.5 animate-pulse"
                style={{ background: 'rgba(255,255,255,0.06)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}
              />
            ))}
          </>
        ) : (
          menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.label
            const displayLabel = item.label

            return (
              <button
                key={item.label}
                onClick={() => handleMenuClick(item.label, item.path)}
                className={`w-full flex items-center gap-3 py-2.5 rounded-lg mb-1 transition-all relative overflow-hidden pl-4 ${
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
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-sm">{displayLabel}</span>
              </button>
            )
          })
        )}
      </nav>

      {/* WhatsApp Support + Logout */}
      <div className="px-3 pb-3 pt-3 border-t border-white/10" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
        {/* WhatsApp Support — full number visible */}
        <a
          href="https://wa.me/923054094932"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/8 transition-all mb-1"
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)' }}
          >
            <MessageCircle className="w-4 h-4 text-white" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/90 leading-tight">WhatsApp Support</div>
            <div className="text-xs text-white/60 flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 flex-shrink-0" />
              +92-305-4094932
            </div>
          </div>
        </a>

        {/* Logout — icon + label */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/8 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      <div
        className="hidden lg:flex w-60 flex-col relative"
        style={{
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
          boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04), 8px 0 24px rgba(0,0,0,0.25)',
          borderRight: '1px solid rgba(0,0,0,0.3)',
        }}
      >
        {renderSidebarContent(false)}
      </div>

      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close mobile menu overlay"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside
            className="absolute left-0 top-0 h-full w-[88vw] max-w-[300px] flex flex-col"
            style={{
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 35%, #1e1b4b 70%, #2d1b69 100%)',
              boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04), 8px 0 24px rgba(0,0,0,0.35)',
              borderRight: '1px solid rgba(0,0,0,0.3)',
            }}
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  )
}
