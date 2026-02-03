'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [popupMessage, setPopupMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      if (isSignUp) {
        // Sign up flow
        // Validate passwords match
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          setIsLoading(false)
          return
        }

        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          setIsLoading(false)
          return
        }

        // Check if email already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id, email, archived, user_id')
          .eq('email', email)
          .single()

        if (existingUser) {
          // If account exists and is archived, restore it
          if (existingUser.archived === true) {
            // Restore the archived account and reset onboarding
            const { data: restoredUser, error: restoreError } = await supabase
              .from('users')
              .update({
                password: password, // Update password
                archived: false, // Restore account
                onboarded: false, // Reset onboarding so user goes through it again
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingUser.id)
              .select()
              .single()

            if (restoreError) {
              setError(restoreError.message || 'Failed to restore account. Please try again.')
              setIsLoading(false)
              return
            }

            if (restoredUser) {
              // Store user ID in localStorage
              localStorage.setItem('userId', restoredUser.id)
              localStorage.setItem('userFriendlyId', restoredUser.user_id || '')
              localStorage.setItem('userEmail', email)
              localStorage.setItem('isLoggedIn', 'true')
              localStorage.setItem('userRole', restoredUser.role || 'supplier')
              localStorage.removeItem('isOnboarded') // Clear onboarding flag
              localStorage.removeItem('supplierInfo') // Clear old supplier info
              
              // Check user role and redirect accordingly
              const userRole = restoredUser.role || 'supplier'
              if (userRole === 'admin') {
                router.push('/dashboard')
              } else if (userRole === 'agent') {
                router.push('/listings')
              } else {
                router.push('/onboarding')
              }
              setIsLoading(false)
              return
            }
          } else {
            // Account exists and is active
            setError('Email already exists. Please sign in instead.')
            setIsLoading(false)
            return
          }
        }

        // If email doesn't exist or check returned error (user not found), create new account
        if (checkError && checkError.code !== 'PGRST116') {
          // Some other error occurred
          setError(checkError.message || 'An error occurred. Please try again.')
          setIsLoading(false)
          return
        }

        // Create new account
        const { data, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              email: email,
              password: password, // Note: In production, hash passwords before storing
              created_at: new Date().toISOString(),
              account_approval: 'Wait',
            }
          ])
          .select()
          .single()

        if (insertError) {
          setError(insertError.message || 'Failed to create account. Please try again.')
          setIsLoading(false)
          return
        }

        if (data) {
          // Store user ID in localStorage
          localStorage.setItem('userId', data.id)
          localStorage.setItem('userFriendlyId', data.user_id || '')
          localStorage.setItem('userEmail', email)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userRole', data.role || 'supplier')
          
          // Check user role and redirect accordingly
          const userRole = data.role || 'supplier'
          if (userRole === 'admin') {
            router.push('/dashboard')
          } else if (userRole === 'agent') {
            router.push('/listings')
          } else {
            router.push('/onboarding')
          }
        } else {
          setError('Failed to create account. Please try again.')
          setIsLoading(false)
        }
      } else {
        // Login flow
        // First, check if user exists in Supabase
        const { data: existingUser, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (fetchError) {
          // User doesn't exist
          if (fetchError.code === 'PGRST116') {
            setError('Account not found. Please sign up first to create an account.')
            setIsLoading(false)
            return
          } else {
            setError(fetchError.message || 'An error occurred. Please try again.')
            setIsLoading(false)
            return
          }
        }

        if (existingUser) {
          // Check if account is deleted
          if (existingUser.archived === true) {
            setError('Account not found. Please sign up first to create an account.')
            setIsLoading(false)
            return
          }

          // User exists, verify password
          if (!existingUser.password || existingUser.password !== password) {
            setError('Invalid email or password')
            setIsLoading(false)
            return
          }

          // Password matches - login successful
          localStorage.setItem('userId', existingUser.id)
          localStorage.setItem('userFriendlyId', existingUser.user_id || '')
          localStorage.setItem('userEmail', email)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userRole', existingUser.role || 'supplier')
          
          // Check user role and redirect accordingly
          const userRole = existingUser.role || 'supplier'
          if (userRole === 'admin') {
            router.push('/dashboard')
          } else if (userRole === 'agent') {
            router.push('/listings')
          } else if (existingUser.onboarded) {
            // Check account approval status for suppliers
            const accountApproval = existingUser.account_approval
            
            if (accountApproval === 'Approved') {
              router.push('/dashboard')
            } else if (accountApproval === 'Refused') {
              setPopupMessage('Thank you for your interest in becoming a Zambeel supplier. Your account has been refused due to invalid or incomplete information.')
              setError('')
              setIsLoading(false)
              return
            } else {
              // Status is 'Wait' or null
              setPopupMessage('Your account approval is pending. Please wait for admin approval for sign in on the portal and listing your products.')
              setError('')
              setIsLoading(false)
              return
            }
          } else {
            router.push('/onboarding')
          }
          setIsLoading(false)
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }



  const countryFlags = [
    { code: 'pk', initials: 'PK', name: 'Pakistan' },
    { code: 'ae', initials: 'AE', name: 'United Arab Emirates' },
    { code: 'sa', initials: 'SA', name: 'Saudi Arabia' },
    { code: 'qa', initials: 'QA', name: 'Qatar' },
    { code: 'kw', initials: 'KW', name: 'Kuwait' },
    { code: 'bh', initials: 'BH', name: 'Bahrain' },
    { code: 'om', initials: 'OM', name: 'Oman' },
    { code: 'iq', initials: 'IQ', name: 'Iraq' },
  ]

  return (
    <div className="flex flex-col min-h-screen w-full bg-gray-50">
      {/* Top bar - 3D futuristic purple strip */}
      <header
        className="relative flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-20 sm:h-24 w-full text-white overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 18%, #7c3aed 45%, #6d28d9 72%, #5b21b6 100%)',
          boxShadow: [
            'inset 0 2px 0 rgba(255,255,255,0.35)',
            'inset 0 -2px 0 rgba(0,0,0,0.2)',
            '0 0 40px rgba(124, 58, 237, 0.25)',
          ].join(', '),
          borderBottom: '2px solid rgba(34, 211, 238, 0.6)',
        }}
      >
        {/* Futuristic top edge highlight */}
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}
        />
        {/* Full-width cyan glow strip at bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 pointer-events-none w-full"
          style={{
            background: 'linear-gradient(90deg, rgba(34, 211, 238, 0.7), rgba(34, 211, 238, 0.9), rgba(34, 211, 238, 0.7))',
            boxShadow: '0 0 16px rgba(34, 211, 238, 0.6)',
          }}
        />
        <div className="relative z-10 flex items-center justify-center w-full">
          <span className="text-base sm:text-lg md:text-x1 font-bold tracking-tight text-white drop-shadow-sm">
            Welcome to Zambeel
          </span>
        </div>
      </header>

      {/* Full-width 3D shadow band below header - ensures even depth across entire page */}
      <div
        className="w-full flex-shrink-0 pointer-events-none"
        style={{
          height: '12px',
          background: 'linear-gradient(180deg, #3b0764 0%, rgba(59, 7, 100, 0.4) 40%, transparent 100%)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />

      {/* Main content: Left panel + Right panel */}
      <div className="flex flex-1 flex-col md:flex-row min-h-0">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:flex-1 bg-gradient-to-br from-purple-50/50 via-white to-primary-blue/5 p-6 md:p-10 lg:p-16 flex-col justify-center relative border-r border-gray-200">
        <div className="relative z-10 max-w-[600px] animate-slide-in-left">
          <div className="flex items-center gap-3 mb-8 md:mb-12 lg:mb-16">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
              <Package size={28} className="md:w-8 md:h-8" strokeWidth={2} />
            </div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Zambeel Supplier Portal</h1>
          </div>
          
          <div className="mb-8 md:mb-10 lg:mb-14">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight text-gray-900 mb-4 md:mb-6 tracking-tight">
            Your Business from Offline to Online Starts Here
              <br />
              <span className="text-primary-blue animate-come-and-go inline-block">
                in the Pakistan, GCC Market and many more
              </span>
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-gray-600">
              Join the premier supplier portal for dropshipping excellence. 
              List your products, track performance, and grow your reach 
              across the Gulf region.
            </p>
          </div>

          {/* Country flags - moved from top bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-8 md:mb-10 lg:mb-14">
            {countryFlags.map(({ code, initials, name }) => (
              <div
                key={code}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/80 border border-gray-200 shadow-sm hover:shadow-md hover:scale-105 transition-all cursor-default group"
              >
                <span className="text-xs font-bold text-gray-700 tracking-wide uppercase group-hover:text-primary-blue transition-colors">
                  {initials}
                </span>
                <div className="rounded-md overflow-hidden border border-gray-200">
                  <img
                    src={`https://flagcdn.com/w40/${code}.png`}
                    srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
                    alt={name}
                    width={40}
                    height={30}
                    className="h-7 w-10 sm:h-9 sm:w-14 object-cover block"
                    loading="lazy"
                  />
                </div>
                <span className="text-[10px] sm:text-xs text-gray-500 font-medium">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-16">
        <div className="w-full max-w-[480px] mr-8 lg:mr-16 animate-slide-in-right">
          {/* Form card with blue border on all sides */}
          <div className="relative flex flex-col bg-white rounded-2xl shadow-xl border-4 border-primary-blue p-6 sm:p-8 md:p-10">
          <div className="text-center mb-8 md:mb-10">
            {/* Mobile Logo - Only visible on mobile */}
            <div className="md:hidden flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
                <Package size={24} strokeWidth={2} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Zambeel Supplier Portal</h1>
            </div>
            
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 md:mb-3 tracking-tight">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-sm md:text-base text-gray-600">
              {isSignUp ? 'Sign up to become a supplier' : 'Sign in to your supplier account'}
            </p>
          </div>

          {error && (
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="flex-shrink-0 w-5 h-5 text-red-500 mt-0.5" />
              <p className="text-xs md:text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Popup for account status messages (refused / pending) */}
          {popupMessage && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true" role="dialog">
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-primary-blue/20">
                <button
                  type="button"
                  onClick={() => setPopupMessage(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
                <div className="flex items-start gap-3 pr-8">
                  <AlertCircle className="flex-shrink-0 w-8 h-8 text-primary-blue mt-0.5" />
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">{popupMessage}</p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPopupMessage(null)}
                    className="py-2.5 px-5 text-sm font-semibold text-white bg-primary-blue rounded-xl hover:bg-primary-blue/90 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mb-6 md:mb-8">
            <div className="mb-4 md:mb-6">
              <label htmlFor="email" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 md:left-4 text-gray-400 pointer-events-none" size={18} />
                <input
                  id="email"
                  type="email"
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                  placeholder="supplier@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-4 md:mb-6">
              <label htmlFor="password" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 md:left-4 text-gray-400 pointer-events-none" size={18} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                  placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignUp ? 6 : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 md:right-4 p-1 text-gray-400 hover:text-primary-blue transition-colors flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="mb-4 md:mb-6">
                <label htmlFor="confirmPassword" className="block text-xs md:text-sm font-semibold text-gray-900 mb-2">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 md:left-4 text-gray-400 pointer-events-none" size={18} />
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 md:right-4 p-1 text-gray-400 hover:text-primary-blue transition-colors flex items-center justify-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {!isSignUp && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 md:mb-6">
                <label className="flex items-center gap-2 text-xs md:text-sm text-gray-600 cursor-pointer py-1">
                  <input type="checkbox" className="w-4 h-4 md:w-[18px] md:h-[18px] border-2 border-gray-300 rounded cursor-pointer accent-purple-600 focus:ring-2 focus:ring-purple-500/30" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-xs md:text-sm text-primary-blue font-semibold hover:text-primary-blue-dark transition-colors py-2 px-1 -m-1 rounded hover:bg-primary-blue/5">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3.5 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                isLoading
                  ? 'opacity-70 cursor-not-allowed bg-primary-blue shadow-lg'
                  : 'bg-primary-blue shadow-[0_4px_14px_rgba(74,159,245,0.4)] hover:bg-primary-blue/90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] active:translate-y-0'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-[3px] border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Next' : 'Sign In'}</span>
                  <ArrowRight size={18} className="md:w-5 md:h-5" />
                </>
              )}
            </button>
            <p className="flex items-center justify-center gap-2 mt-4 text-xs text-gray-500">
              <Lock size={14} className="text-gray-400" />
              <span>Secure login</span>
            </p>
          </form>

          <div className="text-center mt-6">
            <p className="text-xs md:text-sm text-gray-600">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      setIsSignUp(false)
                      setError('')
                      setPopupMessage(null)
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-primary-blue font-semibold hover:text-primary-blue-dark hover:underline transition-colors inline-block py-2 px-1 -m-1 rounded hover:bg-primary-blue/5"
                  >
                    Sign in
                  </a>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{' '}
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault()
                      setIsSignUp(true)
                      setError('')
                      setPopupMessage(null)
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-primary-blue font-semibold hover:text-primary-blue-dark hover:underline transition-colors inline-block py-2 px-1 -m-1 rounded hover:bg-primary-blue/5"
                  >
                    Sign up as a supplier
                  </a>
                </>
              )}
            </p>
          </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}