import type { ServerToClientEvents } from '@livepoll/shared'
import type { PollSocket } from '../store/socketMiddleware'

type Listener = (...args: unknown[]) => void

/** Minimal stand-in for a Socket.io client socket. Tests drive the "server" side by hand. */
export class FakeSocket {
  connected = false
  connectCalls = 0
  emitted: { event: string; payload: unknown }[] = []
  private listeners = new Map<string, Listener[]>()

  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
    return this
  }

  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload })
    return this
  }

  connect() {
    this.connectCalls += 1
    return this
  }

  disconnect() {
    this.connected = false
    return this
  }

  simulateConnect() {
    this.connected = true
    this.fire('connect')
  }

  simulateDisconnect() {
    this.connected = false
    this.fire('disconnect', 'transport close')
  }

  serverEmit<E extends keyof ServerToClientEvents>(
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0]
  ) {
    this.fire(event, payload)
  }

  asSocket() {
    return this as unknown as PollSocket
  }

  private fire(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}
