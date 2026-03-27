import type { ComponentType } from 'react'
import type { PostRecord, SchemaField } from './store'

export type { PostRecord, SchemaField } from './store'

export type TaskDef = { text: string; type: string }
export type BranchDef = { from: string; to: string; handle?: string; label?: string }
export interface StageDef {
  id: string; label: string; color?: string; description?: string
  view?: string; recordType?: string
  checklist?: TaskDef[]; fields?: SchemaField[]
  pipeline?: { ocr?: unknown; classify?: unknown; embed?: unknown; extract?: { questions?: Record<string, string> } }
}
export type GraphNode = { id: string; type?: string; position: { x: number; y: number }; data: StageDef & { label?: string; description?: string; checklist?: TaskDef[] } } & Record<string, any>
export interface WorkflowDef { id: string; name: string; nodes: GraphNode[]; edges: any[]; stages: StageDef[]; branches: BranchDef[] }

export interface StageViewStore {
  add(type: string, data: Record<string, unknown>, opts?: { parentId?: string }): PostRecord
  get(id: string): PostRecord | undefined
  update(id: string, data: Record<string, unknown>): void
  remove(id: string): void
  usePosts(type: string): PostRecord[]
  useOption(key: string): unknown
  getType(type: string): { type: string; schema: SchemaField[]; label?: string } | undefined
  writeFile(postId: string, name: string, data: File | Blob): Promise<void>
  readFile(postId: string, name: string): Promise<File>
}

export interface StageViewSDK {
  log(text: string, level?: 'info' | 'ok' | 'error'): void
  openFileDialog(accept: string): Promise<File | null>
  useForm(defaults: Record<string, unknown>, opts?: {
    onSubmit?: (data: Record<string, unknown>) => void
    isComplete?: (data: Record<string, unknown>) => boolean
    sync?: Record<string, unknown>
  }): {
    form: Record<string, unknown>
    bind: (key: string, transform?: (v: unknown) => unknown) => { value: unknown; onChange: (e: unknown) => void }
    set: (kOrO: string | Record<string, unknown>, v?: unknown) => void
    incomplete: boolean; showForm: boolean; editing: boolean
    submit: () => void; toggle: () => void; reset: () => void
  }
}

export interface StageViewProps {
  node: GraphNode; cas: PostRecord; wf: WorkflowDef
  store: StageViewStore; sdk: StageViewSDK; ui: Record<string, ComponentType<any>>; icons: Record<string, ComponentType<{ size?: number }>>
  advanceToStage: (caseId: string, stageId: string, wf: WorkflowDef) => void
  uploadFile: (parentId: string) => Promise<PostRecord | null>
  downloadFile: (ev: PostRecord) => Promise<void>
  useEvents: (caseId?: string | null) => PostRecord[]
  getNextStage: (wf: WorkflowDef, currentId: string) => string | null
}

export type StageView = ComponentType<StageViewProps>
