import React from 'react'
import QuestionCard from './QuestionCard'

export default function QuestionList({ items = [], total = 0, loading = false, onLoadMore, canLoadMore = false, displayLang = 'both', onFeedbackSubmit }) {
  return (
    <div className="gk-list">
      {Array.isArray(items) && items.length > 0 ? (
        items.map((item, idx) => (
          <QuestionCard key={item.id || item.slug || `${item.question_english || 'item'}-${idx}`} item={item} displayLang={displayLang} onFeedbackSubmit={onFeedbackSubmit} />
        ))
      ) : (
        <div className="gk-empty">No questions found for this filter.</div>
      )}

      {canLoadMore && (
        <div className="gk-load-more">
          <button onClick={onLoadMore} disabled={loading}>{loading ? 'Loading…' : 'Load More'}</button>
        </div>
      )}
    </div>
  )
}
