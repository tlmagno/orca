import { afterEach, expect, it } from 'vitest'
import type { AgentJournalRenderItem } from '../../shared/agent-session/journal/agent-session-journal-types'
import type { BotGroupTurn } from '../../shared/bots/bot-group'
import { botGroupTurnsOlderThanPage } from '../../shared/bots/bot-group-journal-paging'
import { OrchestrationDb } from '../runtime/orchestration/db/orchestration-db'
import { readBotGroup } from './bot-group-delivery'
import type { BotGroupRuntime } from './bot-group-runtime'
import { BotGroupStore } from './bot-group-store'

// A long member turn pushes its own send off the member chat's loaded page; the room must still
// page back for it once it ended, or it reads "Starting…" with its reply hidden (#46084).

const databases: OrchestrationDb[] = []
afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close()
  }
})

const turn = (operationId: string, reply?: string | null): BotGroupTurn => ({
  operationId,
  botId: 'bot-1',
  botName: 'Ada',
  avatar: 'A',
  agent: 'claude',
  sessionId: 'bot-group-member-1',
  ...(reply === undefined ? {} : { reply })
})

it('pages back for an ended turn whose send is older than the loaded page', () => {
  const orchestration = new OrchestrationDb(':memory:')
  databases.push(orchestration)
  const store = new BotGroupStore(orchestration.db)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: a page read with no remote asks or mail turns touches only the store.
  const groups = { store, mailTurnChecks: new Map() } as unknown as BotGroupRuntime
  store.put({
    id: 'group-1',
    name: 'Crew',
    hostId: 'local',
    revision: 1,
    folder: 'group-crew',
    folderWorkspaceId: 'home-1',
    createdAt: 1,
    members: [{ botId: 'bot-1', sessionId: 'bot-group-member-1' }],
    replyMode: { kind: 'mentions' }
  })
  store.append({
    id: 'message-1',
    groupId: 'group-1',
    author: { kind: 'owner' },
    text: '@Ada audit the repo',
    createdAt: 2,
    turns: [turn('finished', 'Audit done.'), turn('quiet', null), turn('running')]
  })

  const [message] = readBotGroup(groups, 'group-1').messages
  expect(message.turns.map((t) => [t.operationId, t.ended, 'reply' in t])).toEqual([
    ['finished', true, false],
    ['quiet', true, false],
    ['running', undefined, false]
  ])
  // A page marker is never saved back onto the post.
  store.update({ ...store.message('message-1')!, turns: message.turns })
  expect(store.message('message-1')!.turns.some((t) => 'ended' in t)).toBe(false)

  // The loaded page holds only the turn's newest rows: no prompt row, no submission.
  const tail: { items: AgentJournalRenderItem[]; submissions: [] } = { items: [], submissions: [] }
  const ended = new Set(message.turns.filter((t) => t.ended).map((t) => t.operationId))
  const none = () => []
  expect(botGroupTurnsOlderThanPage(tail, ['finished'], ended, none)).toBe(true)
  // A turn with no submission on the page and no end may be queued; nothing older to find.
  expect(botGroupTurnsOlderThanPage(tail, ['running'], ended, none)).toBe(false)
})
