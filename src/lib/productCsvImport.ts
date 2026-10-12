/** CSV bulk import for products + product_variants (team manual upload). */

export const PRODUCT_IMPORT_HEADERS = [
  'supplier_user_id',
  'product_title',
  'price',
  'stock',
  'sku',
  'brand_name',
  'material',
  'image_urls',
  'status',
  'size',
  'color',
  'product_key',
] as const

export type ProductImportHeader = (typeof PRODUCT_IMPORT_HEADERS)[number]

export interface ProductCsvRow {
  rowIndex: number
  supplier_user_id: string
  product_title: string
  price: number
  stock: number
  sku: string
  brand_name: string
  material: string
  image_urls: string[]
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  size: string
  color: string
  /** Rows with same supplier + product_key become one product with multiple variants. */
  product_key: string
  errors: string[]
}

export interface ProductImportGroup {
  groupKey: string
  supplier_user_id: string
  product_title: string
  brand_name: string | null
  material: string | null
  image_urls: string[] | null
  status: 'pending' | 'active' | 'inactive' | 'rejected'
  rows: ProductCsvRow[]
}

const VALID_STATUS = new Set(['pending', 'active', 'inactive', 'rejected'])

function normalizeHeader(h: string): string {
  return String(h ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function parseCsvStrict(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field.trim())
      field = ''
      i += 1
      continue
    }
    if (c === '\r') {
      i += 1
      continue
    }
    if (c === '\n') {
      row.push(field.trim())
      field = ''
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      i += 1
      continue
    }
    field += c
    i += 1
  }
  row.push(field.trim())
  if (row.some((cell) => cell.length > 0)) rows.push(row)
  return rows
}

function padRow(cells: string[], len: number): string[] {
  const out = cells.map((c) => String(c ?? '').trim())
  while (out.length < len) out.push('')
  return out.slice(0, len)
}

function parseImageUrls(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[|;]/)
    .map((u) => u.trim())
    .filter(Boolean)
}

function parseNumber(raw: string, field: string, errors: string[]): number | null {
  const t = raw.trim()
  if (!t) {
    errors.push(`${field} is required`)
    return null
  }
  const n = Number(t.replace(/,/g, ''))
  if (Number.isNaN(n) || n < 0) {
    errors.push(`${field} must be a non-negative number`)
    return null
  }
  return n
}

export function parseProductImportCsv(csvText: string): ProductCsvRow[] {
  const stripped = csvText.startsWith('\ufeff') ? csvText.slice(1) : csvText
  const matrix = parseCsvStrict(stripped)
  if (matrix.length < 2) return []

  const headers = matrix[0].map(normalizeHeader)
  const headerCount = headers.length
  const parsed: ProductCsvRow[] = []

  matrix.slice(1).forEach((cellsRaw, idx) => {
    const rawTrimmed = cellsRaw.map((c) => String(c ?? '').trim())
    if (!rawTrimmed.some((c) => c.length > 0)) return

    const rowIndex = idx + 2
    const cells = padRow(rawTrimmed, headerCount)
    const get = (col: string) => cells[headers.indexOf(col)] ?? ''
    const errors: string[] = []

    const supplier_user_id = get('supplier_user_id').trim()
    const product_title = get('product_title').trim()
    if (!supplier_user_id) errors.push('supplier_user_id is required')
    if (!product_title) errors.push('product_title is required')

    const price = parseNumber(get('price'), 'price', errors)
    const stock = parseNumber(get('stock'), 'stock', errors)

    const statusRaw = get('status').trim().toLowerCase() || 'pending'
    const status = (VALID_STATUS.has(statusRaw) ? statusRaw : 'pending') as ProductCsvRow['status']
    if (get('status').trim() && !VALID_STATUS.has(statusRaw)) {
      errors.push('status must be pending, active, inactive, or rejected')
    }

    parsed.push({
      rowIndex,
      supplier_user_id,
      product_title,
      price: price ?? 0,
      stock: stock ?? 0,
      sku: get('sku').trim(),
      brand_name: get('brand_name').trim(),
      material: get('material').trim(),
      image_urls: parseImageUrls(get('image_urls')),
      status,
      size: get('size').trim(),
      color: get('color').trim(),
      product_key: get('product_key').trim(),
      errors,
    })
  })

  return parsed
}

export function groupProductImportRows(rows: ProductCsvRow[]): ProductImportGroup[] {
  const map = new Map<string, ProductImportGroup>()

  for (const row of rows) {
    if (row.errors.length > 0) continue
    const keyPart = row.product_key || row.product_title
    const groupKey = `${row.supplier_user_id}|||${keyPart}`

    let group = map.get(groupKey)
    if (!group) {
      group = {
        groupKey,
        supplier_user_id: row.supplier_user_id,
        product_title: row.product_title,
        brand_name: row.brand_name || null,
        material: row.material || null,
        image_urls: row.image_urls.length > 0 ? row.image_urls : null,
        status: row.status,
        rows: [],
      }
      map.set(groupKey, group)
    }
    group.rows.push(row)
    if (!group.brand_name && row.brand_name) group.brand_name = row.brand_name
    if (!group.material && row.material) group.material = row.material
    if (!group.image_urls?.length && row.image_urls.length > 0) group.image_urls = row.image_urls
  }

  return Array.from(map.values())
}

export function buildVariantOptionValues(size: string, color: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (size) out.Sizes = size
  if (color) out.Color = color
  return out
}

export function buildProductOptionsFromRows(rows: ProductCsvRow[]): Array<{ name: string; values: string[] }> | null {
  const sizes = new Set<string>()
  const colors = new Set<string>()
  for (const r of rows) {
    if (r.size) sizes.add(r.size)
    if (r.color) colors.add(r.color)
  }
  const options: Array<{ name: string; values: string[] }> = []
  if (sizes.size > 0) options.push({ name: 'Sizes', values: Array.from(sizes) })
  if (colors.size > 0) options.push({ name: 'Color', values: Array.from(colors) })
  return options.length > 0 ? options : null
}

export const PRODUCT_IMPORT_TEMPLATE_CSV = [
  PRODUCT_IMPORT_HEADERS.join(','),
  '12345,Sample Product Title,99.99,10,SKU-001,BrandName,Cotton,https://example.com/img1.jpg,pending,Medium,Red,sample-product-1',
  '12345,Sample Product Title,109.99,5,SKU-002,BrandName,Cotton,,pending,Large,Blue,sample-product-1',
  '12345,Another Simple Product,49.99,20,SKU-003,,,,pending,,,',
].join('\n')
