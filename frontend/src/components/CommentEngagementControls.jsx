import React, { useEffect, useState } from 'react'

export default function CommentEngagementControls({ commentId, upVotes = 0, downVotes = 0, onReply }) {
  const voteKey = `comment_vote_${commentId}`
  const shareKey = `comment_share_${commentId}`

  const [voteChoice, setVoteChoice] = useState(() => {
    try {
      if (typeof window === 'undefined') return ''
      return localStorage.getItem(voteKey) || ''
    } catch (e) {
      return ''
    }
  })
  const [counts, setCounts] = useState({ up: Number(upVotes || 0), down: Number(downVotes || 0) })
  const [shareCount, setShareCount] = useState(() => {
    try {
      if (typeof window === 'undefined') return 0
      return Number(localStorage.getItem(shareKey) || 0)
    } catch (e) {
      return 0
    }
  })
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    setCounts({ up: Number(upVotes || 0), down: Number(downVotes || 0) })
  }, [upVotes, downVotes, commentId])

  const handleVote = async (direction) => {
    if (!commentId) return
    if (typeof window === 'undefined') return
    try {
      setIsVoting(true)
      // undo if same direction clicked
      if (voteChoice === direction) {
        const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction, undo: true })
        })
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!data) return
        setCounts({ up: Number(data.up_votes || 0), down: Number(data.down_votes || 0) })
        setVoteChoice('')
        try { localStorage.removeItem(voteKey) } catch (e) {}
        return
      }

      // if switching from other vote, undo previous first
      if (voteChoice && voteChoice !== direction) {
        try {
          await fetch(`/api/comments/${encodeURIComponent(commentId)}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction: voteChoice, undo: true })
          })
        } catch (e) { /* best-effort */ }
      }

      const res2 = await fetch(`/api/comments/${encodeURIComponent(commentId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      })
      if (!res2.ok) return
      const data2 = await res2.json().catch(() => null)
      if (!data2) return
      setCounts({ up: Number(data2.up_votes || 0), down: Number(data2.down_votes || 0) })
      setVoteChoice(direction)
      try { localStorage.setItem(voteKey, direction) } catch (e) {}
    } catch (err) {
      console.error('comment vote failed', err)
    } finally {
      setIsVoting(false)
    }
  }

  const handleReply = () => {
    if (typeof onReply === 'function') {
      onReply()
    }
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const hash = `#comment-${commentId}`
    const url = window.location.origin + window.location.pathname + window.location.search + hash
    if (navigator.share) {
      try { await navigator.share({ title: 'Comment', url }) } catch (e) {}
    } else {
      try {
        await navigator.clipboard.writeText(url)
        alert('Comment link copied to clipboard')
      } catch (e) {
        alert('Share not supported on this device')
      }
    }
    try {
      const next = Number(localStorage.getItem(shareKey) || 0) + 1
      localStorage.setItem(shareKey, String(next))
      setShareCount(next)
    } catch (e) {}
  }

  const voteButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 18,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--text)',
    cursor: voteChoice ? 'not-allowed' : 'pointer',
    fontSize: 12
  }

  const neutralButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 18,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: 12
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={() => handleVote('up')}
        aria-label="Up vote comment"
        disabled={isVoting}
        style={{ ...voteButtonStyle, opacity: voteChoice && voteChoice !== 'up' ? 0.6 : 1, color: voteChoice === 'up' ? '#16a34a' : voteButtonStyle.color }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden focusable="false">
          <path d="M10 4l6 8H4l6-8z" fill="currentColor" />
        </svg>
        <span>{counts.up}</span>
      </button>
      <button
        onClick={() => handleVote('down')}
        aria-label="Down vote comment"
        disabled={isVoting}
        style={{ ...voteButtonStyle, opacity: voteChoice && voteChoice !== 'down' ? 0.6 : 1, color: voteChoice === 'down' ? '#ef4444' : voteButtonStyle.color }}
      >
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden focusable="false">
          <path d="M10 16l-6-8h12l-6 8z" fill="currentColor" />
        </svg>
        <span>{counts.down}</span>
      </button>
      <button onClick={handleReply} aria-label="Reply to comment" style={neutralButtonStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M21 11.5a8.38 8.38 0 0 0-8.5-8.5A8.38 8.38 0 0 0 4 11.5c0 4 3 7.5 6.5 7.5h.5v3l4-3h1.5c3.5 0 6.5-3.5 6.5-7.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Reply</span>
      </button>
      <button onClick={handleShare} aria-label="Share comment" style={neutralButtonStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M18 8l-6-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2v14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16v4h14v-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{shareCount}</span>
      </button>
    </div>
  )
}
