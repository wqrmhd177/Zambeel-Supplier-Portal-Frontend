// Formatting utilities for onboarding form

import { getCountryData } from './countryData'

/**
 * Format ID number based on country (digits only, no dashes)
 */
export const formatIDNumber = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const digitsOnly = value.replace(/\D/g, '')

  if (country === 'Pakistan') {
    return digitsOnly.slice(0, 13)
  } else if (country === 'United Arab Emirates') {
    return digitsOnly.slice(0, 15)
  } else if (country === 'Saudia Arabia') {
    return digitsOnly.slice(0, 10)
  } else if (country === 'Qatar') {
    return digitsOnly.slice(0, 9)
  } else if (country === 'Kuwait') {
    return digitsOnly.slice(0, 12)
  } else if (country === 'Bahrain') {
    return digitsOnly.slice(0, 9)
  } else if (country === 'Oman') {
    return digitsOnly.slice(0, 9)
  } else if (country === 'Iraq') {
    return digitsOnly.slice(0, 12)
  }

  return value
}

/**
 * Format phone number based on country (no dashes: +923001234567)
 */
export const formatPhoneNumber = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const digitsOnly = value.replace(/\D/g, '')
  const { countryCode, maxDigits } = countryData.phone
  const maxLen = countryCode.length + maxDigits

  if (digitsOnly.startsWith(countryCode)) {
    const numberPart = digitsOnly.slice(countryCode.length).slice(0, maxDigits)
    return `+${countryCode}${numberPart}`
  }
  if (digitsOnly.length > 0) {
    return `+${digitsOnly.slice(0, maxLen)}`
  }
  return value.replace(/[^\d+]/g, '')
}

/**
 * Format IBAN based on country (no spaces/dashes: PK36MEZN0000001234567890)
 */
export const formatIBAN = (value: string, country: string): string => {
  const countryData = getCountryData(country)
  if (!countryData) return value

  const cleanValue = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const { countryCode, maxLength } = countryData.iban

  if (cleanValue.startsWith(countryCode)) {
    return cleanValue.slice(0, maxLength)
  }
  return cleanValue.slice(0, maxLength)
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
 * Validate phone number based on country (accepts +923001234567, no dash required)
 */
export const validatePhoneNumber = (value: string, country: string): boolean => {
  const countryData = getCountryData(country)
  if (!countryData) return false

  const digitsOnly = value.replace(/\D/g, '')
  const expectedLength = countryData.phone.countryCode.length + countryData.phone.maxDigits

  return value.startsWith('+') && digitsOnly.startsWith(countryData.phone.countryCode) && digitsOnly.length === expectedLength
}

/**
 * Validate IBAN based on country (accepts with or without spaces)
 */
export const validateIBAN = (value: string, country: string): boolean => {
  const countryData = getCountryData(country)
  if (!countryData) return false

  const cleanValue = value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const expectedLength = countryData.iban.maxLength

  return cleanValue.startsWith(countryData.iban.countryCode) && cleanValue.length === expectedLength
}

