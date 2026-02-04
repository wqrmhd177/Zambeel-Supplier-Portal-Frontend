/**
 * Session cookie used by middleware to protect routes.
 * Set on login, cleared on logout. Middleware redirects to /login if missing on protected routes.
 */
const COOKIE_NAME = 'supplier_session'
const MAX_AGE_DAYS = 7

export function setSessionCookie(): void {
  if (typeof document === 'undefined') return
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

export { COOKIE_NAME }
