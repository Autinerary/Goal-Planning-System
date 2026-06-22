'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Reply } from 'lucide-react'
import type { CommunityAnswerNode } from '@/types/community'
import VoteButton from './VoteButton'
import Markdown from './Markdown'
import BadgeList from './BadgeList'
import ReportButton from './ReportButton'
import AnswerComposer from './AnswerComposer'

interface ThreadedAnswerProps {
  answer: CommunityAnswerNode
  postId: string
  viewerCanAccept: boolean
  onAccept: (answer: CommunityAnswerNode) => void
  onReply: () => void
  depth?: number
}

const MAX_VISIBLE_DEPTH = 4

export default function ThreadedAnswer({
  answer,
  postId,
  viewerCanAccept,
  onAccept,
  onReply,
  depth = 0,
}: ThreadedAnswerProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const indent = Math.min(depth, MAX_VISIBLE_DEPTH)

  return (
    <div
      className={`relative ${indent > 0 ? 'pl-4 sm:pl-6 border-l-2 ' + (answer.is_accepted ? 'border-emerald-300' : 'border-gray-200') : ''}`}
      style={{ marginLeft: indent === 0 ? 0 : 0 }}
    >
      <div
        className={`flex gap-3 items-start py-4 ${answer.is_accepted ? 'bg-emerald-50/40 rounded-lg px-3' : ''}`}
      >
        <VoteButton
          score={answer.score}
          viewerVote={answer.viewer_vote}
          targetType="answer"
          targetId={answer.id}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2 flex-wrap">
            {answer.is_accepted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white">
                <CheckCircle2 className="w-3 h-3" />
                Accepted
              </span>
            )}
            <Link
              href={`/community/profile/${answer.author.user_id}`}
              className="font-medium text-blue-700 hover:underline"
            >
              {answer.author.pseudonym}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="text-xs">{answer.author.karma} karma</span>
            <BadgeList badges={answer.author.top_badges} max={2} />
            <span className="ml-auto text-xs text-gray-400">
              {new Date(answer.created_at).toLocaleString()}
            </span>
          </div>
          <Markdown source={answer.body_markdown} />
          {answer.image_urls?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {answer.image_urls.map((u) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={u}
                  src={u}
                  alt="attachment"
                  className="max-h-48 rounded-lg border border-gray-200"
                />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setReplyOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-gray-500 hover:text-blue-600"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
            {viewerCanAccept && !answer.is_accepted && (
              <button
                type="button"
                onClick={() => onAccept(answer)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark as solution…
              </button>
            )}
            <ReportButton targetType="answer" targetId={answer.id} />
          </div>
          {replyOpen && (
            <div className="mt-3">
              <AnswerComposer
                postId={postId}
                parentId={answer.id}
                onSubmitted={() => {
                  setReplyOpen(false)
                  onReply()
                }}
                onCancel={() => setReplyOpen(false)}
              />
            </div>
          )}
          {answer.children.length > 0 && (
            <div className="mt-2">
              {answer.children.map((child) => (
                <ThreadedAnswer
                  key={child.id}
                  answer={child}
                  postId={postId}
                  viewerCanAccept={viewerCanAccept}
                  onAccept={onAccept}
                  onReply={onReply}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
