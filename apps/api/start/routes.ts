/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import { SLUG_PATTERN } from '@livepoll/shared'
import { middleware } from '#start/kernel'
import { throttleAuth, throttleVote } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const PollsController = () => import('#controllers/polls_controller')
const HealthController = () => import('#controllers/health_controller')

router
  .group(() => {
    router.get('health', [HealthController, 'show'])

    router
      .group(() => {
        router.post('register', [AuthController, 'register']).use(throttleAuth)
        router.post('login', [AuthController, 'login']).use(throttleAuth)
        router.post('logout', [AuthController, 'logout'])
        router.get('me', [AuthController, 'me']).use(middleware.auth())
      })
      .prefix('auth')

    router
      .group(() => {
        router.post('/', [PollsController, 'store']).use(middleware.auth())
        router.get('mine', [PollsController, 'mine']).use(middleware.auth())
        router.get(':slug', [PollsController, 'show']).use(middleware.voter())
        router.post(':slug/vote', [PollsController, 'vote']).use([middleware.voter(), throttleVote])
        router.post(':slug/close', [PollsController, 'close']).use(middleware.auth())
      })
      .prefix('polls')
      .where('slug', SLUG_PATTERN)
  })
  .prefix('/api')
