/**
 * AI（企画書 §10-3・§10-7）。
 * チャットのストリーミングは WS ではなく SSE（text/event-stream でトークン逐次返し）。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { makeUid } from '../store/ids.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { requireString } from '../lib/validate.ts'

export const sbAiRouter: Router = Router()

/** SSEの1トークンあたりの送出間隔（体感を作るための最小限） */
const SSE_TOKEN_INTERVAL_MS = 40

sbAiRouter.get('/sb_ai/conversations', (req, res) => {
  res.json({ conversations: applyEmptyState(req, getState().sbAiConversations) })
})

sbAiRouter.post('/sb_ai/conversations', (req, res) => {
  const state = getState()
  const created = {
    id: state.nextId,
    uid: makeUid('sbAiConversation', state.sbAiConversations.length + 1),
    title: (req.body as { title?: string })?.title ?? '新しい会話',
    created_at: new Date().toISOString(),
  }
  setState((s) => ({
    ...s,
    sbAiConversations: [created, ...s.sbAiConversations],
    nextId: s.nextId + 1,
  }))
  res.status(201).json({ conversation: created })
})

sbAiRouter.get('/sb_ai/conversations/:uid', (req, res) => {
  const state = getState()
  const conversation = state.sbAiConversations.find((c) => c.uid === req.params.uid)
  if (conversation === undefined) {
    res.status(404).json(errorEnvelope('not_found', '会話が見つかりません。'))
    return
  }
  res.json({
    conversation,
    messages: state.sbAiMessages.filter((m) => m.conversation_id === conversation.id),
  })
})

/** 合成の応答文（実AIには接続しない） */
function synthesizeReply(prompt: string): string {
  return `「${prompt}」についての合成応答です。これはモックであり、実際のAIには接続していません。`
}

sbAiRouter.post('/sb_ai/conversations/:uid/messages', (req, res) => {
  const state = getState()
  const conversation = state.sbAiConversations.find((c) => c.uid === req.params.uid)
  if (conversation === undefined) {
    res.status(404).json(errorEnvelope('not_found', '会話が見つかりません。'))
    return
  }
  const content = requireString(req.body, 'content', { maxLength: 2000 })
  if (!content.ok) {
    res.status(422).json(errorEnvelope('validation_failed', content.message))
    return
  }

  const userMessage = {
    id: state.nextId,
    conversation_id: conversation.id,
    role: 'user' as const,
    content: content.value,
    created_at: new Date().toISOString(),
  }
  const reply = synthesizeReply(content.value)
  const assistantMessage = {
    id: state.nextId + 1,
    conversation_id: conversation.id,
    role: 'assistant' as const,
    content: reply,
    created_at: new Date().toISOString(),
  }
  setState((s) => ({
    ...s,
    sbAiMessages: [...s.sbAiMessages, userMessage, assistantMessage],
    nextId: s.nextId + 2,
  }))

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const tokens = [...reply]
  let index = 0
  const timer = setInterval(() => {
    if (index >= tokens.length) {
      clearInterval(timer)
      res.write('event: done\ndata: {"done":true}\n\n')
      res.end()
      return
    }
    res.write(`data: ${JSON.stringify({ delta: tokens[index] })}\n\n`)
    index += 1
  }, SSE_TOKEN_INTERVAL_MS)

  req.on('close', () => clearInterval(timer))
})
