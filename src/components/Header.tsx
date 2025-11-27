'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [ownerName, setOwnerName] = useState('')

  useEffect(() => {
    const fetchOwnerName = async () => {
      const userId = localStorage.getItem('userId')
      if (!userId) return

      try {
        const { data, error } = await supabase
          .from('users')
          .select('owner_name')
          .eq('id', userId)
          .single()

        if (data && data.owner_name) {
          setOwnerName(data.owner_name)
        }
      } catch (err) {
        console.error('Error fetching owner name:', err)
      }
    }

    fetchOwnerName()
  }, [])

  const handleViewProfile = () => {
    router.push('/profile')
  }

  const displayName = ownerName || 'there'

  return (
    <header className="bg-light-card dark:bg-dark-card border-b border-gray-300 dark:border-gray-800 px-8 py-6 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{displayName}!</span> 👋
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Here's what's happening with your store today</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-200 dark:bg-dark-hover hover:bg-gray-300 dark:hover:bg-gray-700 transition-all"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-blue-600" />
            )}
          </button>
          
          <button 
            onClick={handleViewProfile}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-all text-white"
          >
            View Profile
          </button>
        </div>
      </div>
    </header>
  )
}

