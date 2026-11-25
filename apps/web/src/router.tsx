import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { CreatePollPage } from './pages/CreatePollPage'
import { DashboardPage } from './pages/DashboardPage'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PollPage } from './pages/PollPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/p/:slug', element: <PollPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/create', element: <CreatePollPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
