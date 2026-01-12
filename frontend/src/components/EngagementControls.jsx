import React, { useEffect, useState } from 'react'

export default function EngagementControls({ id, slug, title, description = '', image = '', upVotes = 0, downVotes = 0, commentsCount = 0, onComment }) {
  const identity = slug || id
  const voteKey = `blog_vote_${identity}`
  const shareKey = `shares_${identity}`
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
  const [commentTotal, setCommentTotal] = useState(Number(commentsCount || 0))
  const [isVoting, setIsVoting] = useState(false)

  useEffect(() => {
    setCounts({ up: Number(upVotes || 0), down: Number(downVotes || 0) })
  }, [upVotes, downVotes, id])

  useEffect(() => {
    setCommentTotal(Number(commentsCount || 0))
  }, [commentsCount, id])

  const handleVote = async (direction) => {
    if (!id) return
    if (typeof window === 'undefined') return
    try {
      setIsVoting(true)
      // undo if same clicked
      if (voteChoice === direction) {
        const res = await fetch(`/api/blogs/${encodeURIComponent(id)}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ direction, undo: true })
        })
        if (!res.ok) return
        const data = await res.json()
        setCounts({ up: Number(data.up_votes || 0), down: Number(data.down_votes || 0) })
        setVoteChoice('')
        try { localStorage.removeItem(voteKey) } catch (e) {}
        return
      }

      // if switching from other vote, undo previous
      if (voteChoice && voteChoice !== direction) {
        try {
          await fetch(`/api/blogs/${encodeURIComponent(id)}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction: voteChoice, undo: true })
          })
        } catch (e) {}
      }

      const res2 = await fetch(`/api/blogs/${encodeURIComponent(id)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction })
      })
      if (!res2.ok) return
      const data2 = await res2.json()
      setCounts({ up: Number(data2.up_votes || 0), down: Number(data2.down_votes || 0) })
      setVoteChoice(direction)
      try { if (typeof window !== 'undefined') localStorage.setItem(voteKey, direction) } catch (e) {}
    } catch (err) {
      console.error('vote failed', err)
    } finally {
      setIsVoting(false)
    }
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.origin + '/posts/' + (slug || id)
    // create a compact two-line description for sharing
    const raw = (description || '').toString().replace(/\s+/g, ' ').trim().slice(0,200)
    const maxLine = 80
    const firstLine = raw.slice(0, maxLine).trim()
    let rest = raw.slice(maxLine).trim()
    if (rest.length > maxLine) rest = rest.slice(0, maxLine - 3).trim() + '...'
    const twoLineDesc = rest ? `${firstLine}\n${rest}` : firstLine
    const textParts = []
    if (title) textParts.push(title)
    if (twoLineDesc) textParts.push(twoLineDesc)
    textParts.push('Read more: ' + url)
    if (image) textParts.push('Image: ' + image)
    const shareText = textParts.join('\n\n')
    // Try to copy rich share text to clipboard first so users can paste full text
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(shareText)
        try { /* non-blocking feedback */ /* eslint-disable no-empty */ } catch (e) {}
      }
    } catch (e) {}

    // Then attempt native share; on desktop fallback, open the URL in a new tab
    if (navigator.share) {
      try { await navigator.share({ title, text: shareText, url }) } catch (e) {
        // if native share fails, open in a new tab
        try { window.open(url, '_blank', 'noopener,noreferrer') } catch (err) {}
      }
    } else {
      try {
        // open in a new tab in the current browser so it doesn't switch to Edge
        window.open(url, '_blank', 'noopener,noreferrer')
      } catch (e) {}
      try { alert('Share text copied to clipboard. The post has been opened in a new tab.') } catch (e) {}
    }
    try {
      if (typeof window === 'undefined') return
      const next = Number(localStorage.getItem(shareKey) || 0) + 1
      localStorage.setItem(shareKey, String(next))
      setShareCount(next)
    } catch (e) {}
  }

  const handleComments = () => {
    if (typeof onComment === 'function') {
      onComment()
      return
    }
    if (typeof window === 'undefined') return
    const target = '/posts/' + (slug || id) + '#comments'
    try {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (e) {
      window.location.href = target
    }
  }

  const voteButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 20,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--text)',
    cursor: voteChoice ? 'not-allowed' : 'pointer'
  }

  const neutralButtonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    borderRadius: 20,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--text)',
    cursor: 'pointer'
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={() => handleVote('up')}
        aria-label="Up vote"
        disabled={isVoting}
        style={{ ...voteButtonStyle, opacity: voteChoice && voteChoice !== 'up' ? 0.6 : 1, color: voteChoice === 'up' ? '#16a34a' : voteButtonStyle.color }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden focusable="false">
          <path d="M10 4l6 8H4l6-8z" fill="currentColor" />
        </svg>
        <span>{counts.up}</span>
      </button>
      <button
        onClick={() => handleVote('down')}
        aria-label="Down vote"
        disabled={isVoting}
        style={{ ...voteButtonStyle, opacity: voteChoice && voteChoice !== 'down' ? 0.6 : 1, color: voteChoice === 'down' ? '#ef4444' : voteButtonStyle.color }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden focusable="false">
          <path d="M10 16l-6-8h12l-6 8z" fill="currentColor" />
        </svg>
        <span>{counts.down}</span>
      </button>
      <button onClick={handleComments} aria-label="View comments" style={neutralButtonStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-4.6l-3.7 3.4A1 1 0 0 1 9 18H7a3 3 0 0 1-3-3V5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{commentTotal}</span>
      </button>
      <button onClick={handleShare} aria-label="Share" style={neutralButtonStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M18 8l-6-6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2v14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 16v4h14v-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{shareCount}</span>
      </button>
    </div>
  )
}
