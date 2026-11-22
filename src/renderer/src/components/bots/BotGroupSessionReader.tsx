import { memo, useEffect, useMemo } from 'react'
import type { RuntimeClientTarget } from '../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { useStructuredAgentSession } from '../native-chat/session/structured/use-structured-agent-session'
import {
  createBotGroupJournalIndexer,
  type indexBotGroupJournal,
  type BotGroupTurn
} from '../../../../shared/bots/bot-group'
import { botGroupTurnsOlderThanPage } from '../../../../shared/bots/bot-group-journal-paging'
export type BotGroupSession = ReturnType<typeof useStructuredAgentSession> & {
  groupTurnItems: ReturnType<typeof indexBotGroupJournal>
}
export const BotGroupSessionReader = memo(function BotGroupSessionReader({
  target,
  turn,
  visible,
  report
}: {
  /** The group's host, which runs its members' sessions. */
  target: RuntimeClientTarget
  turn: Pick<BotGroupTurn, 'sessionId' | 'agent'> & {
    operationIds: readonly string[]
    endedIds: ReadonlySet<string>
  }
  visible: boolean
  report: (sessionId: string, session: BotGroupSession | null) => void
}): null {
  const controller = useStructuredAgentSession({
    sessionId: turn.sessionId,
    agent: turn.agent,
    target,
    isVisible: visible,
    queueFollowUps: true
  })
  const indexJournal = useMemo(() => createBotGroupJournalIndexer(), [])
  const groupTurnItems = useMemo(
    () =>
      indexJournal(
        { items: controller.journalItems, submissions: controller.submissions },
        turn.operationIds
      ),
    [indexJournal, controller.journalItems, controller.submissions, turn.operationIds]
  )
  const { readCurrent, hasOlder, loadingOlder, loadOlder } = controller
  useEffect(() => {
    if (
      readCurrent &&
      hasOlder &&
      !loadingOlder &&
      botGroupTurnsOlderThanPage(
        { items: controller.journalItems, submissions: controller.submissions },
        turn.operationIds,
        turn.endedIds,
        groupTurnItems
      )
    ) {
      void loadOlder()
    }
  }, [
    readCurrent,
    hasOlder,
    loadingOlder,
    loadOlder,
    turn.operationIds,
    turn.endedIds,
    groupTurnItems,
    controller.journalItems,
    controller.submissions
  ])
  const session = useMemo(() => ({ ...controller, groupTurnItems }), [controller, groupTurnItems])
  useEffect(() => {
    report(turn.sessionId, session)
  }, [turn.sessionId, report, session])
  useEffect(() => () => report(turn.sessionId, null), [turn.sessionId, report])
  return null
})
