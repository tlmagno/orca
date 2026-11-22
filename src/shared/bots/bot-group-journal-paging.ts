import type { AgentJournalRenderItem } from '../agent-session/journal/agent-session-journal-types'
import { botGroupOperationSubmission, type GroupJournal } from './bot-group'

/** Whether a turn with no loaded rows has them further back: its send was admitted on this page, or
 *  it ended (a long turn's send can be older than the page). Queued or refused ones have none. */
export function botGroupTurnsOlderThanPage(
  snapshot: GroupJournal,
  operationIds: readonly string[],
  endedIds: ReadonlySet<string>,
  loaded: (operationId: string) => readonly AgentJournalRenderItem[]
): boolean {
  return operationIds.some(
    (id) =>
      loaded(id).length === 0 &&
      (endedIds.has(id) || botGroupOperationSubmission(snapshot, id)?.dispatchState === 'accepted')
  )
}
