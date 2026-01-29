// Formatting utilities for onboarding form

import { getCountryData } from './countryData'

/**
 * Format ID number based on country
 */
export const formatIDNumber = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const digitsOnly = value.replace(/\D/g, '')

  if (country === 'Pakistan') {
    // Format: xxxxx-xxxxxxx-x (13 digits)
    if (digitsOnly.length > 13) return formatIDNumber(digitsOnly.slice(0, 13), country)
    
    if (digitsOnly.length > 5 && digitsOnly.length <= 12) {
      return digitsOnly.slice(0, 5) + '-' + digitsOnly.slice(5)
    } else if (digitsOnly.length > 12) {
      return digitsOnly.slice(0, 5) + '-' + digitsOnly.slice(5, 12) + '-' + digitsOnly.slice(12)
    }
    return digitsOnly
  } else if (country === 'United Arab Emirates') {
    // Format: 784-XXXX-XXXXXXX-X (15 digits total)
    // Restrict to 15 digits
    const restricted = digitsOnly.slice(0, 15)
    
    if (restricted.length <= 3) {
      return restricted
    } else if (restricted.length <= 7) {
      return restricted.slice(0, 3) + '-' + restricted.slice(3)
    } else if (restricted.length <= 14) {
      return restricted.slice(0, 3) + '-' + restricted.slice(3, 7) + '-' + restricted.slice(7)
    } else {
      return restricted.slice(0, 3) + '-' + restricted.slice(3, 7) + '-' + restricted.slice(7, 14) + '-' + restricted.slice(14)
    }
  } else if (country === 'Saudia Arabia') {
    // Format: 10 digits (no formatting)
    return digitsOnly.slice(0, 10)
  } else if (country === 'Qatar') {
    // Format: 9 digits (no formatting)
    return digitsOnly.slice(0, 9)
  } else if (country === 'Kuwait') {
    // Format: 12 digits (no formatting)
    return digitsOnly.slice(0, 12)
  } else if (country === 'Bahrain') {
    // Format: 9 digits (no formatting)
    return digitsOnly.slice(0, 9)
  } else if (country === 'Oman') {
    // Format: 9 digits (no formatting)
    return digitsOnly.slice(0, 9)
  }

  return value
}

/**
 * Format phone number based on country
 */
export const formatPhoneNumber = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const cleanValue = value.replace(/[^\d+\-]/g, '')
  const { countryCode, maxDigits, format } = countryData.phone

  // Check if starts with country code (with or without +)
  const hasPlus = cleanValue.startsWith('+')
  const startsWithCode = cleanValue.startsWith(`+${countryCode}`) || cleanValue.startsWith(countryCode)

  if (startsWithCode) {
    // Extract the number part after country code
    let numberPart: string
    if (cleanValue.startsWith(`+${countryCode}-`)) {
      numberPart = cleanValue.slice(countryCode.length + 2).replace(/\D/g, '')
    } else if (cleanValue.startsWith(`+${countryCode}`)) {
      numberPart = cleanValue.slice(countryCode.length + 1).replace(/\D/g, '')
    } else if (cleanValue.startsWith(`${countryCode}-`)) {
      numberPart = cleanValue.slice(countryCode.length + 1).replace(/\D/g, '')
    } else {
      numberPart = cleanValue.slice(countryCode.length).replace(/\D/g, '')
    }

    // Restrict to max digits
    if (numberPart.length > maxDigits) {
      numberPart = numberPart.slice(0, maxDigits)
    }

    // Format the number part
    const formatted = format(numberPart)
    return `+${countryCode}-${formatted}`
  }

  // No country code yet, just return as-is
  return cleanValue
}

/**
 * Format IBAN based on country
 */
export const formatIBAN = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const cleanValue = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const { countryCode, maxLength } = countryData.iban

  // Check if starts with country code
  if (cleanValue.startsWith(countryCode)) {
    // Restrict to max length (total length including country code)
    const restricted = cleanValue.slice(0, maxLength)
    
    // Extract the number part after country code for formatting
    const numberPart = restricted.slice(countryCode.length)
    
    // Format with spaces in groups of 4
    let formatted = ''
    for (let i = 0; i < numberPart.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' '
      }
      formatted += numberPart[i]
    }
    
    return countryCode + (formatted.length > 0 ? ' ' + formatted : '')
  }

  // No country code yet, just return as-is
  return cleanValue
}

/**
 * Validate ID number based on country
 */
export const validateIDNumber = (value: string, country: string): boolean => {
  const countryData = getCountryData(country)
  if (!countryData) return false
  
  return countryData.idNumber.validate(value)
}

/**
 * Validate phone number based on country
 */
export const validatePhoneNumber = (value: string, country: string): boolean => {
  const countryData = getCountryData(country)
  if (!countryData) return false

  const digitsOnly = value.replace(/\D/g, '')
  const expectedLength = countryData.phone.countryCode.length + countryData.phone.maxDigits
  
  return value.startsWith(`+${countryData.phone.countryCode}-`) && digitsOnly.length === expectedLength
}

/**
 * Validate IBAN based on country
 */
export const validateIBAN = (value: string, country: string): boolean => {
  const countryData = getCountryData(country)
  if (!countryData) return false

  const cleanValue = value.replace(/\s/g, '').toUpperCase()
  const expectedLength = countryData.iban.maxLength
  
  return cleanValue.startsWith(countryData.iban.countryCode) && cleanValue.length === expectedLength
}

