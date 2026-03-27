import type { StageView, GraphNode } from './types'
import { FormView, DecisionView, TimelineView, GenericView } from './themes'

const builtinViews: Record<string, StageView> = {
  form: FormView,
  decision: DecisionView,
  timeline: TimelineView,
  generic: GenericView,
}

const customViews: Record<string, StageView> = {}

export function registerStageView(name: string, component: StageView) {
  customViews[name] = component
}

export function getStageView(node: GraphNode): StageView {
  if (node.id.startsWith('dec')) return builtinViews.decision
  const v = node.data.view || 'generic'
  return customViews[v] || builtinViews[v] || builtinViews.generic
}
