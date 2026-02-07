/**
 * Session cookie used by middleware to protect routes.
 * Set on login, cleared on logout. Middleware redirects to /login if missing on protected routes.
 */
const COOKIE_NAME = 'supplier_session'
const MAX_AGE_DAYS = 7

// Idle timeout: 12 hours of inactivity
export const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000 // 12 hours in milliseconds

export function setSessionCookie(): void {
  if (typeof document === 'undefined') return
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

/**
 * Update the last activity timestamp to track user activity
 */
export function updateLastActivity(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('lastActivityTime', Date.now().toString())
}

/**
 * Check if the session has been idle for too long
 * Returns true if session should be terminated due to inactivity
 */
export function isSessionIdle(): boolean {
  if (typeof localStorage === 'undefined') return false
  
  const lastActivityStr = localStorage.getItem('lastActivityTime')
  if (!lastActivityStr) return false
  
  const lastActivity = parseInt(lastActivityStr, 10)
  const idleTime = Date.now() - lastActivity
  
  return idleTime > IDLE_TIMEOUT_MS
}

export { COOKIE_NAME }
