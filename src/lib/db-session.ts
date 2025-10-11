import { prisma } from './prisma'
import { getSessionExpirationDate } from './auth'
import type { User, Session } from '@prisma/client'

export type UserWithoutPassword = Omit<User, 'passwordHash'>

// Available menu options
export const AVAILABLE_TABS = ['dashboard', 'projects', 'crm', 'products', 'masterParts', 'settings'] as const

/**
 * Create a new session for a user
 */
export async function createSession(userId: number): Promise<Session> {
  const expiresAt = getSessionExpirationDate()

  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  })

  return session
}

/**
 * Get session by ID with user data (excluding password hash)
 * Returns null if session doesn't exist or is expired
 */
export async function getSessionWithUser(
  sessionId: string
): Promise<(Session & { user: UserWithoutPassword }) | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          permissions: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: false,
        },
      },
    },
  })

  if (!session) {
    return null
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.session.delete({ where: { id: sessionId } })
    return null
  }

  // Check if user is active
  if (!session.user.isActive) {
    return null
  }

  return session as Session & { user: UserWithoutPassword }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  }).catch(() => {
    // Ignore errors if session doesn't exist
  })
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  })
}

/**
 * Delete expired sessions (cleanup utility)
 */
export async function deleteExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })

  return result.count
}

/**
 * Validate session and return user
 * Returns null if session is invalid or user is inactive
 */
export async function validateSession(
  sessionId: string
): Promise<UserWithoutPassword | null> {
  const session = await getSessionWithUser(sessionId)
  return session?.user ?? null
}
