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
  })

  useEffect(() => {
    const checkAuth = async () => {
      // Read all localStorage values in one batch
      const authData = {
        userId: localStorage.getItem('userId'),
        userEmail: localStorage.getItem('userEmail'),
        isLoggedIn: localStorage.getItem('isLoggedIn'),
        userFriendlyId: localStorage.getItem('userFriendlyId'),
        userRole: localStorage.getItem('userRole'),
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
      })

      // Verify user exists and is not deleted in Supabase (background validation)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, user_id, email, archived, role, account_approval, onboarded')
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

        // Security check: For suppliers who have completed onboarding, enforce account approval status
        const userRole = data.role || 'supplier'
        if (userRole === 'supplier' && data.onboarded === true) {
          const accountApproval = data.account_approval
          
          if (accountApproval === 'Refused') {
            console.log('Account has been refused, logging out...')
            clearAuth()
            router.push('/login?reason=refused')
            return
          }
          
          if (accountApproval !== 'Approved') {
            // Status is 'Wait' or null - pending approval
            console.log('Account approval is pending, logging out...')
            clearAuth()
            router.push('/login?reason=pending')
            return
          }
        }

        // User exists and is not deleted, update with fresh data from database
        localStorage.setItem('userRole', userRole)
        
        // Only update if role changed
        if (userRole !== authData.userRole) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            userId: data.id,
            userFriendlyId: data.user_id || authData.userFriendlyId,
            userEmail: data.email || authData.userEmail,
            userRole: userRole,
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
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      userFriendlyId: null,
      userEmail: null,
      userRole: null,
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

