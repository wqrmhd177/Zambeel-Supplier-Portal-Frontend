/** PostgREST default max rows per request. */
export const POSTGREST_PAGE_SIZE = 1000

/** Max IDs per `.in()` filter before the request URL gets too long. */
export const POSTGREST_IN_CHUNK_SIZE = 80

type QueryResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

/** Page through a query until all rows are loaded. */
export async function fetchAllPages<T>(
  runQuery: (from: number, to: number) => Promise<QueryResult<T>> | QueryResult<T>
): Promise<T[]> {
  const allRows: T[] = []
  let from = 0

  for (;;) {
    const { data, error } = await runQuery(from, from + POSTGREST_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)

    const page = data ?? []
    allRows.push(...page)
    if (page.length < POSTGREST_PAGE_SIZE) break
    from += POSTGREST_PAGE_SIZE
  }

  return allRows
}

/** Run a query with chunked `.in()` values and merge results (each chunk fully paged). */
export async function fetchAllByInChunks<T, Id>(
  ids: Id[],
  chunkSize: number,
  runChunkQuery: (chunk: Id[], from: number, to: number) => Promise<QueryResult<T>> | QueryResult<T>
): Promise<T[]> {
  if (ids.length === 0) return []

  const allRows: T[] = []
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize)
    const rows = await fetchAllPages((from, to) => runChunkQuery(chunk, from, to))
    allRows.push(...rows)
  }

  return allRows
}
