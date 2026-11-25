import hash from '@adonisjs/core/services/hash'
import { AppError, isDuplicateKeyError } from '#exceptions/app_error'
import { User, type UserAttrs } from '#models/user'

let dummyHash: string | undefined

export async function registerUser(email: string, password: string): Promise<UserAttrs> {
  const passwordHash = await hash.make(password)
  try {
    const user = await User.create({ email, passwordHash })
    return user.toObject()
  } catch (error) {
    // The unique index on email is the source of truth, no "check then insert" race.
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists')
    }
    throw error
  }
}

export async function verifyCredentials(email: string, password: string): Promise<UserAttrs> {
  const user = await User.findOne({ email }).lean()
  if (!user) {
    // Spend the same time hashing as a real check so response time does not
    // reveal whether the email is registered.
    dummyHash ??= await hash.make('not-a-real-password')
    await hash.verify(dummyHash, password)
    throw invalidCredentials()
  }
  if (!(await hash.verify(user.passwordHash, password))) throw invalidCredentials()
  return user
}

function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect')
}
