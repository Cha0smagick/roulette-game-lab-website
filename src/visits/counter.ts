/**
 * The visit counter.
 *
 * The site is static: there is no backend to count into, so the count lives in
 * a free, keyless counter service and every page load bumps it once. The
 * module is the only place that talks to the service, and it degrades to
 * nothing: a dead service or an offline reader hides the figure instead of
 * printing a lie. The game runs without it, exactly as it runs without the ad
 * unit.
 */

/** The key is created by the service on the first hit; it names the site. */
const COUNTER_URL = 'https://abacus.jasoncameron.dev/hit/roulette-lab-cha0smagicklabs'

/**
 * Bumps the counter and returns the total, or null when the count is not
 * available. Null is the honest answer: it means "the service did not answer",
 * which is a different statement from zero.
 */
export async function recordVisit(): Promise<number | null> {
  try {
    const response = await fetch(COUNTER_URL)
    if (!response.ok) return null
    const body = (await response.json()) as { value: number }
    return typeof body.value === 'number' ? body.value : null
  } catch {
    // A dead service or an offline reader. Hiding the figure instead of
    // printing a lie keeps the rest of the page honest.
    return null
  }
}
