import { Schema, model, type Types } from 'mongoose'
import type { UserDTO } from '@livepoll/shared'

export interface UserAttrs {
  _id: Types.ObjectId
  email: string
  passwordHash: string
  createdAt: Date
}

const userSchema = new Schema<UserAttrs>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const User = model<UserAttrs>('User', userSchema)

export function toUserDTO(user: UserAttrs): UserDTO {
  return { id: user._id.toString(), email: user.email, createdAt: user.createdAt.toISOString() }
}
