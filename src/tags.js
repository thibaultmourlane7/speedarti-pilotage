// Référentiel minimal utilisé par la démo. Les balises ne sont jamais rendues dans l'interface.
export const TAGS = Object.freeze({
  NAVIGATE: 'PILOT-UI-001',
  MOBILE_NAV: 'PILOT-UI-002',
  NOTIFICATION_DRAWER: 'PILOT-UI-004',
  PLANNING_MODAL: 'PILOT-UI-005',
  SEARCH: 'PILOT-UI-006',
  COLOR_SYSTEM: 'PILOT-UI-010',
  TASK_CREATE: 'PILOT-TASK-001',
  TASK_COMPLETE: 'PILOT-TASK-007',
  PLAN_DETECT: 'PILOT-PLAN-001',
  PLAN_UNPLANNED: 'PILOT-PLAN-002',
  PLAN_MODAL: 'PILOT-PLAN-003',
  PLAN_CONFIRM: 'PILOT-PLAN-004',
  PLAN_MOVE: 'PILOT-PLAN-005',
  PROJECT_CREATE: 'PILOT-PROJ-001',
  TASK_MODAL: 'PILOT-UI-011',
  PROJECT_MODAL: 'PILOT-UI-012',
  PROJECT_FILTER: 'PILOT-UI-013',
  PLANNING_FILTER: 'PILOT-UI-014',
  ACTIVITY_FILTER: 'PILOT-UI-015',
  NOTIFICATION_FILTER: 'PILOT-UI-016',
  ACTIVITY_LOG: 'PILOT-ACT-001',
  NOTIF_READ: 'PILOT-NOTIF-002',
  NOTIF_RESOLVE: 'PILOT-NOTIF-009'
});

export function trace(tag, message, details = {}) {
  // Invisible pour l'utilisateur. Disponible dans la console pour le diagnostic.
  console.debug(`[${tag}] ${message}`, details);
}
