import React, { useState, useEffect, useMemo } from 'react'
import QuestionList from '../components/QuestionList'

const PER_PAGE = 10

export default function GeneralKnowledge(){
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState([])
  const [chapters, setChapters] = useState([])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [chapter, setChapter] = useState('')
  const [displayLang, setDisplayLang] = useState('both')

  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  useEffect(()=>{
    fetchMeta()
    fetchQuestions({ page: 1, append: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When category changes, refresh the chapters list filtered by the category
  useEffect(()=>{
    fetchMeta(category || '')
  }, [category])

  useEffect(()=>{
    fetchQuestions({ page: 1, append: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, chapter])

  const hasFilters = useMemo(()=> Boolean(category || chapter || search), [category, chapter, search])

  async function fetchMeta(cat = ''){
    try{
      const url = '/api/questions/meta' + (cat ? ('?category=' + encodeURIComponent(cat)) : '')
      const res = await fetch(url)
      if (!res.ok) return
      const d = await res.json()
      setCategories(Array.isArray(d.categories)?d.categories:[])
      setChapters(Array.isArray(d.chapters)?d.chapters:[])
    }catch(e){ console.error('meta load failed', e) }
  }

  // news/aside removed per request

  async function fetchQuestions({ page: targetPage = 1, append = false } = {}){
    const params = new URLSearchParams()
    params.set('page', String(targetPage))
    params.set('limit', String(PER_PAGE))
    if (search.trim()) params.set('q', search.trim())
    if (category) params.set('category', category)
    // Exclude Current Affairs from the general GK listing
    params.set('exclude_category', 'Current Affairs')
    if (chapter) params.set('chapter', chapter)
    if ((category || chapter) && targetPage > 1) params.set('random', '1')

    append ? setLoadingMore(true) : setLoading(true)
    setError('')

    try{
      const res = await fetch('/api/questions?' + params.toString())
      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      const incoming = Array.isArray(data.items) ? data.items : []
      setItems(prev => append ? prev.concat(incoming) : incoming)
      // Do not derive categories/chapters from paginated results —
      // rely on the dedicated `/api/questions/meta` endpoint to provide full lists.
      setTotal(Number(data.total || incoming.length || 0))
      setPage(targetPage)
    }catch(err){
      console.error('question load failed', err)
      if (!append) setItems([])
      setError('Unable to load questions right now.')
    }finally{
      append ? setLoadingMore(false) : setLoading(false)
    }
  }

  function handleSearchSubmit(e){
    e && e.preventDefault()
    fetchQuestions({ page: 1, append: false })
  }

  async function handleLoadMore(){
    if (loadingMore) return
    fetchQuestions({ page: page + 1, append: true })
  }

  async function submitFeedback(questionId, content){
    try{
      const res = await fetch('/api/questions/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: questionId, content })
      })
      if (!res.ok) return false
      return true
    }catch(e){
      console.error('feedback submit failed', e)
      return false
    }
  }

  const canLoadMore = items.length < total

  const filteredItems = React.useMemo(()=>{
    if (!Array.isArray(items)) return []
    if (displayLang === 'both') return items
    if (displayLang === 'english'){
      return items.filter(it => {
        return (it.question_english && String(it.question_english).trim()) ||
          (it.options_1_english || it.options_2_english || it.options_3_english || it.options_4_english)
      })
    }
    if (displayLang === 'hindi'){
      return items.filter(it => {
        return (it.question_hindi && String(it.question_hindi).trim()) ||
          (it.options_1_hindi || it.options_2_hindi || it.options_3_hindi || it.options_4_hindi)
      })
    }
    return items
  }, [items, displayLang])

  // live (debounced) search
  useEffect(()=>{
    const t = setTimeout(()=>{ fetchQuestions({ page: 1, append: false }) }, 300)
    return ()=> clearTimeout(t)
  }, [search])

  return (
    <div className="gk-wrapper" style={{paddingTop:0,background:'#fff'}}>
      <header className="gk-header gk-header--ca gk-header--compact">
        <div className="gk-header-top-compact" style={{padding:'8px 14px',borderBottom:'1px solid rgba(2,6,23,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',width:'100%'}}>
            <div style={{flex:'1 1 auto'}}>
              <h1 style={{margin:0,fontSize:18,lineHeight:'20px',color:'#073ea8'}}>General Knowledge</h1>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Daily General Knowledge Practice — English/Hindi</div>
            </div>

            <div style={{flex:'0 0 auto'}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div className={`floating small ${search ? 'has-value' : ''}`}>
                  <input
                    aria-label="Search questions"
                    placeholder="Search topics"
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}
                    style={{width:220,maxWidth:'60vw',padding:'8px 10px',borderRadius:8,border:'1px solid rgba(2,6,23,0.10)'}}
                  />
                </div>

                <div className="segmented-lang" role="tablist" aria-label="Language selector">
                  <button
                    type="button"
                    className={`segmented-btn ${displayLang === 'both' ? 'active' : ''}`}
                    aria-pressed={displayLang === 'both'}
                    onClick={() => setDisplayLang('both')}
                  >🌐</button>
                  <button
                    type="button"
                    className={`segmented-btn ${displayLang === 'english' ? 'active' : ''}`}
                    aria-pressed={displayLang === 'english'}
                    onClick={() => setDisplayLang('english')}
                  >EN</button>
                  <button
                    type="button"
                    className={`segmented-btn ${displayLang === 'hindi' ? 'active' : ''}`}
                    aria-pressed={displayLang === 'hindi'}
                    onClick={() => setDisplayLang('hindi')}
                  >HI</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact nav */}
        <div style={{background:'#fff',borderTop:'1px solid rgba(0,0,0,0.06)',borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
          <div style={{maxWidth:1100,margin:'0 auto',padding:'6px 12px',display:'flex',justifyContent:'center',gap:10}}>
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/' } }}>Home</button>
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/general-knowledge'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/general-knowledge' } }}>General Knowledge</button>
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/currentaffairs'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/currentaffairs' } }}>Current Affairs</button>
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/' } }}>Blog</button>
          </div>
        </div>

        {/* Filters: keep category and chapter here; language moved to top */}
        <div className="gk-header-filters gk-filters-row" style={{padding:'8px 14px'}}>
          <div className="gk-filter-row" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
            <div className="gk-filter-group" style={{minWidth:160}}>
              <label style={{fontSize:13,fontWeight:600,color:'#0f172a',marginBottom:6}}>Category</label>
              <select value={category} onChange={(e)=>setCategory(e.target.value)} style={{minWidth:160}}>
                <option value="">Category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="gk-filter-group" style={{minWidth:160}}>
              <label style={{fontSize:13,fontWeight:600,color:'#0f172a',marginBottom:6}}>Chapter</label>
              <select value={chapter} onChange={(e)=>setChapter(e.target.value)} style={{minWidth:160}}>
                <option value="">Chapter</option>
                {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="gk-toolbar">
        {hasFilters && <div className="gk-toolbar-chip">Filters active</div>}
      </div>

      {error && <div className="gk-error">{error}</div>}
      {loading && !loadingMore && !items.length ? <div className="gk-loading">Loading questions…</div> : null}

      <div className="gk-list-compact">
        <QuestionList
          items={filteredItems}
          total={total}
          loading={loadingMore}
          displayLang={displayLang}
          canLoadMore={canLoadMore}
          onFeedbackSubmit={submitFeedback}
        />
      </div>
      {/* Pagination: show numbered pages instead of Load More when total > PER_PAGE */}
      {total > PER_PAGE && (() => {
        const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
        const getVisible = () => {
          if (totalPages <= 3) return Array.from({length: totalPages}, (_,i) => i + 1)
          if (page <= 2) return [1,2,3]
          if (page >= totalPages - 1) return [totalPages - 2, totalPages - 1, totalPages]
          return [page - 1, page, page + 1]
        }
        const visible = getVisible()

        return (
          <div style={{display:'flex',gap:8,justifyContent:'center',alignItems:'center',marginTop:12}}>
            <button
              onClick={() => { if (page > 1) fetchQuestions({ page: page - 1, append: false }) }}
              disabled={loading || page <= 1}
              className="page-btn"
              style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(2,6,23,0.06)'}}
            >
              Prev
            </button>

            {visible.map(num => (
              <button
                key={num}
                onClick={() => { if (num !== page) fetchQuestions({ page: num, append: false }) }}
                disabled={loading || num === page}
                className={`page-btn ${num === page ? 'active' : ''}`}
                style={{padding:'8px 10px',borderRadius:8,border:num===page? '1px solid var(--accent)':'1px solid rgba(2,6,23,0.06)'}}
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => { if (page < totalPages) fetchQuestions({ page: page + 1, append: false }) }}
              disabled={loading || page >= totalPages}
              className="page-btn"
              style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(2,6,23,0.06)'}}
            >
              Next
            </button>
          </div>
        )
      })()}
    </div>
  )
}
