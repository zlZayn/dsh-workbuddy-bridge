/**
 * Per-message credit accounting, as two plain registries the Host half fills.
 *
 * WorkBuddy reports what a message actually cost as a `credit` field on the
 * last usage frame of its OpenAI-compatible SSE stream. That number is
 * **server-supplied**: the desktop app accumulates `cost.amount` stage
 * increments and never multiplies tokens by the catalog's `x0.79` multiplier
 * (the multiplier is display copy). So the plugin must not invent a formula —
 * it observes the number where it exists.
 *
 * The field travels on the stream the shim already proxies, and the same
 * stream carries the upstream response id (`cmb-…`) that DSH records on the
 * assistant message as `source.replayState.response.responseId`. That pair is
 * what makes attribution exact rather than guessed:
 *
 * ```text
 *   SSE id + SSE usage.credit  ──►  creditLog.record(id, credit)
 *                                        │
 *   session/event assistant/message ─────┴──► index.set(sessionId, messageId, credit)
 *        (messageId, responseId)                      │
 *                                              browser row fetches by messageId
 * ```
 *
 * Both structures are pure data with no Host dependencies, so the matching
 * rules are unit-testable without a Session, a socket, or an upstream.
 *
 * @module dsh-workbuddy-bridge/credit-log
 */

/** How many response ids one log remembers before dropping the oldest. */
const DEFAULT_LOG_LIMIT = 512

/**
 * Bounded `responseId → credit` registry, with one-shot waiters.
 *
 * The waiter exists because the two writes race in principle: the shim sees the
 * credit when the last SSE frame arrives, while the Session event that names
 * the response id is appended when the stream settles. Either order must
 * produce the same attribution, so a lookup that misses registers interest and
 * is answered by the next `record` instead of silently reporting "unknown".
 */
export class WorkBuddyCreditLog {
  /**
   * Insertion-ordered, so eviction is FIFO. A `Map` is used rather than an
   * object because the response id is attacker-influenced text: a plain object
   * would let `__proto__` reach the prototype chain.
   */
  private readonly credits = new Map<string, number>()
  /** Pending attributions, keyed by response id; each resolves at most once. */
  private readonly waiters = new Map<string, (credit: number) => void>()

  constructor(private readonly limit: number = DEFAULT_LOG_LIMIT) {}

  /**
   * Remember what one response cost.
   *
   * A non-finite or negative value is refused rather than stored: the field is
   * remote input, and a `NaN` reaching the browser would render as `NaN` in the
   * credit label instead of being reported as unknown.
   */
  record(responseId: string, credit: number): void {
    if (responseId === '') return
    if (!Number.isFinite(credit) || credit < 0) return
    // Re-recording refreshes the insertion position, so a long stream's final
    // frame cannot be evicted by earlier frames of the same response.
    this.credits.delete(responseId)
    this.credits.set(responseId, credit)
    this.evict()
    const waiter = this.waiters.get(responseId)
    if (waiter !== undefined) {
      this.waiters.delete(responseId)
      waiter(credit)
    }
  }

  /** What one response cost, or undefined when it was never observed. */
  lookup(responseId: string): number | undefined {
    return this.credits.get(responseId)
  }

  /**
   * Call `onCredit` once, when this response's credit becomes known.
   *
   * @returns a canceller; calling it after the credit landed is a no-op.
   */
  await(responseId: string, onCredit: (credit: number) => void): () => void {
    const known = this.credits.get(responseId)
    if (known !== undefined) {
      onCredit(known)
      return () => {}
    }
    this.waiters.set(responseId, onCredit)
    return () => {
      if (this.waiters.get(responseId) === onCredit) this.waiters.delete(responseId)
    }
  }

  /** Drop the oldest entries until the log is inside its bound. */
  private evict(): void {
    while (this.credits.size > this.limit) {
      const oldest = this.credits.keys().next()
      if (oldest.done === true) return
      this.credits.delete(oldest.value)
    }
  }
}

/**
 * `sessionId → messageId → credit`, the shape the browser row reads.
 *
 * Nested rather than a flat `messageId → credit` map so the route can answer
 * one Session without shipping every Session's accounting, and so a Session's
 * rows can be dropped as a unit.
 */
export class WorkBuddySessionCreditIndex {
  /** Per-Session maps, each bounded independently. */
  private readonly sessions = new Map<string, Map<string, number>>()

  constructor(private readonly perSessionLimit: number = DEFAULT_LOG_LIMIT) {}

  /** Attribute one message's cost, refreshing its position in its Session. */
  set(sessionId: string, messageId: string, credit: number): void {
    if (sessionId === '' || messageId === '') return
    if (!Number.isFinite(credit) || credit < 0) return
    let messages = this.sessions.get(sessionId)
    if (messages === undefined) {
      messages = new Map<string, number>()
      this.sessions.set(sessionId, messages)
    }
    messages.delete(messageId)
    messages.set(messageId, credit)
    while (messages.size > this.perSessionLimit) {
      const oldest = messages.keys().next()
      if (oldest.done === true) break
      messages.delete(oldest.value)
    }
  }

  /**
   * One Session's accounting as a plain object, or an empty object when the
   * Session has none. Always an object, never undefined: the browser half then
   * needs no "no data yet" branch distinct from "no credits recorded".
   */
  forSession(sessionId: string): Record<string, number> {
    const messages = this.sessions.get(sessionId)
    if (messages === undefined) return {}
    return Object.fromEntries(messages)
  }

  /** Forget one Session's accounting, e.g. when it leaves the store. */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}

/**
 * Read the upstream response id out of an assistant message's replay state.
 *
 * `replayState` is declared `unknown` on the LLM seam on purpose: it is
 * adapter-private state that only the owning adapter may interpret. This walks
 * it structurally and gives up quietly on anything unexpected, reading only the
 * pi-ai envelope's `response.responseId` and only when it is a non-empty string.
 *
 * A missing id is the normal case for a non-WorkBuddy provider and for a
 * message assembled from a stream that never carried one. It means "cannot
 * attribute", never "costs nothing" -- which is why every caller treats
 * `undefined` as a reason to do nothing rather than to record a zero.
 *
 * @param replayState - the message source's adapter-private state.
 * @returns the upstream response id, or undefined when there is none to read.
 */
export function responseIdOf(replayState: unknown): string | undefined {
  if (typeof replayState !== 'object' || replayState === null) return undefined
  const response = (replayState as Record<string, unknown>)['response']
  if (typeof response !== 'object' || response === null) return undefined
  const responseId = (response as Record<string, unknown>)['responseId']
  return typeof responseId === 'string' && responseId !== '' ? responseId : undefined
}

/** The pieces of one `assistant/message` event this join reads. */
export interface AssistantMessageEventData {
  message?: {
    id?: unknown
    source?: { provider?: unknown; replayState?: unknown }
  }
}

/**
 * Attribute one observed response cost to the message that caused it.
 *
 * The two halves of the key are produced by different layers and in either
 * order, so this is a join rather than a straight read:
 *
 * - the **shim** sees `usage.credit` on the stream and knows the upstream
 *   response id, but nothing about DSH's message ids;
 * - the **session log** records the assistant message with its DSH `messageId`
 *   and, inside `source.replayState.response.responseId`, that same id.
 *
 * The event normally lands *after* the stream's final frame (the message is
 * appended once the stream settles), so the log usually answers immediately.
 * The waiter covers the opposite interleaving instead of leaving that message
 * permanently unlabelled.
 *
 * @param log - the variant's response-id to credit registry.
 * @param index - the shared session to message to credit index.
 * @param sessionId - the Session the event came from.
 * @param data - the event's data payload, read structurally.
 * @returns whether an attribution was made or armed.
 */
export function attributeCredit(
  log: WorkBuddyCreditLog,
  index: WorkBuddySessionCreditIndex,
  sessionId: string,
  data: AssistantMessageEventData,
): boolean {
  const message = data.message
  const messageId = message?.id
  if (typeof messageId !== 'string' || messageId === '') return false
  const responseId = responseIdOf(message?.source?.replayState)
  if (responseId === undefined) return false
  const known = log.lookup(responseId)
  if (known !== undefined) {
    index.set(sessionId, messageId, known)
    return true
  }
  // Not observed yet: wait for the shim's final frame to supply it. The
  // canceller is dropped deliberately -- the waiter is one-shot and holds only
  // a number, and the cost may legitimately arrive after this returns.
  log.await(responseId, (credit) => {
    index.set(sessionId, messageId, credit)
  })
  return true
}
