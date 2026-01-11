import React, { useState, useEffect, useMemo } from 'react'

const emptyForm = {
  question_english: '',
  question_hindi: '',
  answer: '',
  category: '',
  chapter_name: '',
  solution: '',
  options_1_english: '',
  options_1_hindi: '',
  options_2_english: '',
  options_2_hindi: '',
  options_3_english: '',
  options_3_hindi: '',
  options_4_english: '',
  options_4_hindi: ''
}

function splitCsvLine(line = ''){
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++){
    const char = line[i]
    if (char === '"'){
      if (inQuotes && line[i + 1] === '"'){
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes){
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((part) => part.trim())
}

function parseCsv(content){
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length)
  if (!lines.length) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx] : ''
    })
    return row
  })
}

function autoSlug({ question_english = '', question_hindi = '' }){
  const english = question_english.trim()
  const hindi = question_hindi.trim()
  const source = english || hindi
  if (!source) return 'q-' + Date.now()
  const cleaned = source
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || ('q-' + Date.now())
}

export default function AdminGK({ token, initialCategoryFilter, initialChapterFilter }){
  const [items, setItems] = useState([])
  const PER_PAGE = 50
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(() => ({ ...emptyForm }))
  const [activeTab, setActiveTab] = useState('manage')
  const [bulkFile, setBulkFile] = useState(null)
  const [flagged, setFlagged] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(() => (initialCategoryFilter || ''))
  const [chapterFilter, setChapterFilter] = useState(() => (initialChapterFilter || ''))
  const [meta, setMeta] = useState({ categories: [], chapters: [] })
  const [displayLang, setDisplayLang] = useState('english')
  const [status, setStatus] = useState('')
  const [editingRowId, setEditingRowId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [savingRowId, setSavingRowId] = useState(null)
  const [rowLang, setRowLang] = useState({})

  useEffect(()=>{ fetchMeta(); fetchList({ append:false, page: 1 }) }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ fetchList({ append:false, page: 1 }) }, [categoryFilter, chapterFilter])
  // live search (debounced)
  React.useEffect(()=>{
    const t = setTimeout(()=>{ fetchList({ append:false, page: 1 }) }, 300)
    return ()=> clearTimeout(t)
  }, [search])

  const tokenHeader = useMemo(()=>{
    const tokenVal = token || localStorage.getItem('token') || ''
    return tokenVal ? { 'Authorization': 'Bearer ' + tokenVal } : {}
  }, [token])

  // determine whether to show per-question serial numbers
  const effectiveCategory = categoryFilter || initialCategoryFilter || ''
  const showSerial = effectiveCategory !== 'Current Affairs'

  async function fetchMeta(){
    try{
      const res = await fetch('/api/questions/meta')
      if (!res.ok) return
      const data = await res.json()
      setMeta({
        categories: Array.isArray(data.categories) ? data.categories : [],
        chapters: Array.isArray(data.chapters) ? data.chapters : []
      })
    }catch(err){
      console.error('load meta failed', err)
    }
  }

  async function fetchList({ append = false, page: targetPage = 1 } = {}){
    setLoading(true)
    try{
      const params = new URLSearchParams({ page: String(targetPage), limit: String(PER_PAGE) })
      if (search.trim()) params.set('q', search.trim())
      if (categoryFilter) params.set('category', categoryFilter)
      if (chapterFilter) params.set('chapter', chapterFilter)
      const res = await fetch('/api/questions?' + params.toString(), { headers: tokenHeader })
      if (!res.ok) throw new Error('Failed to load questions')
      const data = await res.json()
      const incoming = Array.isArray(data.items) ? data.items.slice() : []
      incoming.sort((a, b) => (Number(b?.id || 0) - Number(a?.id || 0)))
      const nextItems = append ? [...items, ...incoming] : incoming
      setItems(nextItems)
      setTotal(Number(data.total || incoming.length || 0))
      setPage(targetPage)
      // Do not derive categories/chapters from paginated results —
      // use the dedicated meta endpoint for full lists.
    }catch(err){
      console.error('fetch questions failed', err)
      if (!append) setItems([])
    }finally{
      setLoading(false)
    }
  }

  async function save(e){
    e.preventDefault()
    try{
      setStatus('Saving...')
      const payload = { ...form, slug: autoSlug(form) }
      const headers = { ...tokenHeader, 'Content-Type': 'application/json' }
      const res = await fetch('/api/questions', { method: 'POST', headers, body: JSON.stringify(payload) })
      if (!res.ok){
        const data = await res.json().catch(()=>({}))
        setStatus(data.error || 'Save failed')
        alert(data.error || 'Save failed')
        return
      }
      setStatus('Saved successfully')
      setForm({ ...emptyForm })
      await fetchList({ append:false, page: 1 })
      fetchMeta()
    }catch(err){
      console.error('save failed', err)
      setStatus('Save failed')
      alert('Save failed')
    }
  }

  function beginInlineEdit(item){
    setEditingRowId(item.id)
    setEditDraft({
      question_english: item.question_english || '',
      question_hindi: item.question_hindi || '',
      answer: item.answer || '',
      category: item.category || '',
      chapter_name: item.chapter_name || '',
      solution: item.solution || '',
      options_1_english: item.options_1_english || '',
      options_1_hindi: item.options_1_hindi || '',
      options_2_english: item.options_2_english || '',
      options_2_hindi: item.options_2_hindi || '',
      options_3_english: item.options_3_english || '',
      options_3_hindi: item.options_3_hindi || '',
      options_4_english: item.options_4_english || '',
      options_4_hindi: item.options_4_hindi || '',
      active: typeof item.active === 'number' ? item.active : (item.active ? 1 : 0)
    })
  }

  function cancelInlineEdit(){
    setEditingRowId(null)
    setEditDraft(null)
    setSavingRowId(null)
  }

  function updateInlineDraft(field, value){
    setEditDraft(prev => prev ? ({ ...prev, [field]: value }) : prev)
  }

  async function saveInlineEdit(id){
    if (!editDraft) return
    try{
      setSavingRowId(id)
      const payloadFields = [
        'question_english','question_hindi',
        'options_1_english','options_2_english','options_3_english','options_4_english',
        'options_1_hindi','options_2_hindi','options_3_hindi','options_4_hindi',
        'answer','category','chapter_name','solution','active'
      ]
      const payload = {}
      payloadFields.forEach((field)=>{
        if (Object.prototype.hasOwnProperty.call(editDraft, field)){
          payload[field] = editDraft[field]
        }
      })
      const headers = { ...tokenHeader, 'Content-Type': 'application/json' }
      const res = await fetch('/api/questions/' + id, { method: 'PATCH', headers, body: JSON.stringify(payload) })
      if (!res.ok){
        const data = await res.json().catch(()=>({}))
        alert(data.error || 'Update failed')
        return
      }
      cancelInlineEdit()
      await fetchList({ append:false, page: 1 })
      fetchMeta()
    }catch(err){
      console.error('inline save failed', err)
      alert('Update failed')
    }finally{
      setSavingRowId(null)
    }
  }

  async function removeItem(id){
    if (!window.confirm('Delete this question?')) return
    try{
      const res = await fetch('/api/questions/' + id, { method: 'DELETE', headers: tokenHeader })
      if (!res.ok) throw new Error('Delete failed')
      await fetchList({ append:false, page: 1 })
      fetchMeta()
    }catch(err){
      console.error('delete failed', err)
      alert('Delete failed')
    }
  }

  function handleFileSelect(e){
    setBulkFile(e.target.files && e.target.files[0])
  }

  async function doBulkImport(){
    if (!bulkFile) return alert('Select a file (JSON or CSV)')
    try{
      const contents = await bulkFile.text()
      let records = []
      const trimmed = contents.trim()
      if (trimmed.startsWith('[')){
        records = JSON.parse(trimmed)
      } else {
        records = parseCsv(trimmed)
      }
      if (!Array.isArray(records) || records.length === 0){
        alert('No rows detected')
        return
      }
      const headers = { ...tokenHeader, 'Content-Type': 'application/json' }
      const res = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: records })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok){
        alert(data.error || 'Bulk import failed')
        return
      }
      alert('Imported ' + (data.inserted || 0) + ' items')
      setBulkFile(null)
      await fetchList({ append:false, page: 1 })
      fetchMeta()
    }catch(err){
      console.error('bulk import failed', err)
      alert('Bulk import failed')
    }
  }

  async function loadFlagged(){
    try{
      const res = await fetch('/api/questions/flagged', { headers: tokenHeader })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setFlagged(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('flagged load failed', err)
      setFlagged([])
    }
  }

  async function loadFeedbacks(){
    try{
      const res = await fetch('/api/questions/feedbacks', { headers: tokenHeader })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setFeedbacks(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('feedbacks load failed', err)
      setFeedbacks([])
    }
  }

  const showEnglish = displayLang === 'english'
  const showHindi = displayLang === 'hindi'

  return (
    <div className="admin-gk">
      <div className="admin-gk-tabs">
        <button className={activeTab==='manage'?'active':''} onClick={()=>setActiveTab('manage')}>Manage</button>
        <button className={activeTab==='bulk'?'active':''} onClick={()=>setActiveTab('bulk')}>Bulk Import</button>
        <button className={activeTab==='flags'?'active':''} onClick={()=>{ setActiveTab('flags'); loadFlagged() }}>Flagged</button>
        <button className={activeTab==='feedbacks'?'active':''} onClick={()=>{ setActiveTab('feedbacks'); loadFeedbacks() }}>Feedbacks</button>
      </div>

      {activeTab === 'manage' && (
        <div className="admin-gk-manage">
          <form className="admin-gk-form" onSubmit={save}>
            <div className="form-grid">
              <div>
                <label>Question (English)</label>
                <textarea rows={2} value={form.question_english} onChange={(e)=>setForm(f=>({...f,question_english:e.target.value}))} required />
              </div>
              <div>
                <label>Question (Hindi)</label>
                <textarea rows={2} value={form.question_hindi} onChange={(e)=>setForm(f=>({...f,question_hindi:e.target.value}))} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Option A (EN)</label>
                <input value={form.options_1_english} onChange={(e)=>setForm(f=>({...f,options_1_english:e.target.value}))} />
              </div>
              <div>
                <label>Option A (HI)</label>
                <input value={form.options_1_hindi} onChange={(e)=>setForm(f=>({...f,options_1_hindi:e.target.value}))} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Option B (EN)</label>
                <input value={form.options_2_english} onChange={(e)=>setForm(f=>({...f,options_2_english:e.target.value}))} />
              </div>
              <div>
                <label>Option B (HI)</label>
                <input value={form.options_2_hindi} onChange={(e)=>setForm(f=>({...f,options_2_hindi:e.target.value}))} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Option C (EN)</label>
                <input value={form.options_3_english} onChange={(e)=>setForm(f=>({...f,options_3_english:e.target.value}))} />
              </div>
              <div>
                <label>Option C (HI)</label>
                <input value={form.options_3_hindi} onChange={(e)=>setForm(f=>({...f,options_3_hindi:e.target.value}))} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Option D (EN)</label>
                <input value={form.options_4_english} onChange={(e)=>setForm(f=>({...f,options_4_english:e.target.value}))} />
              </div>
              <div>
                <label>Option D (HI)</label>
                <input value={form.options_4_hindi} onChange={(e)=>setForm(f=>({...f,options_4_hindi:e.target.value}))} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Answer</label>
                <input value={form.answer} onChange={(e)=>setForm(f=>({...f,answer:e.target.value}))} required />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label>Category</label>
                <input list="gk-cat-list" value={form.category} onChange={(e)=>setForm(f=>({...f,category:e.target.value}))} />
                <datalist id="gk-cat-list">
                  {meta.categories.map((c)=> <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label>Chapter</label>
                <input list="gk-chapter-list" value={form.chapter_name} onChange={(e)=>setForm(f=>({...f,chapter_name:e.target.value}))} />
                <datalist id="gk-chapter-list">
                  {meta.chapters.map((c)=> <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div>
              <label>Solution / Explanation</label>
              <textarea rows={4} value={form.solution} onChange={(e)=>setForm(f=>({...f,solution:e.target.value}))} />
            </div>
            <div className="form-actions">
              <button type="submit">Create Question</button>
              <button type="button" onClick={()=>{ setForm({ ...emptyForm }); setStatus(''); }} className="secondary">Clear</button>
              {status && <span className="form-status">{status}</span>}
            </div>
          </form>

          <section className="admin-gk-list">
            <header className="list-toolbar">
              <div className="list-filters">
                <input placeholder="Search" value={search} onChange={(e)=>setSearch(e.target.value)} />
                <select value={categoryFilter} onChange={(e)=>{ setCategoryFilter(e.target.value); }}>
                  <option value="">All categories</option>
                  {meta.categories.map((c)=> <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={chapterFilter} onChange={(e)=>{ setChapterFilter(e.target.value); }}>
                  <option value="">All chapters</option>
                  {meta.chapters.map((c)=> <option key={c} value={c}>{c}</option>)}
                </select>
                
              </div>
            </header>

            {loading ? <div className="list-loading">Loading…</div> : (
              items.length ? (
                <div className="gk-admin-table-wrapper">
                  <table className="gk-admin-table">
                    <thead>
                      <tr>
                        {showSerial && <th style={{width: '72px'}}>SL No.</th>}
                        <th>Question</th>
                        <th>Option A</th>
                        <th>Option B</th>
                        <th>Option C</th>
                        <th>Option D</th>
                        <th>Answer</th>
                        <th>Category</th>
                        <th>Chapter</th>
                        <th>Solution</th>
                        <th>Stats</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const isEditing = editingRowId === it.id
                        const rowDraft = isEditing && editDraft ? editDraft : null
                        const lang = rowLang[it.id] || displayLang
                        const questionText = lang === 'english' ? (rowDraft ? rowDraft.question_english : it.question_english) : (rowDraft ? rowDraft.question_hindi : it.question_hindi)
                        const optionValue = (num) => {
                          const key = `options_${num}_${lang === 'english' ? 'english' : 'hindi'}`
                          return rowDraft ? (rowDraft[key] || '') : (it[key] || '')
                        }
                        const stats = {
                          flags: Number(it.flags_count || 0),
                          hits: Number(it.hits || 0)
                        }
                        return (
                          <tr key={it.id} className={isEditing ? 'editing' : ''}>
                            {showSerial && (
                              <td className="gk-cell-index">
                                <div style={{display:'flex',alignItems:'center',gap:8}}>
                                  <div style={{fontWeight:700}}>{idx + 1}</div>
                                  <div style={{display:'inline-flex',gap:6}}>
                                    <button type="button" className={ (rowLang[it.id] || displayLang) === 'english' ? 'icon-button active' : 'icon-button' } onClick={()=>setRowLang(r=>({ ...r, [it.id]: 'english' }))} aria-label="EN">
                                      EN
                                    </button>
                                    <button type="button" className={ (rowLang[it.id] || displayLang) === 'hindi' ? 'icon-button active' : 'icon-button' } onClick={()=>setRowLang(r=>({ ...r, [it.id]: 'hindi' }))} aria-label="HI">
                                      HI
                                    </button>
                                  </div>
                                </div>
                              </td>
                            )}
                            <td className="gk-cell-question">
                              {isEditing ? (
                                <>
                                  <textarea rows={3} value={questionText || ''} onChange={(e)=>updateInlineDraft(lang === 'english' ? 'question_english' : 'question_hindi', e.target.value)} />
                                </>
                              ) : (
                                <>
                                  {questionText ? (
                                    <div className={lang === 'english' ? 'en' : 'hi'}>{questionText}</div>
                                  ) : (
                                    <div className="muted">—</div>
                                  )}
                                </>
                              )}
                            </td>
                            {[1,2,3,4].map((num) => {
                              const field = `options_${num}_${showEnglish ? 'english' : 'hindi'}`
                              const optionText = optionValue(num)
                              return (
                                <td key={field} className="gk-cell-option">
                                  {isEditing ? (
                                    <textarea rows={2} value={rowDraft ? (rowDraft[field] || '') : ''} onChange={(e)=>updateInlineDraft(field, e.target.value)} />
                                  ) : (
                                    optionText ? <div>{optionText}</div> : <div className="muted">—</div>
                                  )}
                                </td>
                              )
                            })}
                            <td className="gk-cell-answer">
                              {isEditing ? (
                                <input value={rowDraft ? rowDraft.answer : ''} onChange={(e)=>updateInlineDraft('answer', e.target.value)} />
                              ) : (
                                it.answer || '—'
                              )}
                            </td>
                            <td className="gk-cell-meta">
                              {isEditing ? (
                                <input value={rowDraft ? rowDraft.category : ''} onChange={(e)=>updateInlineDraft('category', e.target.value)} placeholder="Category" />
                              ) : (
                                (it.category && it.category.trim()) ? it.category : <span className="muted">—</span>
                              )}
                            </td>
                            <td className="gk-cell-meta">
                              {isEditing ? (
                                <input value={rowDraft ? rowDraft.chapter_name : ''} onChange={(e)=>updateInlineDraft('chapter_name', e.target.value)} placeholder="Chapter" />
                              ) : (
                                (it.chapter_name && it.chapter_name.trim()) ? it.chapter_name : <span className="muted">—</span>
                              )}
                            </td>
                            <td className="gk-cell-solution">
                              {isEditing ? (
                                <textarea rows={3} value={rowDraft ? (rowDraft.solution || '') : ''} onChange={(e)=>updateInlineDraft('solution', e.target.value)} />
                              ) : (
                                it.solution ? <div className="solution-text" dangerouslySetInnerHTML={{ __html: it.solution }} /> : <div className="muted">—</div>
                              )}
                            </td>
                            <td className="gk-cell-stats">
                              <div>{`${stats.flags}, ${stats.hits}`}</div>
                            </td>
                            <td className="gk-cell-actions">
                              {isEditing ? (
                                <>
                                  <button type="button" className="icon-button" onClick={()=>saveInlineEdit(it.id)} disabled={savingRowId===it.id} aria-label="Save">
                                    {savingRowId===it.id ? '...' : (
                                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.5 11.793 3.354 8.646l-.708.708 4.5 4.5 6.5-6.5-.708-.708L6.5 11.793Z"/></svg>
                                    )}
                                  </button>
                                  <button type="button" className="icon-button secondary" onClick={cancelInlineEdit} disabled={savingRowId===it.id} aria-label="Cancel">
                                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="m8 8.707 3.646 3.647.708-.707L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.647.708.707L8 8.707Z"/></svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button type="button" className="icon-button" onClick={()=>beginInlineEdit(it)} aria-label="Edit">
                                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.146 2.146a.5.5 0 0 1 .708 0l1 1a.5.5 0 0 1 0 .708l-7.5 7.5-.007.007a.5.5 0 0 1-.102.077l-3 1.5a.5.5 0 0 1-.671-.671l1.5-3a.5.5 0 0 1 .077-.102l.007-.007 7.5-7.5Z"/><path fill="currentColor" d="m11.5 3.207-6.646 6.647-.854 1.707 1.707-.854L12.207 4.5l-0.707-0.707Z"/></svg>
                                  </button>
                                  <button type="button" className="icon-button danger" onClick={()=>removeItem(it.id)} aria-label="Delete">
                                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 1.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V2h3.5a.5.5 0 0 1 0 1h-.528l-.62 10.542A2 2 0 0 1 10.357 15H5.643a2 2 0 0 1-1.995-1.458L3.028 3H2.5a.5.5 0 0 1 0-1H6V1.5Zm1 .5h2V2H7v0Zm4.472 1H4.528l.61 10.378a1 1 0 0 0 .995.922h4.734a1 1 0 0 0 .995-.922L11.472 3Z"/><path fill="currentColor" d="M6.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Z"/></svg>
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="list-loading">No questions found.</div>
              )
            )}
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
                    onClick={() => { if (page > 1) fetchList({ page: page - 1, append: false }) }}
                    disabled={loading || page <= 1}
                    className="page-btn"
                    style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(2,6,23,0.06)'}}
                  >
                    Prev
                  </button>

                  {visible.map(num => (
                    <button
                      key={num}
                      onClick={() => { if (num !== page) fetchList({ page: num, append: false }) }}
                      disabled={loading || num === page}
                      className={`page-btn ${num === page ? 'active' : ''}`}
                      style={{padding:'8px 10px',borderRadius:8,border:num===page? '1px solid var(--accent)':'1px solid rgba(2,6,23,0.06)'}}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    onClick={() => { if (page < totalPages) fetchList({ page: page + 1, append: false }) }}
                    disabled={loading || page >= totalPages}
                    className="page-btn"
                    style={{padding:'8px 10px',borderRadius:8,border:'1px solid rgba(2,6,23,0.06)'}}
                  >
                    Next
                  </button>
                </div>
              )
            })()}
          </section>
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="admin-gk-bulk">
          <div className="bulk-card">
            <h3>Bulk Upload</h3>
            <p>Upload JSON or CSV with columns like question_english, question_hindi, options_1_english … answer, category, chapter_name, solution (slug optional; it auto-generates when missing).</p>
            <input type="file" accept=".json,.csv,text/csv,application/json" onChange={handleFileSelect} />
            <button onClick={doBulkImport}>Import Questions</button>
            <div className="bulk-tip">Tip: Ensure UTF-8 CSV to preserve Hindi characters.</div>
          </div>
        </div>
      )}

      {activeTab === 'flags' && (
        <div className="admin-gk-flags">
          <h3>Flagged items ({flagged.length})</h3>
          <div className="gk-admin-cards">
            {flagged.map((item)=>(
              <article key={item.id} className="gk-admin-card">
                <header>
                  <div className="gk-admin-meta">
                    {item.category && <span>{item.category}</span>}
                    <span>Flags: {item.flags_count || 0}</span>
                  </div>
                </header>
                <div className="gk-admin-question">
                  <div className="line">{item.question_english}</div>
                  {item.question_hindi && <div className="line hi">{item.question_hindi}</div>}
                </div>
              </article>
            ))}
            {!flagged.length && <div className="list-loading">No flagged questions 🎉</div>}
          </div>
        </div>
      )}

      {activeTab === 'feedbacks' && (
        <div className="admin-gk-feedbacks">
          <h3>Feedback ({feedbacks.length})</h3>
          <div className="feedback-list">
            {feedbacks.map((fb)=> (
              <article key={fb.id} className="feedback-card">
                <header>
                  <div>{fb.question_english || ('Question #' + fb.question_id)}</div>
                  <time>{fb.created_at ? new Date(fb.created_at).toLocaleString() : ''}</time>
                </header>
                <p>{fb.content}</p>
              </article>
            ))}
            {!feedbacks.length && <div className="list-loading">No feedback yet.</div>}
          </div>
        </div>
      )}
    </div>
  )
}
