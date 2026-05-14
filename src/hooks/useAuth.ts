'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { clearSessionCookie, setSessionCookie, isSessionIdle, updateLastActivity } from '@/lib/authCookie'

interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  userId: string | null
  userFriendlyId: string | null
  userEmail: string | null
  userRole: string | null
  userCountry: string | null
}

export function useAuth() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    userId: null,
    userFriendlyId: null,
    userEmail: null,
    userRole: null,
    userCountry: null,
  })

  useEffect(() => {
    const getApprovalFlags = (value: unknown) => {
      const normalized = String(value || '').trim().toLowerCase()
      const isApproved = normalized === 'approved' || normalized.includes('approved')
      const isRefused = normalized === 'refused' || normalized.includes('refus')
      return { isApproved, isRefused }
    }

    const checkAuth = async () => {
      const hasSubmittedOnboarding = (u: any) => {
        const hasFullName = String(u?.full_name || '').trim().length > 0
        const hasShopName = String(u?.shop_name_on_zambeel || u?.shop_name || '').trim().length > 0
        const hasPhone = String(u?.phone_number || '').trim().length > 0
        const hasCountry = String(u?.country || '').trim().length > 0
        return hasFullName || hasShopName || hasPhone || hasCountry
      }

      // Read all localStorage values in one batch
      const authData = {
        userId: localStorage.getItem('userId'),
        userEmail: localStorage.getItem('userEmail'),
        isLoggedIn: localStorage.getItem('isLoggedIn'),
        userFriendlyId: localStorage.getItem('userFriendlyId'),
        userRole: String(localStorage.getItem('userRole') || 'supplier').trim().toLowerCase(),
      }

      // If no auth data in localStorage, user is not authenticated
      if (!authData.userId || !authData.isLoggedIn || authData.isLoggedIn !== 'true') {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          userId: null,
          userFriendlyId: null,
          userEmail: null,
          userRole: null,
          userCountry: null,
        })
        return
      }

      // Check for idle timeout (12 hours of inactivity)
      if (isSessionIdle()) {
        console.log('Session expired due to inactivity, logging out...')
        clearAuth()
        // Use window.location for full page reload to preserve query params
        window.location.href = '/login?reason=timeout'
        return
      }

      // Update last activity timestamp (user is active on this page load)
      updateLastActivity()

      // Ensure session cookie is set (e.g. for returning users who had no cookie yet)
      setSessionCookie()

      // Set initial state from localStorage immediately (optimistic UI)
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        userId: authData.userId,
        userFriendlyId: authData.userFriendlyId,
        userEmail: authData.userEmail,
        userRole: authData.userRole || 'supplier',
        userCountry: localStorage.getItem('userCountry'),
      })

      // Verify user exists and is not deleted in Supabase (background validation)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, user_id, email, archived, role, account_approval, onboarded, country')
          .eq('id', authData.userId)
          .single()

        if (error || !data) {
          // User doesn't exist in database, clear auth and logout
          console.log('User not found in database, logging out...')
          clearAuth()
          router.push('/login')
          return
        }

        // Check if account is deleted
        if (data.archived === true) {
          console.log('Account is deleted, logging out...')
          clearAuth()
          router.push('/login')
          return
        }

        // Security check: normalize flags for robust handling across DB value formats.
        const userRole = String(data.role || 'supplier').trim().toLowerCase()
        const userCountry = String(data.country || '').trim()
        const { isApproved, isRefused } = getApprovalFlags(data.account_approval)

        // Enforce account approval for all roles except admin (admin can never lock themselves out).
        if (userRole !== 'admin') {
          if (isRefused) {
            console.log('Account has been refused, logging out...')
            clearAuth()
            router.push('/login?reason=refused')
            return
          }
          if (!isApproved) {
            console.log('Account approval is pending, logging out...')
            clearAuth()
            router.push('/login?reason=pending')
            return
          }
        }

        // User exists and is not deleted, update with fresh data from database
        localStorage.setItem('userRole', userRole)
        localStorage.setItem('userCountry', userCountry)

        // Update state if role or country changed
        if (userRole !== authData.userRole || userCountry !== (localStorage.getItem('userCountry') || '')) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            userId: data.id,
            userFriendlyId: data.user_id || authData.userFriendlyId,
            userEmail: data.email || authData.userEmail,
            userRole: userRole,
            userCountry: userCountry || null,
          })
        }
      } catch (err) {
        console.error('Error checking authentication:', err)
        clearAuth()
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  const clearAuth = () => {
    clearSessionCookie()
    localStorage.removeItem('userId')
    localStorage.removeItem('userFriendlyId')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('supplierInfo')
    localStorage.removeItem('isOnboarded')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userCountry')
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      userFriendlyId: null,
      userEmail: null,
      userRole: null,
      userCountry: null,
    })
  }

  const logout = () => {
    clearAuth()
    router.push('/login')
  }

  return {
    ...authState,
    logout,
    clearAuth,
  }
}

