import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import QuestionCard from '../components/QuestionCard'

export default function QuestionPage({ slug }){
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    if (!slug) return
    setLoading(true); setError('')
    fetch('/api/questions/' + encodeURIComponent(slug))
      .then(r => r.json())
      .then(d => {
        if (d && d.item) setItem(d.item)
        else setError('Question not found')
      })
      .catch(()=> setError('Failed to load question'))
      .finally(()=> setLoading(false))
  },[slug])

  if (loading) return <div style={{padding:20}}>Loading question…</div>
  if (error) return <div className="gk-error">{error}</div>
  if (!item) return <div className="gk-empty">Question not available.</div>

  const title = (item.question_english || item.question_hindi || 'Question').slice(0, 120)
  const desc = (item.solution || '').replace(/<[^>]+>/g, '').slice(0, 160)

  return (
    <div style={{maxWidth:900,margin:'18px auto',padding:'0 18px'}}>
      <Helmet>
        <title>{title} — StudyGK</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : ''} />
      </Helmet>

      <QuestionCard item={item} displayLang={'both'} />
    </div>
  )
}
