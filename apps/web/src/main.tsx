import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { routes } from './router'
import { makeStore } from './store'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

const store = makeStore()
const router = createBrowserRouter(routes)

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
)
