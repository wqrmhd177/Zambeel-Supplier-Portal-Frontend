'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, Download, Loader2, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useAuth } from '@/hooks/useAuth'
import {
  parseProductImportCsv,
  groupProductImportRows,
  PRODUCT_IMPORT_TEMPLATE_CSV,
} from '@/lib/productCsvImport'

const ALLOWED_ROLES = new Set(['admin', 'purchaser', 'manager', 'listing_agent'])

export default function ProductImportPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, userRole } = useAuth()

  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{
    productsCreated: number
    variantsCreated: number
    failures: { product_title: string; supplier_user_id: string; error: string }[]
  } | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
    if (!authLoading && isAuthenticated && userRole && !ALLOWED_ROLES.has(userRole)) {
      router.push('/products')
    }
  }, [authLoading, isAuthenticated, userRole, router])

  const parsed = csvText ? parseProductImportCsv(csvText) : []
  const invalidCount = parsed.filter((r) => r.errors.length > 0).length
  const groups = invalidCount === 0 && parsed.length > 0 ? groupProductImportRows(parsed) : []

  function downloadTemplate() {
    const blob = new Blob([PRODUCT_IMPORT_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      setCsvText(String(reader.result || ''))
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setError('')
    setResult(null)
    if (!csvText.trim()) {
      setError('Upload a CSV file first.')
      return
    }
    if (invalidCount > 0) {
      setError('Fix row errors in the preview before importing.')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/products/import-csv', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.invalidRows?.length) {
          setError(
            `Row errors: ${data.invalidRows
              .slice(0, 3)
              .map((r: { rowIndex: number; errors: string[] }) => `line ${r.rowIndex}: ${r.errors.join('; ')}`)
              .join(' | ')}`
          )
        } else {
          setError(data.error || 'Import failed.')
        }
        setImporting(false)
        return
      }
      setResult({
        productsCreated: data.productsCreated ?? 0,
        variantsCreated: data.variantsCreated ?? 0,
        failures: data.failures ?? [],
      })
    } catch {
      setError('Unexpected error during import.')
    }
    setImporting(false)
  }

  if (authLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f5f3ff]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <button
              type="button"
              onClick={() => router.push('/products')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Products
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Import Products from CSV</h1>
              <p className="mt-1 text-sm text-gray-600">
                Upload products for suppliers using their <strong>user_id</strong> (same ID used for product ownership).
                Imported products are stored with status <strong>pending</strong> by default so the team can review in
                Products and Listings.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4" />
                  Download template
                </button>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white cursor-pointer hover:opacity-90">
                  <Upload className="w-4 h-4" />
                  Choose CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
                </label>
              </div>
              {fileName && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {fileName} — {parsed.length} row(s), {groups.length} product group(s)
                </p>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {result && (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle className="w-4 h-4" />
                    Import complete: {result.productsCreated} product(s), {result.variantsCreated} variant(s)
                  </div>
                  {result.failures.length > 0 && (
                    <ul className="list-disc pl-5 text-red-700">
                      {result.failures.map((f, i) => (
                        <li key={i}>
                          {f.product_title} ({f.supplier_user_id}): {f.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {parsed.length > 0 && (
                <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-80">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left">Line</th>
                        <th className="px-2 py-2 text-left">Supplier ID</th>
                        <th className="px-2 py-2 text-left">Title</th>
                        <th className="px-2 py-2 text-left">Price</th>
                        <th className="px-2 py-2 text-left">Stock</th>
                        <th className="px-2 py-2 text-left">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((r) => (
                        <tr key={r.rowIndex} className={r.errors.length ? 'bg-red-50' : ''}>
                          <td className="px-2 py-1">{r.rowIndex}</td>
                          <td className="px-2 py-1">{r.supplier_user_id}</td>
                          <td className="px-2 py-1">{r.product_title}</td>
                          <td className="px-2 py-1">{r.price}</td>
                          <td className="px-2 py-1">{r.stock}</td>
                          <td className="px-2 py-1 text-red-600">{r.errors.join('; ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                disabled={importing || parsed.length === 0 || invalidCount > 0}
                onClick={handleImport}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Import into database
                  </>
                )}
              </button>
            </div>

            <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-2xl p-5 space-y-2">
              <p className="font-medium text-gray-800">CSV columns</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>supplier_user_id</strong> — required; from Users / supplier profile
                </li>
                <li>
                  <strong>product_title</strong>, <strong>price</strong>, <strong>stock</strong> — required
                </li>
                <li>
                  <strong>product_key</strong> — optional; same key + supplier = one product, multiple variant rows
                </li>
                <li>
                  <strong>image_urls</strong> — optional; separate multiple URLs with <code>|</code>
                </li>
                <li>
                  <strong>status</strong> — pending (default), active, inactive, rejected
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
