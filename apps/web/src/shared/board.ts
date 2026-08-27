import type { BoardItem, Bug, Swimlane } from '@/api/types'

export type BoardStatus = 'todo' | 'doing' | 'done'

export const BOARD_HIDE_COMPLETED_STORAGE_KEY = 'pongcode:board:hide-completed'
export const BOARD_COLLAPSED_SWIMLANES_STORAGE_PREFIX = 'pongcode:board:collapsed-swimlanes:v1'

/** 缺陷状态 → 看板列（桶）：待处理→左；处理中/已修复→中；已拒绝/已验证→右 */
export function bugStatusBucket(status: string): BoardStatus {
  if (status === 'in_progress' || status === 'fixed')
    return 'doing'
  if (status === 'rejected' || status === 'closed')
    return 'done'
  return 'todo'
}

/** 拖拽/菜单落到某列时缺陷的默认状态（列内排序、同桶移动时保留原状态） */
export const boardBugDefaultStatus: Record<BoardStatus, Bug['status']> = {
  todo: 'open',
  doing: 'in_progress',
  done: 'closed',
}

export function boardItemKey(item: Pick<BoardItem, 'item_type' | 'id'>) {
  return `${item.item_type}:${item.id}`
}

/** 收集「隐藏已完成」打开瞬间已在「已完成」列的工作项键。 */
export function collectCompletedItemKeys(swimlanes: Swimlane[]) {
  return new Set(swimlanes.flatMap(lane => lane.done.map(boardItemKey)))
}

/**
 * 隐藏已完成时：只藏开关打开瞬间的快照卡片；之后新拖入已完成的仍可见，方便拖回。
 * 进页时开关已开，视为同一次「打开」。
 */
export function filterHiddenCompletedItems(
  items: BoardItem[],
  hideCompleted: boolean,
  hiddenCompletedKeys: ReadonlySet<string>,
) {
  if (!hideCompleted)
    return items
  return items.filter(item => !hiddenCompletedKeys.has(boardItemKey(item)))
}

export function countHiddenCompletedItems(
  items: BoardItem[],
  hideCompleted: boolean,
  hiddenCompletedKeys: ReadonlySet<string>,
) {
  if (!hideCompleted)
    return 0
  return items.filter(item => hiddenCompletedKeys.has(boardItemKey(item))).length
}

export function boardLaneId(lane: Swimlane) {
  return lane.requirement ? `req-${lane.requirement.id}` : 'unassigned'
}

export function boardRequirementId(laneId: string) {
  return laneId.startsWith('req-') ? Number(laneId.slice(4)) : null
}

export function boardCollapsedStorageKey(
  userId: number | 'anonymous',
  projectId: number,
  sprintId: number,
) {
  return `${BOARD_COLLAPSED_SWIMLANES_STORAGE_PREFIX}:${userId}:${projectId}:${sprintId}`
}

/** 泳道没有待处理、进行中工作项时视为非活跃，默认折叠。 */
export function isSwimlaneInactive(lane: Swimlane) {
  return lane.todo.length === 0 && lane.doing.length === 0
}

export function calculateSwimlaneProgress(lane: Swimlane) {
  const items = lane.todo.length + lane.doing.length + lane.done.length
  return items ? Math.round(lane.done.length / items * 100) : 0
}

export function calculateBoardTotals(swimlanes: Swimlane[]) {
  const items: BoardItem[] = swimlanes.flatMap(lane => [...lane.todo, ...lane.doing, ...lane.done])
  const done = swimlanes.reduce((sum, lane) => sum + lane.done.length, 0)
  return {
    items: items.length,
    done,
    hours: Number(
      items.reduce((sum, item) => sum + Number(item.time_spent || 0), 0).toFixed(1),
    ),
    progress: items.length ? Math.round(done / items.length * 100) : 0,
  }
}
