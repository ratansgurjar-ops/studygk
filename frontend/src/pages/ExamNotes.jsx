import React, { useState, useEffect, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'

// Helper to render math/latex if needed
const NoteContent = ({ html }) => {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}

export default function ExamNotes() {
  const [notesList, setNotesList] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [noteContent, setNoteContent] = useState(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedExams, setExpandedExams] = useState({})
  const [expandedSubjects, setExpandedSubjects] = useState({})
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [brandingData, setBrandingData] = useState({ categories: [], caChapters: [] })
  const [otherPages, setOtherPages] = useState([])
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false)

  useEffect(()=>{
    fetch('/api/pages-public')
      .then(r=>r.json())
      .then(d=> setOtherPages(Array.isArray(d) ? d : []))
      .catch(()=> setOtherPages([]))
  },[])

  // Fetch branding data (GK categories & CA chapters)
  useEffect(() => {
    fetch('/api/questions/meta')
      .then(r => r.json())
      .then(d => {
        setBrandingData(d || { categories: [], chapters: [] })
      })
      .catch(e => console.error(e))
  }, [])

  // Fetch list of notes on mount
  useEffect(() => {
    fetch('/api/public/notes')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setNotesList(list)
        setLoadingList(false)
        if (list.length > 0) {
          const first = list[0]
          setSelectedNoteId(first.id)
          const examKey = first.exam || 'Other Exams'
          const subjectKey = first.subject || 'General'
          setExpandedExams(prev => ({ ...prev, [examKey]: true }))
          setExpandedSubjects(prev => ({ ...prev, [`${examKey}-${subjectKey}`]: true }))
        }
      })
      .catch(err => {
        console.error(err)
        setLoadingList(false)
      })
  }, [])

  // Fetch specific note content when selected
  useEffect(() => {
    if (!selectedNoteId) return
    setLoadingNote(true)
    fetch(`/api/public/notes/${selectedNoteId}`)
      .then(r => r.json())
      .then(data => {
        setNoteContent(data)
        setLoadingNote(false)
        if (window.innerWidth < 768) setMobileSidebarOpen(false)
      })
      .catch(err => {
        console.error(err)
        setLoadingNote(false)
      })
  }, [selectedNoteId])

  // Organize notes into tree: Exam -> Subject -> Notes
  const tree = useMemo(() => {
    const t = {}
    const term = searchTerm.toLowerCase()
    
    notesList.forEach(note => {
      if (term) {
        const hay = (note.exam + ' ' + note.subject + ' ' + note.chapter).toLowerCase()
        if (!hay.includes(term)) return
      }

      const exam = note.exam || 'Other Exams'
      const subject = note.subject || 'General'
      
      if (!t[exam]) t[exam] = {}
      if (!t[exam][subject]) t[exam][subject] = []
      t[exam][subject].push(note)
    })
    return t
  }, [notesList, searchTerm])

  const toggleExam = (exam) => setExpandedExams(p => ({ ...p, [exam]: !p[exam] }))
  const toggleSubject = (subKey) => setExpandedSubjects(p => ({ ...p, [subKey]: !p[subKey] }))

  const formatContent = (text) => {
    if (!text) return ''
    let html = text
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')
      .replace(/(<\/h[1-6]>)(<br \/>)+/g, '$1')
    return html
  }

  return (
    <div className="exam-notes-page">
      <header className="dynamic-header">
        <a href="/">Home</a>
        <a href="/general-knowledge">General Knowledge</a>
        <a href="/currentaffairs">Current Affairs</a>
        <a href="/examnotes" className="active">Exam Notes</a>
        <a href="/">Blog</a>
        <div style={{position:'relative'}}>
          <button className="header-link-btn" onClick={()=>setOtherDropdownOpen(!otherDropdownOpen)}>Other</button>
          {otherDropdownOpen && (
            <div className="dropdown-menu">
              {otherPages.map(p => (
                <a key={p.id} href={`/${p.slug}`}>{p.title}</a>
              ))}
            </div>
          )}
        </div>
      </header>

    <div className="exam-notes-layout">
      <Helmet>
        <title>Exam Notes - OnlineCBT</title>
        <meta name="description" content="Read chapter-wise exam notes." />
        <style>{`
          @media print { body { display: none !important; } }
          /* Allow selection but prevent copy via JS */
          .restricted-content { user-select: text; -webkit-user-select: text; }
          .restricted-scroll-container { pointer-events: auto; overflow-y: auto; }
        `}</style>
      </Helmet>

      <div className="notes-mobile-header">
        <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
          {mobileSidebarOpen ? '✕ Close' : '☰ Topics'}
        </button>
        <span>Exam Notes</span>
      </div>

      {mobileSidebarOpen && <div className="mobile-sidebar-backdrop" onClick={() => setMobileSidebarOpen(false)} />}

      <aside className={`notes-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>📚 Library</h2>
          <input type="text" placeholder="Search topics..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="sidebar-content">
          {loadingList ? <div className="loading-msg">Loading topics...</div> : Object.keys(tree).length === 0 ? <div className="empty-msg">No notes found.</div> : (
            Object.keys(tree).map(exam => (
              <div key={exam} className="tree-exam">
                <div className={`tree-node-header ${expandedExams[exam] || searchTerm ? 'active' : ''}`} onClick={() => toggleExam(exam)}>
                  <span className="icon">🎓</span>
                  <span className="label">{exam}</span>
                  <span className="arrow">{expandedExams[exam] || searchTerm ? '▼' : '▶'}</span>
                </div>
                {(expandedExams[exam] || searchTerm) && (
                  <div className="tree-exam-children">
                    {Object.keys(tree[exam]).map(subject => {
                      const subKey = `${exam}-${subject}`
                      return (
                        <div key={subKey} className="tree-subject">
                          <div className={`tree-node-header sub ${expandedSubjects[subKey] || searchTerm ? 'active' : ''}`} onClick={() => toggleSubject(subKey)}>
                            <span className="icon">📖</span>
                            <span className="label">{subject}</span>
                          </div>
                          {(expandedSubjects[subKey] || searchTerm) && (
                            <div className="tree-subject-children">
                              {tree[exam][subject].map(note => (
                                <div key={note.id} className={`tree-item ${selectedNoteId === note.id ? 'selected' : ''}`} onClick={() => setSelectedNoteId(note.id)}>
                                  <span className="icon">📄</span>
                                  <span className="label">{note.chapter}</span>
                                  {note.language && <span className="lang-tag">{note.language.slice(0,2)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="notes-viewer">
        {loadingNote ? <div className="viewer-placeholder"><div className="spinner"></div><p>Loading document...</p></div> : !noteContent ? (
          <div className="viewer-placeholder">
            <div className="placeholder-icon">📑</div>
            <h2>Select a topic to start reading</h2>
          </div>
        ) : (
          <div className="document-container restricted-scroll-container">
            <div className="security-overlay" onContextMenu={(e) => e.preventDefault()}></div>
            <div className="document-paper" onCopy={(e) => { e.preventDefault(); alert('Copying content is not allowed.'); }}>
              <div className="doc-header">
                <div className="brand">OnlineCBT Notes</div>
                <div className="meta">{noteContent.exam} • {noteContent.subject}</div>
              </div>
              <div className="doc-watermark">www.onlinecbt.in<div className="sub">Read Only</div></div>
              <div className="doc-body restricted-content">
                <h1 className="chapter-title">{noteContent.chapter}</h1>
                <NoteContent html={formatContent(noteContent.content)} />
              </div>
              <div className="doc-footer">For more study materials visit <a href="https://www.onlinecbt.in" target="_blank" rel="noopener noreferrer" style={{color:'#1e40af'}}>www.onlinecbt.in</a></div>
            </div>
          </div>
        )}
      </main>

      </div>

      <style>{`
        .exam-notes-page { display: flex; flex-direction: column; height: 100vh; }
        .dynamic-header { display: flex; gap: 20px; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; align-items: center; background: #fff; justify-content: center; flex-shrink: 0; }
        .dynamic-header a, .header-link-btn { text-decoration: none; color: #334155; font-weight: 600; font-size: 1rem; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        .dynamic-header a:hover, .header-link-btn:hover { color: #2563eb; }
        .dynamic-header a.active { color: #2563eb; }
        .dropdown-menu { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; z-index: 1000; min-width: 200px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); padding: 5px 0; margin-top: 10px; }
        .dropdown-menu a { display: block; padding: 8px 16px; font-size: 0.9rem; font-weight: 500; color: #475569; text-align: left; }
        .dropdown-menu a:hover { background: #f1f5f9; color: #2563eb; }

        .exam-notes-layout { display: flex; flex: 1; background: #f1f5f9; overflow: hidden; font-family: 'Segoe UI', sans-serif; }
        .notes-sidebar { width: 300px; background: #fff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; transition: transform 0.3s ease; z-index: 50; }
        .sidebar-header { padding: 20px; border-bottom: 1px solid #f1f5f9; background: #fff; }
        .sidebar-header h2 { margin: 0 0 15px 0; font-size: 1.2rem; color: #1e3a8a; }
        .sidebar-header input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; outline: none; }
        .sidebar-header input:focus { border-color: #1e40af; background: #fff; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 10px 0; }
        .tree-node-header { display: flex; alignItems: center; padding: 10px 20px; cursor: pointer; color: #334155; font-weight: 600; transition: background 0.1s; user-select: none; }
        .tree-node-header:hover { background: #f0f9ff; color: #1e40af; }
        .tree-node-header.active { color: #1e40af; }
        .tree-node-header .icon { margin-right: 10px; opacity: 0.7; }
        .tree-node-header .label { flex: 1; }
        .tree-node-header .arrow { font-size: 0.7rem; opacity: 0.5; }
        .tree-node-header.sub { padding-left: 35px; font-size: 0.95rem; font-weight: 500; }
        .tree-item { display: flex; alignItems: center; padding: 8px 20px 8px 50px; cursor: pointer; font-size: 0.9rem; color: #475569; transition: all 0.1s; border-left: 3px solid transparent; }
        .tree-item:hover { background: #eff6ff; color: #1e3a8a; }
        .tree-item.selected { background: #eff6ff; color: #1e3a8a; border-left-color: #1e40af; font-weight: 500; }
        .tree-item .icon { margin-right: 8px; font-size: 0.9rem; }
        .tree-item .lang-tag { margin-left: auto; font-size: 0.65rem; background: #e2e8f0; padding: 2px 4px; borderRadius: 4px; text-transform: uppercase; color: #64748b; }
        .notes-viewer { flex: 1; position: relative; display: flex; flex-direction: column; overflow: hidden; }
        .viewer-placeholder { flex: 1; display: flex; flex-direction: column; alignItems: center; justify-content: center; color: #94a3b8; text-align: center; padding: 20px; }
        .placeholder-icon { font-size: 4rem; margin-bottom: 20px; opacity: 0.5; }
        .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #1e40af; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .document-container { flex: 1; padding: 40px; overflow-y: auto; background: #e2e8f0; position: relative; }
        .document-paper { max-width: 850px; margin: 0 auto; background: #fff; min-height: 1000px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); padding: 60px; position: relative; border-radius: 2px; overflow: hidden; }
        .security-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 100; }
        .doc-header { display: flex; justify-content: space-between; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; }
        .doc-header .brand { font-size: 1.2rem; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px; }
        .doc-header .meta { color: #64748b; font-size: 0.9rem; font-weight: 500; }
        .doc-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 6rem; font-weight: 900; color: rgba(0,0,0,0.03); white-space: nowrap; pointer-events: none; user-select: none; z-index: 0; text-align: center; }
        .doc-watermark .sub { font-size: 2rem; margin-top: 10px; letter-spacing: 10px; }
        .doc-body { position: relative; z-index: 1; line-height: 1.8; color: #334155; font-size: 1.05rem; }
        .doc-body h1.chapter-title { font-size: 2rem; color: #0f172a; margin-bottom: 15px; text-align: center; }
        .doc-body h1 { font-size: 1.5rem; color: #1e3a8a; margin-top: 15px; margin-bottom: 4px; }
        .doc-body h2 { font-size: 1.3rem; color: #1e40af; margin-top: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; margin-bottom: 4px; }
        .doc-body h3 { font-size: 1.1rem; color: #334155; margin-top: 10px; margin-bottom: 2px; }
        .doc-body ul, .doc-body ol { padding-left: 25px; margin-bottom: 15px; }
        .doc-body li { margin-bottom: 5px; }
        .doc-body strong { color: #0f172a; }
        .doc-footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 0.85rem; color: #94a3b8; font-weight: 500; }
        .notes-mobile-header { display: none; background: #fff; padding: 15px; border-bottom: 1px solid #e2e8f0; align-items: center; gap: 15px; position: relative; z-index: 51; }
        .notes-mobile-header button { background: none; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
        .notes-mobile-header span { font-weight: 700; color: #1e293b; }
        .mobile-sidebar-backdrop { display: none; }

        /* Right Branding Sidebar */
        .branding-sidebar-right { width: 240px; background: #fff; border-left: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; padding: 20px 15px; gap: 25px; }
        .branding-section h3 { font-size: 0.95rem; font-weight: 700; color: #1e3a8a; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px; }
        .branding-links { display: flex; flex-direction: column; gap: 8px; }
        .branding-link { text-decoration: none; color: #475569; font-size: 0.9rem; padding: 4px 0; transition: color 0.2s; display: block; }
        .branding-link:hover { color: #1e40af; transform: translateX(2px); }
        .branding-link.view-all { color: #1e40af; font-weight: 600; margin-top: 4px; font-size: 0.85rem; }
        .branding-link.highlight { color: #0f172a; font-weight: 600; }

        @media (max-width: 768px) {
          .exam-notes-layout { flex-direction: column; }
          .notes-mobile-header { display: flex; }
          .mobile-sidebar-backdrop { display: block; position: absolute; top: 57px; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 40; }
          .notes-sidebar { position: absolute; top: 57px; bottom: 0; left: 0; transform: translateX(-100%); width: 80%; max-width: 300px; box-shadow: 5px 0 15px rgba(0,0,0,0.1); }
          .notes-sidebar.open { transform: translateX(0); }
          .document-container { padding: 15px; }
          .document-paper { padding: 30px 20px; min-height: auto; }
          .doc-watermark { font-size: 3rem; }
          .branding-sidebar-right { display: none; }
        }
      `}</style>
    </div>
  )
}