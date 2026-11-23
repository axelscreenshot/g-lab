import type { Access, PayloadRequest, Where } from 'payload'

export function getAppUserId(req: PayloadRequest): string | null {
  if (req.user?.collection !== 'users') return null
  return String(req.user.id)
}

export const isAppUser: Access = ({ req }) => Boolean(getAppUserId(req))

export const ownProfileOnly: Access = ({ req }) => {
  const userId = getAppUserId(req)
  return userId ? { id: { equals: userId } } : false
}

export const projectMemberOnly: Access = ({ req }) => {
  const userId = getAppUserId(req)
  return userId ? { 'members.user': { equals: userId } } : false
}

export async function getMemberProjectIds(req: PayloadRequest): Promise<string[]> {
  const userId = getAppUserId(req)
  if (!userId) return []

  const result = await req.payload.find({
    collection: 'projects',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    where: { 'members.user': { equals: userId } },
  })

  return result.docs.map((project) => String(project.id))
}

export const projectRecordMemberOnly: Access = async ({ req }) => {
  const projectIds = await getMemberProjectIds(req)
  if (projectIds.length === 0) return false
  return { project: { in: projectIds } } satisfies Where
}
