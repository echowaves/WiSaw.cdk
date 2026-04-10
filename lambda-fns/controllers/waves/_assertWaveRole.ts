import { _getWaveRole } from './_getWaveRole'

const roleLevels: Record<string, number> = {
  contributor: 1,
  facilitator: 2,
  owner: 3,
}

export const _assertWaveRole = async (waveUuid: string, uuid: string, minRole: string): Promise<string> => {
  const role = await _getWaveRole(waveUuid, uuid)

  if (role === null) {
    throw new Error('You are not a member of this wave')
  }

  const userLevel = roleLevels[role] ?? 0
  const requiredLevel = roleLevels[minRole] ?? 0

  if (userLevel < requiredLevel) {
    throw new Error(`Insufficient permissions: requires ${minRole} role or higher`)
  }

  return role
}
