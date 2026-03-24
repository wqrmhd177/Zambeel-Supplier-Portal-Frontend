'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { setSessionCookie, updateLastActivity } from '@/lib/authCookie'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [popupMessage, setPopupMessage] = useState<string | null>(null)

  const getApprovalFlags = (value: unknown) => {
    const normalized = String(value || '').trim().toLowerCase()
    // Be tolerant to values like "Approved ", "approved_by_admin", "Refused by team".
    const isApproved =
      normalized === 'approved' ||
      normalized.includes('approved') ||
      normalized.startsWith('approv') ||
      normalized === 'accept' ||
      normalized.includes('accept')
    const isRefused = normalized === 'refused' || normalized.includes('refus')
    return { normalized, isApproved, isRefused }
  }

  const hasSubmittedOnboarding = (u: any) => {
    const hasFullName = String(u?.full_name || '').trim().length > 0
    const hasShopName = String(u?.shop_name_on_zambeel || u?.shop_name || '').trim().length > 0
    const hasPhone = String(u?.phone_number || '').trim().length > 0
    const hasCountry = String(u?.country || '').trim().length > 0
    return hasFullName || hasShopName || hasPhone || hasCountry
  }

  // Handle redirect messages from security checks
  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'refused') {
      setPopupMessage('Thank you for your interest in becoming a Zambeel supplier. Your account has been refused due to invalid or incomplete information.')
      setIsSignUp(false)
    } else if (reason === 'pending') {
      setPopupMessage('Your account approval is pending. Please wait for admin approval to access the portal.')
      setIsSignUp(false)
    } else if (reason === 'timeout') {
      setPopupMessage('Your session has expired due to inactivity. Please sign in again to continue.')
      setIsSignUp(false)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    try {
      const emailNormalized = email.trim().toLowerCase()
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
          .ilike('email', emailNormalized)
          .maybeSingle()

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
              localStorage.setItem('userEmail', emailNormalized)
              localStorage.setItem('isLoggedIn', 'true')
              localStorage.setItem('userRole', String(restoredUser.role || 'supplier').trim().toLowerCase())
              setSessionCookie()
              updateLastActivity() // Initialize activity tracking
              localStorage.removeItem('isOnboarded') // Clear onboarding flag
              localStorage.removeItem('supplierInfo') // Clear old supplier info
              
              // Restored accounts always go to onboarding (onboarded was reset to false)
              // Account approval will be checked after they complete onboarding
              router.push('/onboarding')
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
        if (checkError) {
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
              email: emailNormalized,
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
          localStorage.setItem('userEmail', emailNormalized)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userRole', String(data.role || 'supplier').trim().toLowerCase())
          setSessionCookie()
          updateLastActivity() // Initialize activity tracking
          
          // Check user role and redirect accordingly
          const userRole = String(data.role || 'supplier').trim().toLowerCase()
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
        const { data: matchingUsers, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .ilike('email', emailNormalized)
          .limit(50)

        if (fetchError) {
          setError(fetchError.message || 'An error occurred. Please try again.')
          setIsLoading(false)
          return
        }

        const users = (matchingUsers as any[] | null)?.filter(Boolean) || []
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H1',location:'login/page.tsx:users-fetched',message:'Fetched matching users for login',data:{count:users.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (users.length === 0) {
          setError('Account not found. Please sign up first to create an account.')
          setIsLoading(false)
          return
        }

        // If there are duplicates with same email, prefer the best candidate:
        // - not archived
        // - supplier/admin/agent (any role), but for suppliers prefer onboarded + approved
        // - newest updated/created as last tie-breaker
        const candidates = users.filter(u => u.archived !== true)
        const pickBest = (arr: any[]) => {
          const getPriority = (u: any) => {
            const role = String(u.role || 'supplier').trim().toLowerCase()
            const onboarded = u.onboarded === true || String(u.onboarded || '').trim().toLowerCase() === 'true'
            const profileSubmitted = hasSubmittedOnboarding(u)
            const { isApproved } = getApprovalFlags(u.account_approval)
            const updatedOrCreated = Math.max(Date.parse(u.updated_at || '') || 0, Date.parse(u.created_at || '') || 0)

            // IMPORTANT:
            // Keep status priority separate from timestamp so "newest" does not override
            // approved/onboarded supplier records.
            return {
              isSupplier: role === 'supplier' ? 1 : 0,
              isApproved: isApproved ? 1 : 0,
              isOnboarded: onboarded ? 1 : 0,
              isProfileSubmitted: profileSubmitted ? 1 : 0,
              updatedOrCreated,
            }
          }

          return arr.slice().sort((a, b) => {
            const pa = getPriority(a)
            const pb = getPriority(b)
            if (pb.isSupplier !== pa.isSupplier) return pb.isSupplier - pa.isSupplier
            if (pb.isApproved !== pa.isApproved) return pb.isApproved - pa.isApproved
            if (pb.isOnboarded !== pa.isOnboarded) return pb.isOnboarded - pa.isOnboarded
            if (pb.isProfileSubmitted !== pa.isProfileSubmitted) return pb.isProfileSubmitted - pa.isProfileSubmitted
            return pb.updatedOrCreated - pa.updatedOrCreated
          })[0]
        }
        const pool = candidates.length ? candidates : users
        // IMPORTANT: avoid selecting the wrong duplicate user row by first narrowing
        // to rows that match entered password.
        const passwordMatchedPool = pool.filter(
          (u) => typeof u.password === 'string' && u.password === password
        )
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H1',location:'login/page.tsx:pool-selection',message:'Prepared candidate pools',data:{candidatesCount:candidates.length,poolCount:pool.length,passwordMatchedCount:passwordMatchedPool.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        const existingUser = pickBest(passwordMatchedPool.length > 0 ? passwordMatchedPool : pool)

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

          // Check user role and approval status BEFORE setting session
          const userRole = String(existingUser.role || 'supplier').trim().toLowerCase()

          const onboarded = existingUser.onboarded === true || String(existingUser.onboarded || '').trim().toLowerCase() === 'true'
          const profileSubmitted = hasSubmittedOnboarding(existingUser)
          const { isApproved, isRefused } = getApprovalFlags(existingUser.account_approval)
          // #region agent log
          fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H2',location:'login/page.tsx:selected-user-flags',message:'Computed selected user flags',data:{selectedId:existingUser.id,role:userRole,onboarded,profileSubmitted,isApproved,isRefused,approvalRaw:String(existingUser.account_approval||'')},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          
          // For suppliers who have completed onboarding, check account approval status
          if (userRole === 'supplier' && (onboarded || profileSubmitted)) {
            if (isRefused) {
              setPopupMessage('Thank you for your interest in becoming a Zambeel supplier. Your account has been refused due to invalid or incomplete information.')
              setError('')
              setIsLoading(false)
              return
            }
            
            if (!isApproved) {
              // Status is 'Wait' or null - pending approval
              setPopupMessage('Your account approval is pending. Please wait for admin approval for sign in on the portal and listing your products.')
              setError('')
              setIsLoading(false)
              return
            }
          }

          // Password matches and approval check passed - set session and login
          localStorage.setItem('userId', existingUser.id)
          localStorage.setItem('userFriendlyId', existingUser.user_id || '')
          localStorage.setItem('userEmail', emailNormalized)
          localStorage.setItem('isLoggedIn', 'true')
          localStorage.setItem('userRole', userRole)
          setSessionCookie()
          updateLastActivity() // Initialize activity tracking
          
          // Redirect based on role
        if (userRole === 'admin') {
            // #region agent log
            fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H3',location:'login/page.tsx:redirect-admin',message:'Redirecting after login',data:{target:'/dashboard'},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          router.push('/dashboard')
        } else if (userRole === 'agent') {
            // #region agent log
            fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H3',location:'login/page.tsx:redirect-agent',message:'Redirecting after login',data:{target:'/listings'},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          router.push('/listings')
        } else if (
          userRole === 'supplier' &&
          (onboarded || isApproved || profileSubmitted)
        ) {
          // Supplier with approved account (treat as fully onboarded even if onboarded flag is false)
            // #region agent log
            fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H3',location:'login/page.tsx:redirect-supplier-dashboard',message:'Redirecting supplier to dashboard',data:{target:'/dashboard',onboarded,isApproved,profileSubmitted},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
          router.push('/dashboard')
        } else {
          // Supplier who hasn't completed onboarding and is not approved yet
            // #region agent log
            fetch('http://127.0.0.1:7756/ingest/0c97606a-7195-44e5-871e-555d45712b4d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b6669e'},body:JSON.stringify({sessionId:'b6669e',runId:'login-flow',hypothesisId:'H3',location:'login/page.tsx:redirect-onboarding',message:'Redirecting supplier to onboarding',data:{target:'/onboarding',onboarded,isApproved,profileSubmitted,role:userRole},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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
      {/* Top bar - 3D futuristic violet/purple strip */}
      <header
        className="relative flex-shrink-0 flex items-center justify-between px-4 sm:px-6 h-20 sm:h-24 w-full text-white overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #a78bfa 0%, #8b5cf6 18%, #7c3aed 45%, #6d28d9 72%, #5b21b6 100%)',
          boxShadow: [
            'inset 0 2px 0 rgba(255,255,255,0.35)',
            'inset 0 -2px 0 rgba(0,0,0,0.2)',
            '0 0 40px rgba(124, 58, 237, 0.25)',
          ].join(', '),
          borderBottom: '2px solid rgba(139, 92, 246, 0.6)',
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
            background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.7), rgba(99, 102, 241, 0.9), rgba(99, 102, 241, 0.7))',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.6)',
          }}
        />
        <div className="relative z-10 flex items-center justify-center w-full">
          <div className="relative inline-block h-10 sm:h-12 md:h-14 lg:h-16 flex items-center">
            <img
              src="/Zambeel LOGO Yellow dots.png"
              alt="Zambeel"
              className="h-full w-auto object-contain object-center drop-shadow-sm"
            />
          </div>
        </div>
      </header>

      {/* Full-width 3D shadow band below header - ensures even depth across entire page */}
      <div
        className="w-full flex-shrink-0 pointer-events-none"
        style={{
          height: '12px',
          background: 'linear-gradient(180deg, #5b21b6 0%, rgba(91, 33, 182, 0.4) 40%, transparent 100%)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />

      {/* Main content: Left panel + Right panel */}
      <div className="flex flex-1 flex-col md:flex-row min-h-0">
      {/* Left Panel - Branding */}
      <div className="hidden md:flex md:flex-1 bg-gradient-to-br from-violet-50/50 via-white to-indigo-50/50 p-6 md:p-10 lg:p-16 flex-col justify-center relative border-r border-gray-200">
        <div className="relative z-10 max-w-[600px] animate-slide-in-left">
          <div className="flex items-center gap-3 mb-8 md:mb-12 lg:mb-16">
            <div className="h-10 w-auto md:h-12 flex items-center shrink-0">
              <img src="/zambeel-logo.png" alt="Zambeel" className="h-full w-auto object-contain" />
            </div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 tracking-tight">Welcome to Supplier Portal</h1>
          </div>
          
          <div className="mb-8 md:mb-10 lg:mb-14">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold leading-tight text-gray-900 mb-4 md:mb-6 tracking-tight">
            Your Business from Offline to Online Starts Here
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent animate-come-and-go inline-block">
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
                <span className="text-xs font-bold text-gray-700 tracking-wide uppercase group-hover:text-violet-600 transition-colors">
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
          {/* Form card with indigo border on all sides */}
          <div className="relative flex flex-col bg-white rounded-2xl shadow-xl border-4 border-indigo-500 p-6 sm:p-8 md:p-10">
          <div className="text-center mb-8 md:mb-10">
            {/* Mobile Logo - Only visible on mobile */}
            <div className="md:hidden flex items-center justify-center gap-3 mb-6">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
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
              <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 md:p-8 border-2 border-indigo-500/20">
                <button
                  type="button"
                  onClick={() => setPopupMessage(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
                <div className="flex items-start gap-3 pr-8">
                  <AlertCircle className="flex-shrink-0 w-8 h-8 text-violet-600 mt-0.5" />
                  <p className="text-sm md:text-base text-gray-700 leading-relaxed">{popupMessage}</p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPopupMessage(null)}
                    className="py-2.5 px-5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl hover:opacity-90 transition-all"
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
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] focus:outline-none placeholder:text-gray-400"
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
                  className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] focus:outline-none placeholder:text-gray-400"
                  placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignUp ? 6 : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 md:right-4 p-1 text-gray-400 hover:text-violet-600 transition-colors flex items-center justify-center"
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
                    className="w-full py-3 md:py-3.5 px-3 md:px-4 pl-10 md:pl-12 text-sm md:text-[15px] border-2 border-gray-200 rounded-xl bg-white text-gray-900 transition-all duration-200 focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.1)] focus:outline-none placeholder:text-gray-400"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 md:right-4 p-1 text-gray-400 hover:text-violet-600 transition-colors flex items-center justify-center"
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
                <a href="#" className="text-xs md:text-sm text-violet-600 font-semibold hover:text-indigo-700 transition-colors py-2 px-1 -m-1 rounded hover:bg-violet-50">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3.5 md:py-4 px-4 md:px-6 text-sm md:text-base font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
                isLoading
                  ? 'opacity-70 cursor-not-allowed bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_4px_14px_rgba(139,92,246,0.4)] hover:opacity-90 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(139,92,246,0.5)] active:translate-y-0'
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 md:w-5 md:h-5 border-2 md:border-[3px] border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{isSignUp ? 'Next' : 'Signing in...'}</span>
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
                      // Don't clear popup if it's from a redirect reason
                      if (!searchParams.get('reason')) {
                        setPopupMessage(null)
                      }
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-violet-600 font-semibold hover:text-indigo-700 hover:underline transition-colors inline-block py-2 px-1 -m-1 rounded hover:bg-violet-50"
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
                      // Don't clear popup if it's from a redirect reason
                      if (!searchParams.get('reason')) {
                        setPopupMessage(null)
                      }
                      setPassword('')
                      setConfirmPassword('')
                    }}
                    className="text-violet-600 font-semibold hover:text-indigo-700 hover:underline transition-colors inline-block py-2 px-1 -m-1 rounded hover:bg-violet-50"
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

function LoginFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="animate-pulse text-violet-600 font-medium">Loading...</div>
    </div>
  )
}

export default function Login() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}