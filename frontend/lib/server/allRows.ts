/**
 * Every row a query matches, a page at a time. Supabase's API returns at most 1,000 rows per request, so a plain
 * select silently stops there, and a nightly job that reads "everyone" quietly leaves people out once there are more.
 *
 * `page(from, to)` must build a fresh query each time, ending in `.order(...)` on something stable and
 * `.range(from, to)`.
 */
export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxRows = 200_000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { data: out, error }
    if (data?.length) out.push(...data)
    if (!data || data.length < pageSize) break
  }
  return { data: out, error: null }
}
