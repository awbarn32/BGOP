import type { UserRole } from '@/types/domain'

export function canAccessDashboard(role: UserRole): boolean {
  return role === 'owner' || role === 'pa'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'owner'
}

export function canManageFinancials(role: UserRole): boolean {
  return role === 'owner' || role === 'pa'
}

export function canViewReports(role: UserRole): boolean {
  return role === 'owner' || role === 'pa'
}

export function canAssignMechanic(role: UserRole): boolean {
  return role === 'owner' || role === 'pa'
}

export function isStaff(role: UserRole): boolean {
  return ['owner', 'pa', 'mechanic', 'driver'].includes(role)
}
