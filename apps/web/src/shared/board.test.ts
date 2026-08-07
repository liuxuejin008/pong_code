import { describe, expect, it } from 'vitest'
import type { BoardItem, Swimlane } from '@/api/types'
import {
  boardBugDefaultStatus,
  boardCollapsedStorageKey,
  bugStatusBucket,
  boardItemKey,
  boardLaneId,
  boardRequirementId,
  calculateBoardTotals,
  calculateSwimlaneProgress,
  collectCompletedItemKeys,
  countHiddenCompletedItems,
  filterHiddenCompletedItems,
  isSwimlaneInactive,
} from './board'

function task(id: number, timeSpent = 0): BoardItem {
  return {
    id,
    item_type: 'task',
    item_code: `TASK-${id}`,
    title: `任务 ${id}`,
    description: null,
    status: 'todo',
    priority: 3,
    time_estimate: 0,
    time_spent: timeSpent,
    assignee_id: null,
    assignee_name: null,
    project_id: 1,
    sprint_id: 1,
    requirement_id: null,
    requirement_title: null,
  }
}

describe('看板共享规则', () => {
  it('沿用旧版泳道偏好键', () => {
    expect(boardCollapsedStorageKey(7, 11, 13))
      .toBe('pongcode:board:collapsed-swimlanes:v1:7:11:13')
  })

  it('在泳道标识和需求 ID 之间正确转换', () => {
    const lane = {
      requirement: { id: 9 },
    } as Swimlane
    expect(boardLaneId(lane)).toBe('req-9')
    expect(boardRequirementId('req-9')).toBe(9)
    expect(boardRequirementId('unassigned')).toBeNull()
  })

  it('缺陷 5 态归入 3 个看板列（桶）', () => {
    expect(bugStatusBucket('open')).toBe('todo')
    expect(bugStatusBucket('in_progress')).toBe('doing')
    expect(bugStatusBucket('fixed')).toBe('doing')
    expect(bugStatusBucket('closed')).toBe('done')
    expect(bugStatusBucket('rejected')).toBe('done')
    expect(boardBugDefaultStatus).toEqual({
      todo: 'open',
      doing: 'in_progress',
      done: 'closed',
    })
  })

  it('按所有泳道统计完成率与工时', () => {
    const lanes = [{
      requirement: null,
      todo: [task(1, 1.5)],
      doing: [task(2, 2)],
      done: [task(3, 0.5), task(4, 1)],
    }] as Swimlane[]
    expect(calculateBoardTotals(lanes)).toEqual({
      items: 4,
      done: 2,
      hours: 5,
      progress: 50,
    })
  })

  it('按单条泳道统计完成率', () => {
    const lane = {
      requirement: null,
      todo: [task(1)],
      doing: [task(2)],
      done: [task(3), task(4)],
    } as Swimlane

    expect(calculateSwimlaneProgress(lane)).toBe(50)
    expect(calculateSwimlaneProgress({
      requirement: null,
      todo: [],
      doing: [],
      done: [],
    } as Swimlane)).toBe(0)
  })

  it('没有待处理或进行中工作项的泳道视为非活跃', () => {
    expect(isSwimlaneInactive({
      requirement: null,
      todo: [],
      doing: [],
      done: [task(1)],
    } as Swimlane)).toBe(true)

    expect(isSwimlaneInactive({
      requirement: null,
      todo: [task(1)],
      doing: [],
      done: [],
    } as Swimlane)).toBe(false)

    expect(isSwimlaneInactive({
      requirement: null,
      todo: [],
      doing: [task(2)],
      done: [task(3)],
    } as Swimlane)).toBe(false)
  })

  it('隐藏已完成按开关打开瞬间快照，之后新完成的仍可见', () => {
    const lanes = [{
      requirement: null,
      todo: [],
      doing: [],
      done: [task(1), task(2)],
    }] as Swimlane[]
    const snapshot = collectCompletedItemKeys(lanes)
    expect([...snapshot]).toEqual(['task:1', 'task:2'])
    expect(boardItemKey(task(3))).toBe('task:3')

    const afterMove = [task(1), task(2), task(3)]
    expect(filterHiddenCompletedItems(afterMove, true, snapshot).map(item => item.id)).toEqual([3])
    expect(countHiddenCompletedItems(afterMove, true, snapshot)).toBe(2)
    expect(filterHiddenCompletedItems(afterMove, false, snapshot).map(item => item.id)).toEqual([1, 2, 3])
    expect(countHiddenCompletedItems(afterMove, false, snapshot)).toBe(0)
  })

  it('再次打开隐藏时用当前已完成重拍快照，离开后再拖回的不隐藏', () => {
    const atFirstOpen = collectCompletedItemKeys([{
      requirement: null,
      todo: [],
      doing: [],
      done: [task(1)],
    }] as Swimlane[])
    expect([...atFirstOpen]).toEqual(['task:1'])

    // 关掉隐藏、拖出已完成后再打开：快照应是当时仍在已完成的卡片
    const atSecondOpen = collectCompletedItemKeys([{
      requirement: null,
      todo: [],
      doing: [task(1)],
      done: [task(2)],
    }] as Swimlane[])
    expect([...atSecondOpen]).toEqual(['task:2'])

    const doneAfterDragBack = [task(2), task(1)]
    expect(filterHiddenCompletedItems(doneAfterDragBack, true, atSecondOpen).map(item => item.id))
      .toEqual([1])
    expect(countHiddenCompletedItems(doneAfterDragBack, true, atSecondOpen)).toBe(1)
  })
})
