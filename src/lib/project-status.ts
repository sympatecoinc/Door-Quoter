import { prisma } from '@/lib/prisma'
import { ProjectStatus } from '@prisma/client'

export const LOCKED_STATUSES: ProjectStatus[] = [
  ProjectStatus.QUOTE_SENT,
  ProjectStatus.QUOTE_ACCEPTED,
  ProjectStatus.ACTIVE,
  ProjectStatus.COMPLETE,
]

export function isProjectLocked(status: ProjectStatus): boolean {
  return LOCKED_STATUSES.includes(status)
}

export async function getProjectStatusByOpeningId(openingId: number): Promise<ProjectStatus | null> {
  const opening = await prisma.opening.findUnique({
    where: { id: openingId },
    include: { project: { select: { status: true } } }
  })
  return opening?.project?.status || null
}

export async function getProjectStatusByPanelId(panelId: number): Promise<{ status: ProjectStatus | null; openingId: number | null }> {
  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    include: {
      opening: {
        include: {
          project: { select: { status: true } }
        }
      }
    }
  })
  return {
    status: panel?.opening?.project?.status || null,
    openingId: panel?.openingId || null
  }
}

export function createLockedError(status: ProjectStatus) {
  return {
    error: `Project is locked for editing in ${status} status. Create a revision to make changes.`,
    code: 'PROJECT_LOCKED',
    status: status
  }
}
