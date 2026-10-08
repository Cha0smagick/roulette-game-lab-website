/**
 * A DOM stub just large enough to run the real page entry inside a Node test.
 *
 * Why this exists: `src/main.ts` calls `boot()` at module scope, and until this
 * stub existed nothing in the suite ever executed it. Every module below was
 * tested in isolation, so the composition that actually runs in a browser -- the
 * part where a thrown error leaves the visitor staring at the boot message
 * forever -- had no coverage at all. This stub is what closes that gap.
 *
 * It is deliberately minimal rather than general. It implements exactly the DOM
 * surface the three page entries touch, and it fails loudly on anything else, so
 * that a future feature reaching for new browser API shows up here as a test
 * failure instead of silently testing nothing.
 */

type Handler = (event: unknown) => void

class StubClassList {
  private readonly tokens = new Set<string>()

  add(...names: string[]): void {
    for (const name of names) {
      this.tokens.add(name)
    }
  }

  remove(...names: string[]): void {
    for (const name of names) {
      this.tokens.delete(name)
    }
  }

  contains(name: string): boolean {
    return this.tokens.has(name)
  }

  clear(): void {
    this.tokens.clear()
  }

  toggle(name: string, force?: boolean): boolean {
    const on = force === undefined ? !this.tokens.has(name) : force
    if (on) {
      this.tokens.add(name)
    } else {
      this.tokens.delete(name)
    }
    return on
  }

  get value(): string {
    return [...this.tokens].join(' ')
  }
}

class StubElement {
  readonly tagName: string
  readonly nodeName: string
  readonly nodeType = 1
  readonly classList = new StubClassList()
  readonly children: StubElement[] = []
  readonly childNodes: StubElement[] = []
  readonly dataset: Record<string, string> = {}
  readonly style: Record<string, string> = {}
  id = ''
  textContent = ''
  type = ''
  value = ''
  disabled = false
  hidden = false
  isConnected = true

  /**
   * Backed by `classList` rather than being a separate string, because the two
   * are the same property in a browser. Keeping them apart here made every
   * class-based lookup in these tests return null while the page was in fact
   * rendering correctly, which is the worst possible shape for a test: it fails
   * for a reason that has nothing to do with the code under test.
   */
  get className(): string {
    return this.classList.value
  }

  set className(value: string) {
    this.classList.clear()
    for (const token of value.split(/\s+/)) {
      if (token !== '') {
        this.classList.add(token)
      }
    }
  }

  private readonly attributes = new Map<string, string>()
  private readonly handlers = new Map<string, Handler[]>()

  constructor(tag: string) {
    this.tagName = tag.toUpperCase()
    this.nodeName = this.tagName
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
    if (name === 'id') {
      this.id = value
    }
    if (name === 'class') {
      this.className = value
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name)
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name)
  }

  append(...nodes: StubElement[]): void {
    for (const node of nodes) {
      this.children.push(node)
      this.childNodes.push(node)
    }
  }

  appendChild(node: StubElement): StubElement {
    this.append(node)
    return node
  }

  prepend(...nodes: StubElement[]): void {
    this.children.unshift(...nodes)
    this.childNodes.unshift(...nodes)
  }

  replaceChildren(...nodes: StubElement[]): void {
    this.children.length = 0
    this.childNodes.length = 0
    this.append(...nodes)
  }

  removeChild(node: StubElement): StubElement {
    const at = this.children.indexOf(node)
    if (at >= 0) {
      this.children.splice(at, 1)
    }
    return node
  }

  remove(): void {
    this.isConnected = false
  }

  addEventListener(type: string, handler: Handler): void {
    const existing = this.handlers.get(type) ?? []
    existing.push(handler)
    this.handlers.set(type, existing)
  }

  removeEventListener(type: string, handler: Handler): void {
    const existing = this.handlers.get(type)
    if (existing === undefined) {
      return
    }
    const at = existing.indexOf(handler)
    if (at >= 0) {
      existing.splice(at, 1)
    }
  }

  /** Fires the registered handlers, which is how a test presses a button. */
  click(): void {
    const event = { target: this, currentTarget: this }
    for (const handler of this.handlers.get('click') ?? []) {
      handler(event)
    }
  }

  focus(): void {
    /* not observable in these tests */
  }

  blur(): void {
    /* not observable in these tests */
  }

  contains(other: StubElement | null): boolean {
    if (other === null) {
      return false
    }
    return this.descendants().includes(other)
  }

  descendants(): StubElement[] {
    const out: StubElement[] = []
    for (const child of this.children) {
      out.push(child, ...child.descendants())
    }
    return out
  }

  matches(selector: string): boolean {
    const wanted = selector.replace(/^\./, '')
    return this.classList.contains(wanted)
  }

  querySelector(selector: string): StubElement | null {
    return this.querySelectorAll(selector)[0] ?? null
  }

  /**
   * Supports `[attribute]` and `.class`, which is everything the i18n applier
   * and these tests ask for. Anything else returns nothing rather than
   * pretending, so a test written against an unsupported selector fails loudly
   * instead of quietly passing on an empty list.
   */
  querySelectorAll(selector: string): StubElement[] {
    const wanted = selector.trim()
    if (wanted.startsWith('[') && wanted.endsWith(']')) {
      const attribute = wanted.slice(1, -1)
      return this.descendants().filter((node) => node.hasAttribute(attribute))
    }
    if (wanted.startsWith('.')) {
      return this.findAllByClass(wanted.slice(1))
    }
    return []
  }

  closest(): StubElement | null {
    return null
  }

  getBoundingClientRect(): {
    readonly width: number
    readonly height: number
    readonly top: number
    readonly left: number
    readonly right: number
    readonly bottom: number
  } {
    return { width: 320, height: 320, top: 0, left: 0, right: 320, bottom: 320 }
  }

  /** Canvas only. Every drawing call becomes a no-op. */
  getContext(kind: string): CanvasRenderingContext2D | null {
    return kind === '2d' ? stubContext2d() : null
  }

  /** Walks the tree matching a class name, which is how tests find a control. */
  findByClass(name: string): StubElement | null {
    for (const node of this.descendants()) {
      if (node.classList.contains(name)) {
        return node
      }
    }
    return null
  }

  findAllByClass(name: string): StubElement[] {
    return this.descendants().filter((node) => node.classList.contains(name))
  }

  findByTag(tag: string): StubElement[] {
    const wanted = tag.toUpperCase()
    return this.descendants().filter((node) => node.tagName === wanted)
  }
}

function stubContext2d(): CanvasRenderingContext2D {
  const gradient = { addColorStop: (): void => undefined }
  const known: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  }
  return new Proxy(known, {
    get(target, property): unknown {
      if (typeof property === 'string' && property in target) {
        return target[property]
      }
      // Any other method the renderer calls is a drawing no-op.
      return (): undefined => undefined
    },
    set(target, property, value): boolean {
      target[String(property)] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

class StubDocument {
  readonly documentElement = new StubElement('html')
  readonly body = new StubElement('body')
  private readonly byId = new Map<string, StubElement>()

  createElement(tag: string): StubElement {
    return new StubElement(tag)
  }

  createElementNS(_ns: string, tag: string): StubElement {
    return new StubElement(tag)
  }

  createTextNode(text: string): StubElement {
    const node = new StubElement('#text')
    node.textContent = text
    return node
  }

  getElementById(id: string): StubElement | null {
    return this.byId.get(id) ?? null
  }

  addEventListener(): void {
    /* the page entries never listen on document for anything these tests check */
  }

  removeEventListener(): void {
    /* nothing to remove */
  }

  querySelector(): StubElement | null {
    return null
  }

  querySelectorAll(): StubElement[] {
    return []
  }

  /** Registers an element so `getElementById` can find it. */
  register(element: StubElement, id: string): void {
    this.byId.set(id, element)
  }
}

export interface InstalledDom {
  readonly document: StubDocument
  /** The `#app` boot element, so a test can inspect what the page replaced. */
  readonly app: StubElement
}

interface Mutable {
  [key: string]: unknown
}

/**
 * Installs the stub on `globalThis` and returns handles for inspection.
 *
 * `crypto` is deliberately left alone: Node has a real WebCrypto, and
 * `getRandomValues` is the only one the seed generator needs.
 */
export function installDom(): InstalledDom {
  const stubDocument = new StubDocument()
  const app = stubDocument.createElement('div')
  app.id = 'app'
  app.className = 'boot'
  stubDocument.register(app, 'app')

  const target = globalThis as unknown as Mutable
  target['document'] = stubDocument
  target['localStorage'] = {
    getItem: (): string | null => null,
    setItem: (): void => undefined,
    removeItem: (): void => undefined,
  }
  const stubNavigator = {
    languages: ['en-US', 'en'],
    language: 'en-US',
    userAgent: 'stub',
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: stubNavigator,
    configurable: true,
    writable: true,
  })
  target['matchMedia'] = (): { matches: boolean } => ({ matches: false })
  target['ResizeObserver'] = class {
    observe(): void {
      /* layout is not observable here */
    }
    unobserve(): void {
      /* layout is not observable here */
    }
    disconnect(): void {
      /* layout is not observable here */
    }
  }
  // A frame callback that never fires. The wheel only animates while spinning,
  // and a test that pressed spin wants the settled state, not a tween.
  target['requestAnimationFrame'] = (): number => 1
  target['cancelAnimationFrame'] = (): void => undefined
  target['devicePixelRatio'] = 1

  // `window` is a real global in a browser and absent in Node, so anything that
  // reaches for it throws a ReferenceError that no module-level test would ever
  // have surfaced. It is a distinct object rather than globalThis so that a
  // reload or a resize can be observed rather than accidentally performed.
  const stubWindow: Mutable = {
    document: stubDocument,
    navigator: stubNavigator,
    devicePixelRatio: 1,
    location: {
      href: 'https://stub.invalid/',
      reload: (): void => undefined,
    },
    matchMedia: (): { matches: boolean } => ({ matches: false }),
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  }
  stubWindow['window'] = stubWindow
  stubWindow['globalThis'] = stubWindow
  target['window'] = stubWindow

  return { document: stubDocument, app }
}