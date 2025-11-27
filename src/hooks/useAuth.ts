'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

      // Verify user exists and is not deleted in Supabase
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, user_id, email, archived, role')
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

        // User exists and is not deleted, authentication is valid
        const userRole = data.role || 'supplier'
        localStorage.setItem('userRole', userRole)
        
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          userId: data.id,
          userFriendlyId: data.user_id || authData.userFriendlyId,
          userEmail: data.email || authData.userEmail,
          userRole: userRole,
        })
      } catch (err) {
        console.error('Error checking authentication:', err)
        clearAuth()
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  const clearAuth = () => {
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

