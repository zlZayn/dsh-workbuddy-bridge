/** Shared browser-side test harness: a stubbed `window`/`fetch` and a reader. */

import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, vi } from 'vitest'
import { en } from '../../src/client/locales.ts'
import type { WorkBuddyLocaleKey } from '../../src/client/locales.ts'

/** Interpolation over the English bundle: what `ctx.locale.bind` would do. */
export function t(key: WorkBuddyLocaleKey, params: Record<string, unknown> = {}): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    en[key],
  )
}

/** One signed-in status document, overridable per test. */
export function signedIn(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'signed-in',
    nickname: '昵称',
    expiresAt: Date.now() + 3_600_000,
    probeKey: 'test-key',
    credits: { total: 100, accounts: [] },
    models: [],
    /*
     * The probe section is one `models` list. The candidate/result pair was
     * replaced when the bulb's judgement became "can this model switch levels"
     * (see docs/ARCHITECTURE.md), so a fixture still carrying the old shape is a
     * document the shape guard now rejects — every card test would fail on the
     * fixture rather than on the behaviour it means to check.
     */
    probe: { consent: true, running: false, models: [] },
    ...overrides,
  }
}

/** The minimal event a host handler is entitled to receive. */
const SYNTHETIC_EVENT = { stopPropagation: () => {}, preventDefault: () => {} }

/** The fetch stub a test drives: reads answer `body`, writes answer `onPost`. */
export interface FetchStub {
  /** The mocked fetch call. */
  readonly call: ReturnType<typeof vi.fn>
  /** Body the next status GET returns. */
  body: Record<string, unknown>
  /** Resolve every held POST; its reply is {@link postReply}. */
  releasePosts: () => Promise<void>
  /** Reply the held POSTs return once released. */
  postReply: Record<string, unknown>
  /** URLs every POST was sent to, in order. */
  readonly posts: { url: string; body: string }[]
  /** Run every armed interval callback once: what a passing minute does. */
  tick: () => Promise<void>
  /** How many intervals are currently armed. */
  readonly intervals: number
}

/**
 * Install the stubs every browser test needs.
 *
 * `window` is stubbed rather than provided by jsdom: the unit lane runs in
 * `node`, and the only window members the components use are the timer and
 * listener pair — a real DOM would cost a dependency to test four functions.
 * `setInterval` keeps its callback so a test can move time itself instead of
 * waiting for it.
 */
export function useBrowserStubs(): FetchStub {
  const posts: { url: string; body: string }[] = []
  let pending: (() => void)[] = []
  const armed = new Map<number, () => void>()
  const stub: FetchStub = {
    call: vi.fn(),
    body: signedIn(),
    postReply: { state: 'ok', validation: 'non-validating', efforts: [] },
    posts,
    releasePosts: async () => {
      const held = pending
      pending = []
      await act(async () => {
        for (const resolve of held) resolve()
      })
    },
    tick: async () => {
      const due = [...armed.values()]
      await act(async () => {
        for (const run of due) run()
      })
    },
    get intervals() {
      return armed.size
    },
  }
  beforeEach(() => {
    posts.length = 0
    pending = []
    armed.clear()
    stub.body = signedIn()
    stub.postReply = { state: 'ok', validation: 'non-validating', efforts: [] }
    stub.call.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return { ok: true, json: async () => stub.body }
      posts.push({ url, body: String(init.body) })
      // Hold the POST open until the test releases it, so "in flight" is
      // observable rather than a race against the microtask queue.
      await new Promise<void>((resolve) => {
        pending.push(resolve)
      })
      return { ok: true, json: async () => stub.postReply }
    })
    vi.stubGlobal('fetch', stub.call)
    vi.stubGlobal('window', {
      setInterval: (run: () => void) => {
        const id = armed.size + 1
        armed.set(id, run)
        return id
      },
      clearInterval: (id: number) => {
        armed.delete(id)
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  return stub
}

/** Track a mounted tree and unmount it after each test. */
export function useTree(): { view: ReactTestRenderer | undefined } {
  const box: { view: ReactTestRenderer | undefined } = { view: undefined }
  afterEach(() => {
    act(() => {
      box.view?.unmount()
    })
    box.view = undefined
  })
  return box
}

/** Every string the tree renders, joined: what the reader actually sees. */
export function textOf(view: ReactTestRenderer): string {
  return view.root
    .findAll((node) => typeof node.type === 'string')
    .flatMap((node) => node.children.filter((child): child is string => typeof child === 'string'))
    .join(' ')
}

/**
 * Every rendered `<button>`'s concatenated text.
 *
 * Reads the subtree rather than joining `children` directly: a button with an
 * icon has an element among its children, and `join('')` would stringify it into
 * the label (`[object Object]Refresh all`), silently breaking every assertion
 * that looks a button up by name.
 */
export function buttonLabels(view: ReactTestRenderer): string[] {
  return view.root.findAllByType('button').map((node) => subtreeText(node))
}

/**
 * Every host element carrying the CSS-module class `name`, hash aside.
 *
 * Class names arrive hashed (`_fieldAction_9b3621`), so this compares **whole
 * tokens** rather than substrings: `field` is a prefix of `fieldAction`,
 * `fieldText` and `fieldHint`, and a substring test would match all four.
 *
 * Accepts a renderer or any node in it, so a caller can scope the search: the
 * card has a field row in its account block *and* one per tab panel, and an
 * unscoped query would count both.
 */
export function byClass(
  target: ReactTestRenderer | ReactTestInstance,
  name: string,
): ReactTestInstance[] {
  const root = 'root' in target ? target.root : target
  return root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      String(node.props.className ?? '')
        .split(/\s+/)
        .some((token) => token === name || token.startsWith(`_${name}_`)),
  )
}

/** The bare strings rendered directly inside a node — its un-wrapped text. */
export function bareStrings(node: ReactTestInstance): string[] {
  return node.children.filter((child): child is string => typeof child === 'string')
}

/** Every string rendered anywhere under a node, joined: what its subtree says. */
export function subtreeText(node: ReactTestInstance): string {
  return node
    .findAll((child) => typeof child.type === 'string')
    .flatMap((child) => bareStrings(child))
    .join(' ')
}

/**
 * Expand a disclosure whose whole header row is the toggle.
 *
 * The official `DisclosureRow` only renders a dedicated leading `<button>` when
 * `expandOnRowClick` is false. This suite's cards set `expandOnRowClick` (the
 * whole row toggles, as in `dsh-ds-balance`), so the row itself is the button —
 * a `div` with `role="button"` and `data-disclosure-row`, which
 * `findAllByType('button')` deliberately does not see.
 */
export async function expandDisclosure(view: ReactTestRenderer): Promise<void> {
  const row = view.root.findAll(
    (node) => node.type === 'div' && node.props['data-disclosure-row'] === true,
  )[0]
  if (row === undefined) throw new Error('no disclosure row to expand')
  await act(async () => {
    row.props.onClick(SYNTHETIC_EVENT)
  })
}

/** Click the first button whose text contains `label`. */ /** Click the first button whose text contains `label`. */
export async function clickText(view: ReactTestRenderer, label: string, nth = 0): Promise<void> {
  const matches = view.root
    .findAllByType('button')
    .filter((node) => node.children.join('').includes(label))
  const target = matches[nth]
  if (target === undefined)
    throw new Error(`no button labelled "${label}" (#${nth} of ${matches.length})`)
  await act(async () => {
    target.props.onClick(SYNTHETIC_EVENT)
  })
}
