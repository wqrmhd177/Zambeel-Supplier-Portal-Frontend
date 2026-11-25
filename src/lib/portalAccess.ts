/** When true, only admin accounts may use the portal (set in Vercel: PORTAL_HOLD=1). */
export function isServerPortalHoldEnabled(): boolean {
  const v = process.env.PORTAL_HOLD?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** Client-side mirror (set NEXT_PUBLIC_PORTAL_HOLD=1 for the same hold). */
export function isClientPortalHoldEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_PORTAL_HOLD?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export function getAccountApprovalFlags(value: unknown): {
  isApproved: boolean
  isRefused: boolean
} {
  const normalized = String(value || '').trim().toLowerCase()
  const isApproved =
    normalized === 'approved' ||
    normalized.includes('approved') ||
    normalized.startsWith('approv') ||
    normalized === 'accept' ||
    normalized.includes('accept')
  const isRefused = normalized === 'refused' || normalized.includes('refus')
  return { isApproved, isRefused }
}

export function hasSubmittedSupplierOnboarding(u: {
  full_name?: string | null
  shop_name_on_zambeel?: string | null
  shop_name?: string | null
  phone_number?: string | null
  country?: string | null
}): boolean {
  const hasFullName = String(u?.full_name || '').trim().length > 0
  const hasShopName = String(u?.shop_name_on_zambeel || u?.shop_name || '').trim().length > 0
  const hasPhone = String(u?.phone_number || '').trim().length > 0
  const hasCountry = String(u?.country || '').trim().length > 0
  return hasFullName || hasShopName || hasPhone || hasCountry
}

/**
 * Whether this user may access the portal (login + session).
 * Admin always allowed unless portal hold excludes them (only admin allowed on hold).
 */
export function canAccessPortal(user: {
  role?: string | null
  account_approval?: string | null
  onboarded?: boolean | string | null
  full_name?: string | null
  shop_name_on_zambeel?: string | null
  shop_name?: string | null
  phone_number?: string | null
  country?: string | null
}, opts?: { portalHold?: boolean }): { ok: true } | { ok: false; reason: 'hold' | 'pending' | 'refused' } {
  const userRole = String(user.role || 'supplier').trim().toLowerCase()
  const hold = opts?.portalHold ?? isServerPortalHoldEnabled()

  if (hold) {
    if (userRole !== 'admin') return { ok: false, reason: 'hold' }
    return { ok: true }
  }

  if (userRole === 'admin') return { ok: true }

  const { isApproved, isRefused } = getAccountApprovalFlags(user.account_approval)
  const onboarded =
    user.onboarded === true || String(user.onboarded || '').trim().toLowerCase() === 'true'
  const isNewSupplierInOnboarding =
    userRole === 'supplier' &&
    !onboarded &&
    !hasSubmittedSupplierOnboarding(user)

  if (isNewSupplierInOnboarding) return { ok: true }

  if (isRefused) return { ok: false, reason: 'refused' }
  if (!isApproved) return { ok: false, reason: 'pending' }
  return { ok: true }
}

export function portalAccessDeniedMessage(reason: 'hold' | 'pending' | 'refused'): string {
  if (reason === 'hold') {
    return 'The supplier portal is temporarily unavailable. Please try again later or contact your administrator.'
  }
  if (reason === 'refused') {
    return 'Your account has been refused. Please contact support if you believe this is an error.'
  }
  return 'Your account approval is pending. Please wait for admin approval before signing in.'
}