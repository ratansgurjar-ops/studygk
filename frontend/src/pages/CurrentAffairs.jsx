import React, { useState, useEffect, useMemo } from 'react'
import QuestionList from '../components/QuestionList'

const PER_PAGE = 10

export default function CurrentAffairs(){
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState([])
  const [chapters, setChapters] = useState([])

  const [search, setSearch] = useState('')
  // Lock the page to Current Affairs context by default
  const [category, setCategory] = useState('Current Affairs')
  const [chapter, setChapter] = useState('')
  const [displayLang, setDisplayLang] = useState('both')

  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [otherPages, setOtherPages] = useState([])
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false)

  useEffect(()=>{
    fetchMeta()
    fetchQuestions({ page: 1, append: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(()=>{
    fetch('/api/pages-public')
      .then(r=>r.json())
      .then(d=> setOtherPages(Array.isArray(d) ? d : []))
      .catch(()=> setOtherPages([]))
  },[])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.nav-dropdown-container')) {
        setOtherDropdownOpen(false);
      }
    };
    if (otherDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [otherDropdownOpen]);

  useEffect(()=>{
    fetchQuestions({ page: 1, append: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, chapter])

  const hasFilters = useMemo(()=> Boolean(category || chapter || search), [category, chapter, search])

  async function fetchMeta(){
    try{
      const res = await fetch('/api/questions/meta')
      if (!res.ok) return
      const d = await res.json()
      setCategories(Array.isArray(d.categories)?d.categories:[])
      setChapters(Array.isArray(d.chapters)?d.chapters:[])
    }catch(e){ console.error('meta load failed', e) }
  }

  async function fetchQuestions({ page: targetPage = 1, append = false } = {}){
    const params = new URLSearchParams()
    params.set('page', String(targetPage))
    params.set('limit', String(PER_PAGE))
    if (search.trim()) params.set('q', search.trim())
    // If page is locked to 'Current Affairs', query by chapter name substring
    if (category === 'Current Affairs') {
      params.set('chapter_like', 'Current Affairs')
    } else if (category) {
      params.set('category', category)
    }
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

  useEffect(()=>{
    const t = setTimeout(()=>{ fetchQuestions({ page: 1, append: false }) }, 300)
    return ()=> clearTimeout(t)
  }, [search])

  return (
    <div className="gk-wrapper" style={{paddingTop:0,background:'#fff'}}>
      {/* Compact Current Affairs header */}
      <header className="gk-header gk-header--ca gk-header--compact">
        <div className="gk-header-top-compact" style={{padding:'8px 14px',borderBottom:'1px solid rgba(2,6,23,0.06)'}}>
          <div style={{display:'flex',alignItems:'center',width:'100%'}}>
            <div style={{flex:'1 1 auto'}}>
              <h1 style={{margin:0,fontSize:18,lineHeight:'20px',color:'#073ea8'}}>Current Affairs</h1>
              <div style={{fontSize:12,color:'var(--muted)',marginTop:4}}>Daily MCQ Practice — English/Hindi</div>
            </div>

            <div style={{flex:'0 0 auto'}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <div className={`floating small ${search ? 'has-value' : ''}`}>
                  <input
                    aria-label="Search current affairs questions"
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
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/examnotes'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/examnotes' } }}>Exam Notes</button>
            <button className="nav-btn nav-btn--small" onClick={()=>{ try{ window.history.pushState({},'', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/' } }}>Blog</button>
            <div className="nav-dropdown-container" style={{position:'relative'}}>
              <button className="nav-btn nav-btn--small" onClick={()=>setOtherDropdownOpen(!otherDropdownOpen)}>Other</button>
              {otherDropdownOpen && (
                <div className="dropdown-menu" style={{position:'absolute', top:'100%', left:0, background:'white', border:'1px solid #e2e8f0', zIndex:1000, minWidth:160, borderRadius:8, boxShadow:'0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', overflow:'hidden'}}>
                  {otherPages.map(p => (
                    <a key={p.id} href={`/${p.slug}`} onClick={(e)=>{e.preventDefault(); try{ window.history.pushState({},'', `/${p.slug}`); window.dispatchEvent(new PopStateEvent('popstate')) }catch(err){ window.location.href = `/${p.slug}` }; setOtherDropdownOpen(false)}} style={{display:'block', padding:'8px 12px', textDecoration:'none', color:'#1e293b', fontSize:13, borderBottom:'1px solid #f1f5f9'}}>{p.title}</a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters (language) */}
        <div className="gk-header-filters gk-filters-row" style={{padding:'8px 14px'}}>
          <div className="gk-filter-row" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',width:'100%'}}>
            {/* Filters row intentionally left minimal for compact header */}
          </div>
        </div>
      </header>

      {hasFilters && category !== 'Current Affairs' ? (
        <div className="gk-toolbar">
          <div className="gk-toolbar-chip">Filters active</div>
        </div>
      ) : null}

      {error && <div className="gk-error">{error}</div>}
      {loading && !loadingMore && !items.length ? <div className="gk-loading">Loading questions…</div> : null}

      {/* Compact list layout consistent with CA theme */}
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

      {/* Numbered pagination */}
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
