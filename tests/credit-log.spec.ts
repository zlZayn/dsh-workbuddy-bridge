/**
 * The two registries behind per-message credit, and the SSE reader that feeds
 * them.
 *
 * These are the pieces the whole feature rests on and the only ones that can be
 * tested without a live stream: the join between an upstream response id and a
 * DSH message id, and the frame parsing that finds the cost at all. The
 * interesting cases are all about *ordering* and *absence* — the shim and the
 * session log produce their halves in either order, and a number that was never
 * observed must never surface as zero.
 */

import { describe, expect, it, vi } from 'vitest'
import {
  attributeCredit,
  responseIdOf,
  WorkBuddyCreditLog,
  WorkBuddySessionCreditIndex,
} from '../src/llm/credit-log.ts'
import { readCreditChunk, readCreditFrame } from '../src/llm/shim.ts'

/** An `assistant/message` payload shaped like the durable event's. */
function assistantMessage(
  messageId: string,
  responseId: string | undefined,
): { message: { id: string; source: { provider: string; replayState?: unknown } } } {
  return {
    message: {
      id: messageId,
      source: {
        provider: 'workbuddy',
        ...(responseId === undefined
          ? {}
          : { replayState: { response: { kind: 'pi-ai', responseId } } }),
      },
    },
  }
}

describe('responseIdOf', () => {
  it('reads the pi-ai envelope’s response id', () => {
    expect(responseIdOf({ response: { responseId: 'cmb-1' } })).toBe('cmb-1')
  })

  it('gives up on anything that is not that shape', () => {
    for (const value of [
      undefined,
      null,
      42,
      'cmb-1',
      [],
      {},
      { response: null },
      { response: {} },
      { response: { responseId: '' } },
      { response: { responseId: 7 } },
    ]) {
      // "Cannot attribute" must never be mistaken for "costs nothing".
      expect(responseIdOf(value)).toBeUndefined()
    }
  })
})

describe('attributeCredit', () => {
  it('attributes a cost the shim already recorded', () => {
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    log.record('cmb-1', 0.51)
    expect(attributeCredit(log, index, 's1', assistantMessage('m1', 'cmb-1'))).toBe(true)
    expect(index.forSession('s1')).toEqual({ m1: 0.51 })
  })

  it('attributes a cost that arrives after the message was appended', () => {
    // The other interleaving: the session event lands first. Without the
    // waiter this message would stay unlabelled forever.
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    expect(attributeCredit(log, index, 's1', assistantMessage('m1', 'cmb-late'))).toBe(true)
    expect(index.forSession('s1')).toEqual({})
    log.record('cmb-late', 2)
    expect(index.forSession('s1')).toEqual({ m1: 2 })
  })

  it('keeps Sessions apart', () => {
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    log.record('cmb-1', 1)
    log.record('cmb-2', 2)
    attributeCredit(log, index, 's1', assistantMessage('m1', 'cmb-1'))
    attributeCredit(log, index, 's2', assistantMessage('m2', 'cmb-2'))
    expect(index.forSession('s1')).toEqual({ m1: 1 })
    expect(index.forSession('s2')).toEqual({ m2: 2 })
  })

  it('records nothing for a message with no response id', () => {
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    expect(attributeCredit(log, index, 's1', assistantMessage('m1', undefined))).toBe(false)
    expect(index.forSession('s1')).toEqual({})
  })

  it('records nothing for a message with no id', () => {
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    log.record('cmb-1', 1)
    expect(attributeCredit(log, index, 's1', { message: { source: {} } })).toBe(false)
    expect(attributeCredit(log, index, 's1', {})).toBe(false)
    expect(index.forSession('s1')).toEqual({})
  })

  it('does not let a waiter fire for a different response', () => {
    const log = new WorkBuddyCreditLog()
    const index = new WorkBuddySessionCreditIndex()
    attributeCredit(log, index, 's1', assistantMessage('m1', 'cmb-wanted'))
    log.record('cmb-other', 9)
    expect(index.forSession('s1')).toEqual({})
  })
})

describe('WorkBuddyCreditLog', () => {
  it('answers a recorded cost', () => {
    const log = new WorkBuddyCreditLog()
    log.record('cmb-1', 0.51)
    expect(log.lookup('cmb-1')).toBe(0.51)
  })

  it('reports nothing for a response it never saw', () => {
    const log = new WorkBuddyCreditLog()
    expect(log.lookup('cmb-never')).toBeUndefined()
  })

  it('refuses a cost that is not a finite non-negative number', () => {
    const log = new WorkBuddyCreditLog()
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      log.record('cmb-bad', bad)
    }
    // A stored NaN would render as "NaN" in the label rather than as "unknown".
    expect(log.lookup('cmb-bad')).toBeUndefined()
  })

  it('answers a waiter whose cost arrives afterwards', async () => {
    const log = new WorkBuddyCreditLog()
    const seen: number[] = []
    log.await('cmb-late', (credit) => seen.push(credit))
    expect(seen).toEqual([])
    log.record('cmb-late', 1.25)
    expect(seen).toEqual([1.25])
  })

  it('answers a waiter immediately when the cost is already known', () => {
    const log = new WorkBuddyCreditLog()
    log.record('cmb-early', 2)
    const onCredit = vi.fn()
    log.await('cmb-early', onCredit)
    expect(onCredit).toHaveBeenCalledWith(2)
  })

  it('answers each waiter once, even if the response is recorded twice', () => {
    const log = new WorkBuddyCreditLog()
    const onCredit = vi.fn()
    log.await('cmb-once', onCredit)
    log.record('cmb-once', 1)
    log.record('cmb-once', 2)
    expect(onCredit).toHaveBeenCalledTimes(1)
    // The later record still updates what a *future* lookup answers.
    expect(log.lookup('cmb-once')).toBe(2)
  })

  it('drops a cancelled waiter', () => {
    const log = new WorkBuddyCreditLog()
    const onCredit = vi.fn()
    const cancel = log.await('cmb-cancelled', onCredit)
    cancel()
    log.record('cmb-cancelled', 9)
    expect(onCredit).not.toHaveBeenCalled()
  })

  it('does not let a prototype key reach anything', () => {
    const log = new WorkBuddyCreditLog()
    log.record('__proto__', 3)
    // A Map key is an ordinary string, so `__proto__` is data — not the
    // prototype accessor a plain object would expose.
    expect(log.lookup('__proto__')).toBe(3)
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
  })

  it('evicts the oldest entry once past its bound', () => {
    const log = new WorkBuddyCreditLog(2)
    log.record('a', 1)
    log.record('b', 2)
    log.record('c', 3)
    expect(log.lookup('a')).toBeUndefined()
    expect(log.lookup('c')).toBe(3)
  })

  it('keeps a re-recorded response alive against eviction', () => {
    const log = new WorkBuddyCreditLog(2)
    log.record('a', 1)
    log.record('b', 2)
    // A long stream's final frame must not be evicted by its own earlier frames.
    log.record('a', 4)
    log.record('c', 3)
    expect(log.lookup('a')).toBe(4)
    expect(log.lookup('b')).toBeUndefined()
  })
})

describe('WorkBuddySessionCreditIndex', () => {
  it('answers one Session without exposing another', () => {
    const index = new WorkBuddySessionCreditIndex()
    index.set('s1', 'm1', 0.5)
    index.set('s2', 'm2', 9)
    expect(index.forSession('s1')).toEqual({ m1: 0.5 })
    expect(index.forSession('s2')).toEqual({ m2: 9 })
  })

  it('answers an empty object for an unknown Session', () => {
    const index = new WorkBuddySessionCreditIndex()
    // Never undefined: the browser then needs no second "not read yet" branch.
    expect(index.forSession('nobody')).toEqual({})
  })

  it('forgets a Session on request', () => {
    const index = new WorkBuddySessionCreditIndex()
    index.set('s1', 'm1', 1)
    index.delete('s1')
    expect(index.forSession('s1')).toEqual({})
  })

  it('refuses a non-finite cost', () => {
    const index = new WorkBuddySessionCreditIndex()
    index.set('s1', 'm1', Number.NaN)
    expect(index.forSession('s1')).toEqual({})
  })

  it('evicts the oldest message within one Session only', () => {
    const index = new WorkBuddySessionCreditIndex(2)
    index.set('s1', 'a', 1)
    index.set('s1', 'b', 2)
    index.set('s1', 'c', 3)
    expect(index.forSession('s1')).toEqual({ b: 2, c: 3 })
  })
})

describe('readCreditFrame', () => {
  /** One usage frame shaped like the upstream's, carrying `credit`. */
  const frame = (id: string, credit: unknown): string =>
    JSON.stringify({
      id,
      object: 'chat.completion.chunk',
      choices: [{ index: 0, delta: {}, finish_reason: 'length' }],
      usage: {
        prompt_tokens: 17,
        completion_tokens: 22,
        total_tokens: 39,
        prompt_cache_hit_tokens: 0,
        credit,
      },
    })

  it('reads the id and credit from a usage frame', () => {
    expect(readCreditFrame(frame('cmb-abc', 0.51))).toEqual({ id: 'cmb-abc', credit: 0.51 })
  })

  it('accepts an explicit zero rather than treating it as absent', () => {
    // Zero is a real answer (a free model); the *absence* of the field is what
    // means "unobserved", and the two must not collapse.
    expect(readCreditFrame(frame('cmb-free', 0))).toEqual({ id: 'cmb-free', credit: 0 })
  })

  it('ignores a frame whose usage is null', () => {
    const payload = JSON.stringify({ id: 'cmb-x', choices: [], usage: null })
    expect(readCreditFrame(payload)).toBeUndefined()
  })

  it('ignores a frame with no usage at all', () => {
    const payload = JSON.stringify({ id: 'cmb-x', choices: [{ delta: { content: 'hi' } }] })
    expect(readCreditFrame(payload)).toBeUndefined()
  })

  it('ignores a non-numeric, negative, or non-finite credit', () => {
    for (const bad of ['0.5', null, -1, Number.NaN]) {
      // `NaN` cannot be expressed in JSON, so it arrives as null on the wire.
      expect(readCreditFrame(frame('cmb-bad', bad))).toBeUndefined()
    }
  })

  it('ignores a frame with no id', () => {
    const payload = JSON.stringify({ usage: { credit: 1 } })
    expect(readCreditFrame(payload)).toBeUndefined()
  })

  it('ignores the terminator and empty payloads', () => {
    expect(readCreditFrame('[DONE]')).toBeUndefined()
    expect(readCreditFrame('')).toBeUndefined()
  })

  it('ignores a payload that is not JSON', () => {
    // A proxy's HTML error page is a 200 with a non-JSON body.
    expect(readCreditFrame('<html>nope</html>')).toBeUndefined()
    expect(readCreditFrame('{"id":')).toBeUndefined()
  })

  it('ignores a JSON payload that is not an object', () => {
    expect(readCreditFrame('[]')).toBeUndefined()
    expect(readCreditFrame('42')).toBeUndefined()
    expect(readCreditFrame('null')).toBeUndefined()
  })
})

describe('readCreditChunk', () => {
  it('reads whole data lines out of a chunk', () => {
    const chunk = 'data: {"id":"a"}\n\ndata: {"id":"b"}\n\n'
    expect(readCreditChunk('', chunk)).toEqual({
      payloads: ['{"id":"a"}', '{"id":"b"}'],
      carry: '',
    })
  })

  it('carries an incomplete tail into the next chunk', () => {
    // This is the case that matters: the cost rides the *last* frame, which is
    // exactly the one a TCP read boundary is most likely to split.
    const first = readCreditChunk('', 'data: {"id":"cmb-1","usage":{"credit":0.5')
    expect(first.payloads).toEqual([])
    expect(first.carry).toBe('data: {"id":"cmb-1","usage":{"credit":0.5')
    const second = readCreditChunk(first.carry, '1}}\n\n')
    expect(second.payloads).toEqual(['{"id":"cmb-1","usage":{"credit":0.51}}'])
    expect(second.carry).toBe('')
  })

  it('ignores comment and blank lines', () => {
    expect(readCreditChunk('', ': heartbeat\n\ndata: {"id":"a"}\n\n').payloads).toEqual([
      '{"id":"a"}',
    ])
  })

  it('tolerates a frame split across three chunks', () => {
    let carry = ''
    const payloads: string[] = []
    for (const part of ['data: {"id":"cm', 'b-1","usage":{"credit":', '2}}\n']) {
      const read = readCreditChunk(carry, part)
      carry = read.carry
      payloads.push(...read.payloads)
    }
    expect(payloads).toEqual(['{"id":"cmb-1","usage":{"credit":2}}'])
  })
})
