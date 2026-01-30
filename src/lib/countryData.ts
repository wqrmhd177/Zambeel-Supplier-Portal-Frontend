// Country-specific data for onboarding form

// All countries for general dropdowns (stock location, bank country, exchange country)
export const ALL_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 
  'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
  'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 
  'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 
  'North Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 
  'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe'
] as const

// Countries with full form data (ID, phone, IBAN formatting)
export const COUNTRIES = ['Pakistan', 'United Arab Emirates', 'Saudia Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Iraq'] as const
export type Country = typeof COUNTRIES[number]

export const COUNTRY_DATA = {
  Pakistan: {
    cities: [
      'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 
      'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur', 
      'Sargodha', 'Sukkur', 'Larkana', 'Sheikhupura', 'Rahim Yar Khan', 
      'Jhang', 'Gujrat', 'Kasur', 'Mardan', 'Mingora', 'Nawabshah', 
      'Chiniot', 'Kotri', 'Kāmoke', 'Hafizabad', 'Kohat', 'Jacobabad', 
      'Shikarpur', 'Muzaffargarh', 'Khanewal', 'Hassan Abdal', 'Tando Adam', 
      'Jhelum', 'Sahiwal', 'Okara', 'Mirpur Khas', 'Chishtian', 'Dadu', 
      'Gojra', 'Mandi Bahauddin', 'Tando Allahyar', 'Daska', 'Pakpattan', 
      'Bahawalnagar', 'Tando Muhammad Khan', 'Khairpur', 'Chakwal', 'Badin', 
      'Arifwala', 'Ghotki', 'Sambrial', 'Jatoi', 'Haroonabad', 'Daharki', 
      'Narowal', 'Umerkot', 'Kot Addu', 'Shahdadkot', 'Shahdadpur', 
      'Mianwali', 'Lodhran', 'Bhakkar', 'Khuzdar', 'Other'
    ],
    banks: [
      'Meezan Bank', 'Habib Bank Limited (HBL)', 'United Bank Limited (UBL)', 
      'MCB Bank', 'Allied Bank', 'Bank Alfalah', 'Faysal Bank', 'Standard Chartered', 
      'JS Bank', 'Askari Bank', 'Bank of Punjab', 'Bank of Khyber', 'Sindh Bank', 
      'First Women Bank', 'Bank Islami', 'Dubai Islamic Bank Pakistan', 
      'Al Baraka Bank', 'Bank Al Habib', 'Finca Microfinance Bank', 
      'Khushhali Microfinance Bank', 'Telenor Microfinance Bank', 'U Microfinance Bank', 
      'National Bank of Pakistan', 'Soneri Bank', 'Summit Bank', 'Samba Bank', 
      'Silkbank', 'Zarai Taraqiati Bank Limited (ZTBL)', 'Other'
    ],
    phone: {
      placeholder: '+923001234567',
      hint: 'Include country code (e.g., +92)',
      countryCode: '92',
      maxDigits: 10,
      format: (digits: string) => digits.slice(0, 10)
    },
    iban: {
      placeholder: 'PK36MEZN0000001234567890',
      hint: 'Pakistan IBAN format: PK + 22 digits (24 characters total)',
      countryCode: 'PK',
      maxLength: 24
    },
    idNumber: {
      label: 'NIC Number (National Identity Number)',
      placeholder: '1234512345671',
      hint: '13 digits',
      maxLength: 15,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 13
      }
    }
  },
  'United Arab Emirates': {
    cities: [
      'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 
      'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Hatta', 'Other'
    ],
    banks: [
      'Emirates NBD', 'First Abu Dhabi Bank (FAB)', 'Abu Dhabi Commercial Bank (ADCB)', 
      'Dubai Islamic Bank (DIB)', 'Mashreq Bank', 'RAK Bank', 'Commercial Bank of Dubai', 
      'Emirates Islamic Bank', 'Abu Dhabi Islamic Bank (ADIB)', 'National Bank of Fujairah', 
      'Sharjah Islamic Bank', 'Ajman Bank', 'United Arab Bank', 'Al Hilal Bank', 
      'Noor Bank', 'HSBC Bank Middle East', 'Standard Chartered Bank', 
      'Citibank N.A.', 'Barclays Bank', 'Deutsche Bank', 'Credit Suisse', 
      'JP Morgan Chase Bank', 'BNP Paribas', 'Other'
    ],
    phone: {
      placeholder: '+971501234567',
      hint: 'Include country code (e.g., +971)',
      countryCode: '971',
      maxDigits: 9,
      format: (digits: string) => digits.slice(0, 9)
    },
    iban: {
      placeholder: 'AE070331234567890123456',
      hint: 'UAE IBAN format: AE + 21 digits (23 characters total)',
      countryCode: 'AE',
      maxLength: 23
    },
    idNumber: {
      label: 'Emirates ID Number',
      placeholder: '784-XXXX-XXXXXXX-X',
      hint: 'Format: 784-XXXX-XXXXXXX-X',
      maxLength: 18,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 15 && digits.startsWith('784')
      }
    }
  },
  'Saudia Arabia': {
    cities: [
      'Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Al Khobar', 
      'Taif', 'Abha', 'Tabuk', 'Buraydah', 'Khamis Mushait', 'Hail', 
      'Najran', 'Al Jubail', 'Yanbu', 'Al Khafji', 'Arar', 'Sakaka', 
      'Jizan', 'Al Bahah', 'Al Qunfudhah', 'Al Qatif', 'Unaizah', 
      'Al Mubarraz', 'Al Kharj', 'Al Hofuf', 'Al Wajh', 'Al Lith', 
      'Al Majmaah', 'Al Zulfi', 'Dhahran', 'Ras Tanura', 'Qatif', 
      'Saihat', 'Safwa', 'Tarout', 'Uqair', 'Abqaiq', 'Other'
    ],
    banks: [
      'Al Rajhi Bank', 'Saudi National Bank (SNB)', 'Riyad Bank', 
      'Saudi British Bank (SABB)', 'Banque Saudi Fransi', 'Alinma Bank', 
      'Saudi Investment Bank', 'Bank AlJazira', 'Arab National Bank', 
      'Saudi Awwal Bank', 'Gulf International Bank', 'Bank AlBilad', 
      'Emirates NBD Saudi Arabia', 'Deutsche Bank', 'HSBC Saudi Arabia', 
      'JP Morgan Chase Bank', 'BNP Paribas', 'Credit Suisse', 'Other'
    ],
    phone: {
      placeholder: '+966501234567',
      hint: 'Include country code (e.g., +966)',
      countryCode: '966',
      maxDigits: 9,
      format: (digits: string) => digits.slice(0, 9)
    },
    iban: {
      placeholder: 'SA0380000000608010167519',
      hint: 'Saudi Arabia IBAN format: SA + 22 digits (24 characters total)',
      countryCode: 'SA',
      maxLength: 24
    },
    idNumber: {
      label: 'Saudi National ID Number',
      placeholder: '1XXXXXXXXX',
      hint: 'Format: 10 digits',
      maxLength: 10,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 10
      }
    }
  },
  Qatar: {
    cities: [
      'Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Dukhan', 'Al Shamal', 
      'Umm Salal', 'Mesaieed', 'Lusail', 'The Pearl', 'West Bay', 
      'Al Sadd', 'Al Gharrafa', 'Al Waab', 'Al Aziziyah', 'Al Thumama', 
      'Abu Hamour', 'Al Markhiya', 'Al Dafna', 'Al Qassar', 'Other'
    ],
    banks: [
      'Qatar National Bank (QNB)', 'Commercial Bank of Qatar', 'Doha Bank', 
      'Qatar Islamic Bank (QIB)', 'Masraf Al Rayan', 'Qatar International Islamic Bank', 
      'Al Khalij Commercial Bank', 'Ahli Bank', 'Barwa Bank', 'Qatar Development Bank', 
      'HSBC Bank Middle East', 'Standard Chartered Bank', 'Citibank N.A.', 
      'BNP Paribas', 'Deutsche Bank', 'Other'
    ],
    phone: {
      placeholder: '+97433123456',
      hint: 'Include country code (e.g., +974)',
      countryCode: '974',
      maxDigits: 8,
      format: (digits: string) => digits.slice(0, 8)
    },
    iban: {
      placeholder: 'QA58DOHB00000000001234567890',
      hint: 'Qatar IBAN format: QA + 27 digits (29 characters total)',
      countryCode: 'QA',
      maxLength: 29
    },
    idNumber: {
      label: 'Qatar ID Number',
      placeholder: '2XXXXXXXX',
      hint: 'Format: 9 digits',
      maxLength: 9,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 9
      }
    }
  },
  Kuwait: {
    cities: [
      'Kuwait City', 'Al Ahmadi', 'Hawalli', 'Al Farwaniyah', 'Al Jahra', 
      'Mubarak Al-Kabeer', 'Salmiya', 'Mahboula', 'Fahaheel', 'Abu Halifa', 
      'Sabah Al-Salem', 'Al Mangaf', 'Al Fintas', 'Al Wafra', 'Al Khiran', 
      'Al Ahmadi', 'Al Riqqa', 'Al Adan', 'Al Shuaiba', 'Other'
    ],
    banks: [
      'National Bank of Kuwait (NBK)', 'Kuwait Finance House (KFH)', 
      'Commercial Bank of Kuwait', 'Gulf Bank', 'Al Ahli Bank of Kuwait', 
      'Burgan Bank', 'Boubyan Bank', 'Kuwait International Bank', 
      'Warba Bank', 'First Abu Dhabi Bank Kuwait', 'HSBC Bank Middle East', 
      'Standard Chartered Bank', 'Citibank N.A.', 'BNP Paribas', 'Other'
    ],
    phone: {
      placeholder: '+965-1234-5678',
      hint: 'Include country code (e.g., +965)',
      countryCode: '965',
      maxDigits: 8,
      format: (digits: string) => {
        if (digits.length > 4) {
          return digits.slice(0, 4) + '-' + digits.slice(4, 8)
        }
        return digits
      }
    },
    iban: {
      placeholder: 'KW81 CBKU 0000 0000 0000 0000 0000 01',
      hint: 'Kuwait IBAN format: KW + 28 digits (30 characters total)',
      countryCode: 'KW',
      maxLength: 30
    },
    idNumber: {
      label: 'Kuwait Civil ID Number',
      placeholder: '2XXXXXXXX',
      hint: 'Format: 12 digits',
      maxLength: 12,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 12
      }
    }
  },
  Bahrain: {
    cities: [
      'Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Isa Town', 
      'Sitra', 'Budaiya', 'Jidhafs', 'Sanad', 'Arad', 'Al Hidd', 
      'Al Markh', 'Al Diraz', 'Buri', 'Juffair', 'Adliya', 
      'Seef', 'Amwaj Islands', 'Diplomatic Area', 'Other'
    ],
    banks: [
      'Ahli United Bank', 'National Bank of Bahrain', 'Bank of Bahrain and Kuwait (BBK)', 
      'Bahrain Islamic Bank', 'Al Baraka Islamic Bank', 'Ithmaar Bank', 
      'Khaleeji Commercial Bank', 'ABC Islamic Bank', 'First Energy Bank', 
      'Investcorp Bank', 'HSBC Bank Middle East', 'Standard Chartered Bank', 
      'Citibank N.A.', 'BNP Paribas', 'Deutsche Bank', 'Other'
    ],
    phone: {
      placeholder: '+97312345678',
      hint: 'Include country code (e.g., +973)',
      countryCode: '973',
      maxDigits: 8,
      format: (digits: string) => digits.slice(0, 8)
    },
    iban: {
      placeholder: 'BH67BMAG00001299123456',
      hint: 'Bahrain IBAN format: BH + 20 digits (22 characters total)',
      countryCode: 'BH',
      maxLength: 22
    },
    idNumber: {
      label: 'Bahrain CPR Number',
      placeholder: 'XXXXXXXXX',
      hint: 'Format: 9 digits',
      maxLength: 9,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 9
      }
    }
  },
  Oman: {
    cities: [
      'Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Seeb', 'Barka', 
      'Rustaq', 'Ibri', 'Saham', 'Buraimi', 'Khasab', 'Ibra', 'Bahla', 
      'Adam', 'Al Buraimi', 'Al Hamra', 'Al Khaburah', 'Al Mudhaibi', 
      'Al Qabil', 'Al Suwaiq', 'Dibba', 'Duqm', 'Haima', 'Khasab', 
      'Madha', 'Manah', 'Masirah', 'Matrah', 'Mirbat', 'Nakhal', 
      'Qalhat', 'Quriyat', 'Shinas', 'Sinaw', 'Sumail', 'Thumrait', 
      'Yanqul', 'Other'
    ],
    banks: [
      'Bank Muscat', 'National Bank of Oman', 'HSBC Bank Oman', 
      'Oman Arab Bank', 'Bank Dhofar', 'Sohar International', 
      'Ahli Bank', 'Bank Nizwa', 'Alizz Islamic Bank', 
      'Oman Development Bank', 'Standard Chartered Bank', 
      'Citibank N.A.', 'BNP Paribas', 'Other'
    ],
    phone: {
      placeholder: '+96891234567',
      hint: 'Include country code (e.g., +968)',
      countryCode: '968',
      maxDigits: 8,
      format: (digits: string) => digits.slice(0, 8)
    },
    iban: {
      placeholder: 'OM540480000000000000000000',
      hint: 'Oman IBAN format: OM + 21 digits (23 characters total)',
      countryCode: 'OM',
      maxLength: 23
    },
    idNumber: {
      label: 'Oman ID Number',
      placeholder: '1XXXXXXXX',
      hint: 'Format: 9 digits',
      maxLength: 9,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 9
      }
    }
  },
  Iraq: {
    cities: [
      'Baghdad', 'Basra', 'Erbil', 'Najaf', 'Mosul', 'Karbala', 'Sulaymaniyah',
      'Nasiriyah', 'Ramadi', 'Baqubah', 'Hillah', 'Kirkuk', 'Duhok', 'Samarra',
      'Fallujah', 'Tikrit', 'Amarah', 'Diwaniyah', 'Kut', 'Hit', 'Other'
    ],
    banks: [
      'Central Bank of Iraq', 'Rafidain Bank', 'Rasheed Bank', 'Trade Bank of Iraq',
      'Bank of Baghdad', 'Commercial Bank of Iraq', 'Al Janoob Islamic Bank',
      'Iraqi Islamic Bank', 'National Bank of Iraq', 'Bank of Babel',
      'Investment Bank of Iraq', 'Gulf Commercial Bank', 'Al Baraka Bank Iraq',
      'Standard Chartered Bank', 'HSBC', 'Other'
    ],
    phone: {
      placeholder: '+964701234567',
      hint: 'Include country code (e.g., +964)',
      countryCode: '964',
      maxDigits: 10,
      format: (digits: string) => digits.slice(0, 10)
    },
    iban: {
      placeholder: 'IQ98NBIQ850123456789012',
      hint: 'Iraq IBAN format: IQ + 21 digits (23 characters total)',
      countryCode: 'IQ',
      maxLength: 23
    },
    idNumber: {
      label: 'Iraq National ID Number',
      placeholder: 'XXXXXXXXXXXX',
      hint: 'Format: 12 digits',
      maxLength: 12,
      required: true,
      validate: (value: string) => {
        const digits = value.replace(/\D/g, '')
        return digits.length === 12
      }
    }
  }
} as const

// Helper functions
export const getCountryData = (country: string) => {
  return COUNTRY_DATA[country as Country]
}

export const getCitiesForCountry = (country: string): readonly string[] => {
  return getCountryData(country)?.cities || []
}

export const getBanksForCountry = (country: string): readonly string[] => {
  return getCountryData(country)?.banks || []
}

export const getPhonePlaceholder = (country: string): string => {
  return getCountryData(country)?.phone.placeholder || '+XXXXXXXXXXXX'
}

export const getPhoneHint = (country: string): string => {
  return getCountryData(country)?.phone.hint || 'Include country code'
}

export const getIbanPlaceholder = (country: string): string => {
  return getCountryData(country)?.iban.placeholder || 'XXXXXXXXXXXX'
}

export const getIbanHint = (country: string): string => {
  return getCountryData(country)?.iban.hint || 'Enter IBAN number'
}

export const getIdNumberLabel = (country: string): string => {
  return getCountryData(country)?.idNumber.label || 'ID Number'
}

export const getIdNumberPlaceholder = (country: string): string => {
  return getCountryData(country)?.idNumber.placeholder || 'Enter ID Number'
}

export const getIdNumberHint = (country: string): string => {
  return getCountryData(country)?.idNumber.hint || ''
}
