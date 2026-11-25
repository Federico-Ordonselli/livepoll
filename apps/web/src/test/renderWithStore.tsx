import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { makeStore, type RootState } from '../store'
import { FakeSocket } from './fakeSocket'

interface Options {
  preloadedState?: Partial<RootState>
  route?: string
}

/** Renders with a real store (fake socket injected) inside a MemoryRouter. */
export function renderWithStore(ui: ReactElement, { preloadedState, route = '/' }: Options = {}) {
  const socket = new FakeSocket()
  const store = makeStore(preloadedState, { createSocket: () => socket.asSocket() })
  const user = userEvent.setup()
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>
  )
  return { store, socket, user, ...view }
}
