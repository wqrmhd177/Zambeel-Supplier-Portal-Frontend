/**
 * Session cookie is now set server-side (HttpOnly, Secure, SameSite=Strict)
 * via /api/auth/login and /api/auth/signup routes.
 *
 * This module keeps the client-side helpers for activity tracking and logout.
 */
export const COOKIE_NAME = 'supplier_session'

// Idle timeout: 12 hours — must match COOKIE_MAX_AGE in the server auth routes
export const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000

/**
 * @deprecated Cookie is now set HttpOnly by the server.
 * Kept for backward compatibility; calling it is a no-op.
 */
export function setSessionCookie(): void {
  // No-op: cookie is set server-side with HttpOnly flag
}

/**
 * Clear session cookie by calling the server-side logout route.
 * Also call clearSessionCookieClient() to clear the non-HttpOnly fallback if any.
 */
export async function clearSessionCookieAsync(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Best-effort
  }
}

/**
 * Synchronous logout helper that fires-and-forgets the server cookie clear.
 * Use in event handlers where async is inconvenient.
 */
export function clearSessionCookie(): void {
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
}

/**
 * Update the last activity timestamp to track user activity.
 */
export function updateLastActivity(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('lastActivityTime', Date.now().toString())
}

/**
 * Check if the session has been idle for too long.
 * Returns true if session should be terminated due to inactivity.
 */
export function isSessionIdle(): boolean {
  if (typeof localStorage === 'undefined') return false

  const lastActivityStr = localStorage.getItem('lastActivityTime')
  if (!lastActivityStr) return false

  const lastActivity = parseInt(lastActivityStr, 10)
  const idleTime = Date.now() - lastActivity

  return idleTime > IDLE_TIMEOUT_MS
}
