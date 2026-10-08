/**
 * One place where a page decides it has started, and one place where it says so
 * when it has not.
 *
 * This exists because of a shipped defect. Every module below this file was
 * tested in isolation and the composition that a visitor actually loads was
 * tested by nobody, so an error anywhere in it surfaced as a permanent
 * "Loading..." with nothing in the page to explain why. A thrown error is loud
 * in the console and completely silent on screen, which helps the developer and
 * nothing at all for the visitor.
 *
 * So both halves are deliberate: the error is still thrown to the console, and
 * the screen is also told. A broken page that explains itself is a support
 * ticket; a broken page that says nothing is a ghost.
 */

/**
 * Runs `start` against the element with `rootId`, reporting failure on screen.
 *
 * A missing root element is a build error rather than a runtime one: the boot
 * markup lives in the HTML, so if it is absent the page was never wired up. It
 * throws for that case, because there is nowhere to render an explanation.
 */
export function boot(rootId: string, start: (root: HTMLElement) => void): void {
  const root = document.getElementById(rootId)
  if (root === null) {
    throw new Error(`roulette-lab: #${rootId} is missing from the document`)
  }

  try {
    start(root)
  } catch (error) {
    console.error(`roulette-lab: boot failed in #${rootId}`, error)
    reportFailure(root, error)
  }
}

/** Turns the boot placeholder into an explanation the visitor can act on. */
function reportFailure(root: HTMLElement, error: unknown): void {
  root.className = 'boot boot--failed'
  root.removeAttribute('aria-live')

  const title = document.createElement('p')
  title.className = 'boot__brand'
  title.textContent = 'Roulette Lab' // i18n-exempt: brand, same in every language

  const heading = document.createElement('p')
  heading.className = 'boot__msg'
  heading.textContent =
    'This page failed to start. Reloading usually fixes it; if it does not, the browser console has the reason.' // i18n-exempt: failure text is not reachable through the translator, which may be what failed

  const detail = document.createElement('pre')
  detail.className = 'boot__detail'
  detail.textContent = describe(error)

  root.replaceChildren(title, heading, detail)
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  }
  return String(error)
}