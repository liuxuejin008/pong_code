import type { components as ApiComponents } from '@pongcode/api-contract'

type ApiSchemas = ApiComponents['schemas']
type ContractUser = ApiSchemas['User']
type ContractOrganization = ApiSchemas['Organization']
type ContractTeam = ApiSchemas['Team']
type ContractProject = ApiSchemas['Project']
type ContractSprint = ApiSchemas['Sprint']
type ContractRequirement = ApiSchemas['Requirement']
type ContractIssue = ApiSchemas['Issue']
type ContractBug = ApiSchemas['Bug']

export interface User extends ContractUser {
  id: number
  username: string
  email: string
  role?: 'admin' | 'member' | 'leader' | null
  is_owner?: boolean
}

export interface Organization extends ContractOrganization {
  id: number
  name: string
  owner_id: number
  owner_name: string | null
  projects_count: number
  done_issues_count: number
}

export interface Team extends ContractTeam {
  id: number
  name: string
  description: string
  organization_id: number
  members_count: number
  created_at: string | null
}

export interface Project extends ContractProject {
  id: number
  name: string
  description: string | null
  organization_id: number
  team_id: number | null
  team_name: string | null
  issues_count: number
  sprints_count: number
  feishu_bot_configured?: boolean
}

export interface Sprint extends ContractSprint {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  status: 'open' | 'active' | 'closed'
  status_label: string
  progress: number
  time_spent: number
  project_id: number
  description: string | null
  goal: string | null
  category: string | null
  code_prefix: string | null
  owner_id: number | null
  owner_name: string | null
}

export interface Requirement extends ContractRequirement {
  id: number
  title: string
  content: string
  priority: number
  expected_delivery_date: string | null
  status: 'pending' | 'in_progress' | 'testing' | 'completed'
  created_at: string | null
  updated_at: string | null
  project_id: number
  creator_id: number
  creator_name: string | null
  sprint_id: number | null
  sprint_name: string | null
}

export interface Issue extends ContractIssue {
  id: number
  item_type?: 'task'
  item_code: string | null
  title: string
  description: string | null
  status: 'todo' | 'doing' | 'done'
  priority: number
  time_estimate: number
  time_spent: number
  assignee_id: number | null
  assignee_name: string | null
  project_id: number
  sprint_id: number | null
  requirement_id: number | null
  requirement_title: string | null
}

import type {
  BugDiscoveryChannel,
  BugDiscoveryPhase,
  BugPlatform,
  BugPriority,
  BugType,
} from '@/shared/bug'

export interface Bug extends ContractBug {
  id: number
  item_type?: 'bug'
  board_status?: 'todo' | 'doing' | 'done'
  item_code: string | null
  title: string
  description: string
  severity: number
  status: 'open' | 'in_progress' | 'fixed' | 'resolved' | 'closed' | 'rejected'
  bug_type: BugType
  priority: BugPriority
  platform: BugPlatform
  discovery_phase: BugDiscoveryPhase
  discovery_channel: BugDiscoveryChannel | null
  steps_to_reproduce: string | null
  expected_result: string | null
  actual_result: string | null
  environment: string | null
  latest_stack_trace: string | null
  evidence_count: number
  time_estimate: number
  time_spent: number
  created_at: string | null
  updated_at: string | null
  resolved_at: string | null
  project_id: number
  reporter_id: number
  reporter_name: string | null
  assignee_id: number | null
  assignee_name: string | null
  sprint_id: number | null
  sprint_name: string | null
  requirement_id: number | null
  requirement_title: string | null
}

export interface WorkLog {
  id: number
  user_id: number
  user_name: string
  date: string
  created_at: string | null
  hours: number
  description: string
  can_delete?: boolean
  issue_id?: number
  bug_id?: number
  sprint_id?: number
}

export interface EvidenceAttachment {
  id: number
  file_name: string
  file_path: string
  mime_type: string
  file_size: number
  created_at: string | null
  url: string
}

export interface BugEvidence {
  id: number
  bug_id: number
  creator_id: number
  creator_name: string | null
  comment: string | null
  stack_trace: string | null
  created_at: string | null
  attachments: EvidenceAttachment[]
}

export type BoardItem = (Issue & { item_type: 'task' }) | (Bug & { item_type: 'bug' })

export interface Swimlane {
  requirement: Requirement | null
  todo: BoardItem[]
  doing: BoardItem[]
  done: BoardItem[]
}

export interface ProjectDetails {
  project: Project
  organization: Organization
  active_sprint: Sprint | null
  sprints: Sprint[]
  backlog: Issue[]
}

export interface OrganizationDetails {
  organization: Organization
  projects: Project[]
  teams: Team[]
  can_manage_projects: boolean
}

export interface BoardResponse {
  has_sprint: boolean
  error?: string
  project: Project
  organization: Organization
  sprint?: Sprint
  swimlanes?: Swimlane[]
}

export interface WorkbenchLog extends WorkLog {
  type: 'task' | 'bug' | 'sprint'
  item_id: number
  item_title: string
  project_name: string
}

export interface WorkbenchResponse {
  start_date: string
  end_date: string
  total_hours: number
  work_logs: WorkbenchLog[]
  tasks: Array<Issue & { project_name: string; sprint_name: string | null }>
  bugs: Array<Bug & { project_name: string }>
}

export type ApiRecord = Record<string, unknown>
