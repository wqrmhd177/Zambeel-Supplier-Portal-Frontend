'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

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
              setError('Thank you for your interest in becoming a Zambeel supplier. Your account has been refused due to invalid or incomplete information.')
              setIsLoading(false)
              return
            } else {
              // Status is 'Wait' or null
              setError('Your account approval is pending. Please wait for admin approval for sign in on the portal and listing your products.')
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



  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full bg-gray-50">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:flex-1 bg-white p-6 md:p-10 lg:p-16 flex-col justify-center relative border-r border-gray-200">
        <div className="relative z-10 max-w-[600px] animate-slide-in-left">
          <div className="flex items-center gap-3 mb-8 md:mb-12 lg:mb-16">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-primary-blue/10 rounded-xl flex items-center justify-center text-primary-blue">
              <Package size={28} className="md:w-8 md:h-8" strokeWidth={2} />
            </div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Zambeel Supplier Portal</h1>
          </div>
          
          <div className="mb-8 md:mb-10 lg:mb-14">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-gray-900 mb-4 md:mb-6 tracking-tight">
            Your Business from Offline to Online Starts Here
              <br />
              <span className="text-primary-blue">
                in the Pakistan, GCC Market and many more
              </span>
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-gray-600">
              Join the premier supplier portal for dropshipping excellence. 
              List your products, track performance, and grow your reach 
              across the Gulf region.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10 lg:mb-14">
            {[
              {
                icon: <Package size={20} />,
                title: 'Easy Product Listing',
                desc: 'Upload and manage your products with our intuitive interface'
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>,
                title: 'Real-Time Analytics',
                desc: 'Track your product performance and sales metrics instantly'
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>,
                title: 'GCC Market Access',
                desc: 'Connect with customers across the entire Gulf region'
              },
              {
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>,
                title: 'Secure & Reliable',
                desc: 'Enterprise-grade security for your business data'
              }
            ].map((feature, idx) => (
              <div key={idx} className="flex gap-3 md:gap-4 items-start">
                <div className="w-10 h-10 md:w-11 md:h-11 min-w-[40px] md:min-w-[44px] bg-primary-blue/10 rounded-lg flex items-center justify-center text-primary-blue">
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-sm md:text-base font-semibold text-gray-900 mb-1">{feature.title}</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between p-6 md:p-8 bg-gray-50 rounded-2xl border border-gray-200 gap-4 md:gap-0">
            <div className="text-center flex-1">
              <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-2 tracking-tight">10,000+</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">Active Suppliers</div>
            </div>
            <div className="hidden md:block w-px h-10 bg-gray-200" />
            <div className="text-center flex-1">
              <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-2 tracking-tight">50K+</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">Products Listed</div>
            </div>
            <div className="hidden md:block w-px h-10 bg-gray-200" />
            <div className="text-center flex-1">
              <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-2 tracking-tight">10M+</div>
              <div className="text-xs md:text-sm text-gray-600 font-medium">Number of Orders</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 bg-white flex items-center justify-center p-6 sm:p-8 md:p-10 lg:p-16">
        <div className="w-full max-w-[480px] animate-slide-in-right">
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
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <p className="text-xs md:text-sm text-red-600 font-medium">{error}</p>
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
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
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
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
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
                    className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all focus:border-primary-blue focus:shadow-[0_0_0_4px_rgba(74,159,245,0.1)] focus:outline-none placeholder:text-gray-400"
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
                <label className="flex items-center gap-2 text-xs md:text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 md:w-[18px] md:h-[18px] border-2 border-gray-300 rounded cursor-pointer accent-primary-blue" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-xs md:text-sm text-primary-blue font-semibold hover:text-primary-blue-dark transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-white bg-gradient-to-r from-[#5BA3F5] to-[#4A9FF5] rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(74,159,245,0.4)] transition-all ${
                isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(74,159,245,0.5)] active:translate-y-0'
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
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={18} className="md:w-5 md:h-5" />
                </>
              )}
            </button>
          </form>

          <div className="text-center">
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
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-primary-blue font-semibold hover:text-primary-blue-dark hover:underline transition-colors"
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
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-primary-blue font-semibold hover:text-primary-blue-dark hover:underline transition-colors"
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
  )
}