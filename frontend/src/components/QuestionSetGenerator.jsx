import React, { useState, useEffect, useRef } from 'react'

const LatexRenderer = ({ text }) => {
  const spanRef = useRef(null)
  
  useEffect(() => {
    const render = () => {
      if (window.renderMathInElement && spanRef.current) {
        window.renderMathInElement(spanRef.current, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        })
      }
    }

    if (!window.katex) {
      if (!document.getElementById('katex-css')) {
        const link = document.createElement('link')
        link.id = 'katex-css'
        link.rel = 'stylesheet'
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'
        document.head.appendChild(link)
      }
      if (!document.getElementById('katex-js')) {
        const script = document.createElement('script')
        script.id = 'katex-js'
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'
        script.onload = () => {
          const autoRender = document.createElement('script')
          autoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js'
          autoRender.onload = render
          document.head.appendChild(autoRender)
        }
        document.head.appendChild(script)
      } else if (window.renderMathInElement) {
        render()
      } else {
        const check = setInterval(() => {
          if (window.renderMathInElement) {
            clearInterval(check)
            render()
          }
        }, 100)
      }
    } else {
      render()
    }
  }, [text])

  return <span ref={spanRef} dangerouslySetInnerHTML={{__html: text || ''}} />
}

export default function QuestionSetGenerator({ token }) {
  const [activeModule, setActiveModule] = useState('questions') // 'questions' or 'notes'

  // --- State: Configuration ---
  const [examConfig, setExamConfig] = useState({
    exam: 'SSC CGL',
    setName: 'Set-01',
    totalQuestions: 100,
    type: 'MCQ',
    includeSolution: true
  })

  // --- State: Syllabus Distribution ---
  // Structure: [{ id, subject: 'GK', count: 25, chapters: [{ name: 'History', count: 5 }] }]
  const [subjects, setSubjects] = useState([
    { id: 1, subject: 'General Knowledge', easy: 5, medium: 15, hard: 5, chapters: [] }
  ])

  // --- State: Generation Mode ---
  const [mode, setMode] = useState('ai') // 'ai' or 'bank'

  // --- State: PYP Details ---
  const [pypDetails, setPypDetails] = useState({ year: '2023', date: '', shift: '' })

  // --- State: Execution & Results ---
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressLog, setProgressLog] = useState([])
  const [view, setView] = useState('config') // 'config', 'generating', 'review'
  const [editingQ, setEditingQ] = useState(null) // Index of question being edited

  // --- State: Notes Generator ---
  const [noteConfig, setNoteConfig] = useState({
    exam: 'SSC CGL',
    subject: 'General Knowledge',
    chapter: '',
    subTopic: '',
    minWords: 1000,
    language: 'Hindi & English',
    strictMode: true,
    slug: '',
    meta_title: '',
    meta_description: ''
  })
  const [noteContent, setNoteContent] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [savedNotes, setSavedNotes] = useState([])

  // --- Helpers ---
  const addLog = (msg) => setProgressLog(prev => [...prev, msg])

  const handleConfigChange = (e) => {
    const { name, value } = e.target
    setExamConfig(prev => ({ ...prev, [name]: value }))
  }

  const updateSubject = (idx, field, val) => {
    const newSubjects = [...subjects]
    newSubjects[idx][field] = val
    setSubjects(newSubjects)
  }

  const addSubject = () => {
    setSubjects([...subjects, { id: Date.now(), subject: '', easy: 0, medium: 0, hard: 0, chapters: [] }])
  }

  const removeSubject = (idx) => {
    setSubjects(subjects.filter((_, i) => i !== idx))
  }

  const addChapter = (subjectIdx) => {
    const newSubjects = [...subjects]
    newSubjects[subjectIdx].chapters.push({ name: '', easy: 0, medium: 0, hard: 0 })
    setSubjects(newSubjects)
  }

  const updateChapter = (subjectIdx, chapterIdx, field, val) => {
    const newSubjects = [...subjects]
    newSubjects[subjectIdx].chapters[chapterIdx][field] = val
    setSubjects(newSubjects)
  }

  const removeChapter = (subjectIdx, chapterIdx) => {
    const newSubjects = [...subjects]
    newSubjects[subjectIdx].chapters = newSubjects[subjectIdx].chapters.filter((_, i) => i !== chapterIdx)
    setSubjects(newSubjects)
  }

  const getCount = (item) => Number(item.easy || 0) + Number(item.medium || 0) + Number(item.hard || 0)

  // --- Effects ---
  useEffect(() => {
    if (activeModule === 'saved-notes') {
      fetchSavedNotes()
    }
  }, [activeModule])

  const fetchSavedNotes = async () => {
    try {
      const res = await fetch('/api/admin/notes', { headers: { 'Authorization': token ? `Bearer ${token}` : '' } })
      if (res.ok) {
        const d = await res.json()
        setSavedNotes(Array.isArray(d) ? d : [])
      }
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    const s = (noteConfig.chapter || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setNoteConfig(prev => ({ ...prev, slug: s }))
  }, [noteConfig.chapter])

  const toggleNoteStatus = async (id, currentStatus) => {
    try {
      const newStatus = !currentStatus
      const res = await fetch(`/api/admin/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ active: newStatus })
      })
      if (!res.ok) throw new Error('Update failed')
      setSavedNotes(prev => prev.map(n => n.id === id ? { ...n, active: newStatus ? 1 : 0 } : n))
    } catch (e) { alert(e.message) }
  }

  // --- Core Logic: Generate ---
  const startGeneration = async () => {
    // Validation
    if (mode === 'pyp' && (!pypDetails.year || !pypDetails.year.trim())) {
      alert('Please enter a valid Year for the Previous Year Paper.')
      return
    }

    const totalConfigured = subjects.reduce((sum, s) => sum + getCount(s), 0)
    if (mode !== 'pyp' && totalConfigured !== Number(examConfig.totalQuestions)) {
      if (!window.confirm(`Total questions (${examConfig.totalQuestions}) does not match sum of subjects (${totalConfigured}). Continue anyway?`)) return
    }

    setIsGenerating(true)
    setView('generating')
    setProgressLog(['Starting generation process...'])
    setGeneratedQuestions([])

    const allQuestions = []
    const headers = { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }

    try {
      if (mode === 'pyp') {
        // PYP Mode: Generate based on Exam/Year/Shift (ignore subjects)
        addLog(`Retrieving Previous Year Paper: ${examConfig.exam} (${pypDetails.year})...`)
        let remaining = Number(examConfig.totalQuestions)
        
        while (remaining > 0) {
          const batchSize = Math.min(remaining, 15) // AI batch limit
          addLog(`> Fetching batch of ${batchSize} questions...`)
          // For PYP, we pass special subject/chapter markers or handle in backend via pypDetails
          const qChunk = await fetchQuestions(headers, 'Previous Year Paper', `${pypDetails.year} ${pypDetails.shift}`, batchSize)
          allQuestions.push(...qChunk)
          remaining -= qChunk.length
          if (qChunk.length === 0) break // Stop if no more data
        }
      } else {
        // Standard AI/Bank Mode: Use Syllabus Distribution
        for (const sub of subjects) {
          addLog(`Processing Subject: ${sub.subject}...`)
          
          // 1. Process defined chapters first
          let subUsed = { easy: 0, medium: 0, hard: 0 }

          for (const chap of sub.chapters) {
            if (chap.easy > 0) {
              addLog(`  > Generating ${chap.easy} Easy questions for chapter: ${chap.name}`)
              const qChunk = await fetchQuestions(headers, sub.subject, chap.name, chap.easy, 'Easy')
              allQuestions.push(...qChunk)
              subUsed.easy += Number(chap.easy)
            }
            if (chap.medium > 0) {
              addLog(`  > Generating ${chap.medium} Medium questions for chapter: ${chap.name}`)
              const qChunk = await fetchQuestions(headers, sub.subject, chap.name, chap.medium, 'Medium')
              allQuestions.push(...qChunk)
              subUsed.medium += Number(chap.medium)
            }
            if (chap.hard > 0) {
              addLog(`  > Generating ${chap.hard} Hard questions for chapter: ${chap.name}`)
              const qChunk = await fetchQuestions(headers, sub.subject, chap.name, chap.hard, 'Hard')
              allQuestions.push(...qChunk)
              subUsed.hard += Number(chap.hard)
            }
          }

          // 2. Process remaining count for subject (general/mixed chapters)
          const remEasy = Number(sub.easy) - subUsed.easy
          const remMedium = Number(sub.medium) - subUsed.medium
          const remHard = Number(sub.hard) - subUsed.hard

          const difficulties = [['Easy', remEasy], ['Medium', remMedium], ['Hard', remHard]]
          for (const [diff, count] of difficulties) {
            if (count > 0) {
              addLog(`  > Generating ${count} ${diff} mixed questions for ${sub.subject}`)
              const qChunk = await fetchQuestions(headers, sub.subject, 'Mixed Topics', count, diff)
              allQuestions.push(...qChunk)
            }
          }
        }
      }
      
      setGeneratedQuestions(allQuestions)
      addLog('Generation complete!')
      setTimeout(() => setView('review'), 1000)
    } catch (err) {
      console.error(err)
      let msg = err.message
      if (msg.includes('insufficient_quota') || msg.includes('429')) {
        msg = 'OpenAI API Quota Exceeded. Please check your billing/credits at platform.openai.com.'
      }
      addLog(`Error: ${msg}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const fetchQuestions = async (headers, subject, chapter, count, difficulty) => {
    const endpoint = (mode === 'ai' || mode === 'pyp') ? '/api/admin/ai/generate' : '/api/questions/pick'
    
    // Fix: When picking from bank, 'Mixed Topics' means any chapter (send empty string)
    const apiChapter = (mode === 'bank' && chapter === 'Mixed Topics') ? '' : chapter

    // Strict instructions for AI/PYP generation
    let instructions = ''
    if (mode === 'pyp') {
      instructions = `STRICT REQUIREMENT: Provide ONLY actual questions that appeared in the ${examConfig.exam} exam for the year ${pypDetails.year}. Do not generate simulated or practice questions. Ensure questions are historically accurate. PROVIDE HINDI TRANSLATION for Question and All Options.`
    } else if (mode === 'ai') {
      instructions = `Generate questions based on the last 5 years of Previous Year Questions (PYQ) trends for ${examConfig.exam}. Adhere strictly to the official government syllabus and chapter-wise weightage. Ensure questions match the difficulty and style of recent exams. PROVIDE HINDI TRANSLATION for Question and All Options.`
    }

    const payload = {
      exam: examConfig.exam,
      subject,
      chapter: apiChapter,
      count,
      difficulty: difficulty || 'Medium',
      type: examConfig.type,
      excludeIds: generatedQuestions.map(q => q.id).filter(Boolean), // For bank mode
      mode, // Pass mode to backend
      pypDetails, // Pass PYP details if applicable
      includeSolution: examConfig.includeSolution,
      instructions // Pass strict instructions to backend
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Fetch failed')
    
    // Normalize data
    return (data.questions || []).map(q => ({
      ...q,
      category: q.category || subject,
      chapter_name: q.chapter_name || chapter,
      difficulty_level: q.difficulty_level || difficulty || 'Medium'
    }))
  }

  // --- Review Actions ---
  const handleSaveSet = async () => {
    if (!generatedQuestions.length) return
    if (!window.confirm('Approve and Save this Question Set?')) return
    
    setIsGenerating(true)
    const headers = { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }
    
    try {
      let questionIds = []
      
      // 1. If AI or PYP mode, save questions to DB first to get IDs
      if (mode === 'ai' || mode === 'pyp') {
        addLog('Saving new questions to Question Bank...')
        const bulkRes = await fetch('/api/questions/bulk', {
          method: 'POST',
          headers,
          body: JSON.stringify({ items: generatedQuestions })
        })
        const bulkData = await bulkRes.json()
        if (!bulkRes.ok) throw new Error(bulkData.error)
        
        addLog(`Saved ${bulkData.inserted} questions to bank.`)
        
        // Use returned questions with IDs
        if (bulkData.questions && Array.isArray(bulkData.questions)) {
          questionIds = bulkData.questions.map(q => q.id).filter(Boolean)
        }
      } else {
        // Bank mode: questions already have IDs
        questionIds = generatedQuestions.map(q => q.id).filter(Boolean)
      }

      // 2. Create the Question Set Record if we have IDs
      if (questionIds.length > 0) {
        const setRes = await fetch('/api/admin/question-sets', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: examConfig.setName,
            exam_name: examConfig.exam,
            total_questions: questionIds.length,
            items: questionIds
          })
        })
        if (!setRes.ok) throw new Error('Failed to create set')
        addLog('Question Set created successfully!')
      } else {
        addLog('Warning: Could not create set (missing question IDs). Questions might be saved to bank.')
      }

      alert('Process Complete!')
      setView('config')
    } catch (err) {
      console.error(err)
      alert('Error saving: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteQuestion = (idx) => {
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const regenerateQuestion = async (idx) => {
    const q = generatedQuestions[idx]
    if (!q) return
    
    try {
      const headers = { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' }
      const [newQ] = await fetchQuestions(headers, q.category, q.chapter_name, 1, q.difficulty_level)
      if (newQ) {
        setGeneratedQuestions(prev => {
          const copy = [...prev]
          copy[idx] = newQ
          return copy
        })
      }
    } catch (e) {
      alert('Regeneration failed: ' + e.message)
    }
  }

  // --- Notes Actions ---
  const generateNotes = async () => {
    if (!noteConfig.chapter) return alert('Please enter a chapter name')
    setNoteLoading(true)
    setNoteContent('')
    try {
      const res = await fetch('/api/admin/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify(noteConfig)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed. Ensure backend supports /api/admin/ai/generate-notes')
      setNoteContent(data.content || data.notes || '')
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setNoteLoading(false)
    }
  }

  const saveNotesToDb = async () => {
    if (!noteContent) return alert('Please enter content before saving.')
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({
          ...noteConfig,
          minWords: Number(noteConfig.minWords),
          content: noteContent,
          slug: noteConfig.slug,
          meta_title: noteConfig.meta_title,
          meta_description: noteConfig.meta_description,
          active: 1
        })
      })
      if (!res.ok) throw new Error('Save failed')
      alert('Notes saved to database successfully!')
    } catch (e) {
      alert(e.message)
    }
  }

  // --- Helper: Format Markdown for PDF/Preview ---
  const formatMarkdown = (text) => {
    if (!text) return ''
    // Basic inline formatting
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Block formatting
    const lines = html.split('\n')
    let output = ''
    let inList = false

    lines.forEach(line => {
      const trim = line.trim()
      if (!trim) return

      if (trim.startsWith('# ')) {
        if (inList) { output += '</ul>'; inList = false }
        output += `<h1 style="font-size:24px; color:#1e3a8a; margin-top:10px; margin-bottom:5px;">${trim.substring(2)}</h1>`
      } else if (trim.startsWith('## ')) {
        if (inList) { output += '</ul>'; inList = false }
        output += `<h2 style="font-size:20px; color:#2563eb; margin-top:10px; margin-bottom:5px; border-bottom:1px solid #e2e8f0; padding-bottom:3px;">${trim.substring(3)}</h2>`
      } else if (trim.startsWith('### ')) {
        if (inList) { output += '</ul>'; inList = false }
        output += `<h3 style="font-size:18px; color:#334155; margin-top:8px; margin-bottom:4px;">${trim.substring(4)}</h3>`
      } else if (trim.startsWith('- ') || trim.startsWith('* ')) {
        if (!inList) { output += '<ul style="padding-left:20px; margin-bottom:10px;">'; inList = true }
        output += `<li style="margin-bottom:4px;">${trim.substring(2)}</li>`
      } else {
        if (inList) { output += '</ul>'; inList = false }
        output += `<p style="margin-bottom:6px; line-height:1.5;">${trim}</p>`
      }
    })
    if (inList) output += '</ul>'
    return output
  }

  const downloadNotesPDF = (data = null) => {
    // Use passed data (from saved list) or current state (from generator)
    const source = (data && data.content) ? data : { ...noteConfig, content: noteContent }
    
    if (!source.content) return
    const formattedBody = formatMarkdown(source.content)
    const w = window.open('', '_blank')
    w.document.write(`
      <html>
      <head>
        <title>${source.chapter} Notes</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 16px; }
          .page-content { padding: 50px 20px 40px 20px; width: 100%; max-width: 100%; margin: 0; position: relative; z-index: 1; }
          .header { position: fixed; top: 0; left: 0; padding: 10px 20px; font-weight: bold; font-size: 18px; color: #2563eb; width: 100%; background: rgba(255,255,255,0.95); z-index: 10; border-bottom: 1px solid #f1f5f9; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 90px; color: rgba(7, 6, 6, 0.14); z-index: 0; white-space: nowrap; pointer-events: none; font-weight: bold; user-select: none; font-family: sans-serif; }
          .footer { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; padding: 12px; background: #fff; color: #e11d48; font-weight: bold; border-top: 1px solid #f1f5f9; font-size: 14px; z-index: 10; }
          .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f1f5f9; }
          a { color: #e11d48; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="header">OnlineCBT</div>
        <div class="watermark">www.onlinecbt.in</div>
        
        <div class="page-content">
          <h1 style="font-size:32px; margin-bottom:10px; color:#0f172a;">${source.chapter}</h1>
          <div class="meta">
            <strong>Exam:</strong> ${source.exam} &nbsp;|&nbsp; <strong>Subject:</strong> ${source.subject} &nbsp;|&nbsp; <strong>Lang:</strong> ${source.language}
          </div>
          
          <div class="notes-body">
            ${formattedBody}
          </div>
        </div>

        <div class="footer">Adik tayari ke liye visit <a href="https://www.onlinecbt.in">www.onlinecbt.in</a> per kare</div>
        
        <script>
          window.onload = function(){ setTimeout(function(){ window.print(); }, 500); }
        </script>
      </body>
      </html>
    `)
    w.document.close()
  }

  // --- Render ---
  return (
    <div className="q-set-gen">
      <div className="module-tabs">
        <button 
          className={activeModule === 'questions' ? 'active' : ''} 
          onClick={() => setActiveModule('questions')}
        >
          Question Set Generator
        </button>
        <button 
          className={activeModule === 'notes' ? 'active' : ''} 
          onClick={() => setActiveModule('notes')}
        >
          Chapter Notes Generator
        </button>
        <button 
          className={activeModule === 'saved-notes' ? 'active' : ''} 
          onClick={() => setActiveModule('saved-notes')}
        >
          Saved Reports
        </button>
      </div>

      {activeModule === 'questions' && view === 'config' && (
        <div className="gen-step config-step">
          <h2>1. Configure Exam & Set</h2>
          <div className="form-grid">
            <label>Exam Name <input name="exam" value={examConfig.exam} onChange={handleConfigChange} /></label>
            <label>Set Name <input name="setName" value={examConfig.setName} onChange={handleConfigChange} /></label>
            <label>Total Questions <input type="number" name="totalQuestions" value={examConfig.totalQuestions} onChange={handleConfigChange} /></label>
            <label style={{flexDirection:'row', alignItems:'center', gap:'8px', marginTop:'28px'}}>
              <input type="checkbox" name="includeSolution" checked={examConfig.includeSolution} onChange={e => setExamConfig({...examConfig, includeSolution: e.target.checked})} />
              Generate with Solution
            </label>
          </div>
          
          {mode === 'pyp' && (
            <div className="form-grid" style={{marginTop: '15px', background: '#f0f9ff', padding: '15px', borderRadius: '8px', border: '1px solid #bae6fd'}}>
              <div style={{gridColumn: '1 / -1', marginBottom: '5px', color: '#0369a1', fontSize: '0.85rem'}}>
                <strong>Strict Validation Active:</strong> Only actual questions from the specified year will be retrieved.
              </div>
              <label>Year <input value={pypDetails.year} onChange={e => setPypDetails({...pypDetails, year: e.target.value})} placeholder="e.g. 2023" /></label>
              <label>Date (Optional) <input value={pypDetails.date} onChange={e => setPypDetails({...pypDetails, date: e.target.value})} placeholder="DD/MM/YYYY" /></label>
              <label>Shift (Optional) <input value={pypDetails.shift} onChange={e => setPypDetails({...pypDetails, shift: e.target.value})} placeholder="e.g. Morning / Shift 1" /></label>
            </div>
          )}

          {mode !== 'pyp' && (
            <>
              <h2>2. Syllabus Distribution</h2>
              {mode === 'ai' && <div style={{marginBottom: '15px', color: '#059669', fontSize: '0.85rem', background: '#ecfdf5', padding: '10px', borderRadius: '6px', border: '1px solid #a7f3d0'}}>
                <strong>AI Enhanced:</strong> Questions will be generated based on last 5 years PYQ trends & official Govt syllabus weightage.
              </div>}
              <div className="subjects-list">
                {subjects.map((sub, sIdx) => (
                  <div key={sub.id} className="subject-card">
                    <div className="sub-header">
                      <input placeholder="Subject Name" value={sub.subject} onChange={e => updateSubject(sIdx, 'subject', e.target.value)} />
                      <div className="diff-inputs">
                        <label>E <input type="number" value={sub.easy} onChange={e => updateSubject(sIdx, 'easy', e.target.value)} /></label>
                        <label>M <input type="number" value={sub.medium} onChange={e => updateSubject(sIdx, 'medium', e.target.value)} /></label>
                        <label>H <input type="number" value={sub.hard} onChange={e => updateSubject(sIdx, 'hard', e.target.value)} /></label>
                        <span className="total-badge">Total: {getCount(sub)}</span>
                      </div>
                      <button onClick={() => removeSubject(sIdx)} className="danger-btn">×</button>
                    </div>
                    <div className="chapters-list">
                      {sub.chapters.map((chap, cIdx) => (
                        <div key={cIdx} className="chapter-row">
                          <span>↳</span>
                          <input placeholder="Chapter/Topic" value={chap.name} onChange={e => updateChapter(sIdx, cIdx, 'name', e.target.value)} />
                          <div className="diff-inputs small">
                            <input type="number" placeholder="E" title="Easy" value={chap.easy} onChange={e => updateChapter(sIdx, cIdx, 'easy', e.target.value)} />
                            <input type="number" placeholder="M" title="Medium" value={chap.medium} onChange={e => updateChapter(sIdx, cIdx, 'medium', e.target.value)} />
                            <input type="number" placeholder="H" title="Hard" value={chap.hard} onChange={e => updateChapter(sIdx, cIdx, 'hard', e.target.value)} />
                            <span className="total-badge-small">{getCount(chap)}</span>
                          </div>
                          <button onClick={() => removeChapter(sIdx, cIdx)} className="text-btn">Remove</button>
                        </div>
                      ))}
                      <button onClick={() => addChapter(sIdx)} className="add-btn small">+ Add Chapter Rule</button>
                    </div>
                  </div>
                ))}
                <button onClick={addSubject} className="add-btn">Add Subject</button>
              </div>
            </>
          )}

          <h2>{mode === 'pyp' ? '2. Generation Mode' : '3. Generation Mode'}</h2>
          <div className="mode-select">
            <label>
              <input type="radio" name="mode" checked={mode === 'ai'} onChange={() => setMode('ai')} />
              Generate New (AI)
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'pyp'} onChange={() => setMode('pyp')} />
              Previous Year Paper (AI)
            </label>
            <label>
              <input type="radio" name="mode" checked={mode === 'bank'} onChange={() => setMode('bank')} />
              From Bank
            </label>
          </div>

          <div className="actions">
            <button onClick={startGeneration} className="primary-btn big">Start Generation</button>
          </div>
        </div>
      )}

      {activeModule === 'questions' && view === 'generating' && (
        <div className="gen-step generating-step">
          <h3>Generating Question Set...</h3>
          <div className="console-log">
            {progressLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}

      {activeModule === 'questions' && view === 'review' && (
        <div className="gen-step review-step">
          <div className="review-header">
            <h3>Review Set: {examConfig.setName} ({generatedQuestions.length})</h3>
            <div className="review-actions">
              <button onClick={() => setView('config')} className="secondary-btn">Back to Config</button>
              <button onClick={handleSaveSet} className="primary-btn">Approve & Save</button>
            </div>
          </div>

          <div className="questions-preview">
            {generatedQuestions.map((q, idx) => (
              <div key={idx} className="q-card">
                <div className="q-meta">
                  <span className="badge">{q.category}</span>
                  <span className="badge">{q.chapter_name}</span>
                  <span className="badge">{q.difficulty_level}</span>
                  <div className="q-tools">
                    {mode === 'ai' && <button onClick={() => regenerateQuestion(idx)} title="Regenerate">↻</button>}
                    <button onClick={() => deleteQuestion(idx)} title="Delete" className="danger">🗑</button>
                  </div>
                </div>
                
                {editingQ === idx ? (
                  <div className="edit-mode">
                    <label style={{display:'block',fontSize:'0.8rem',marginBottom:'2px'}}>English Question</label>
                    <textarea value={q.question_english} onChange={e => {
                      const copy = [...generatedQuestions]; copy[idx].question_english = e.target.value; setGeneratedQuestions(copy);
                    }} />
                    <label style={{display:'block',fontSize:'0.8rem',marginBottom:'2px'}}>Hindi Question</label>
                    <textarea value={q.question_hindi || ''} onChange={e => {
                      const copy = [...generatedQuestions]; copy[idx].question_hindi = e.target.value; setGeneratedQuestions(copy);
                    }} />
                    <button onClick={() => setEditingQ(null)}>Done</button>
                  </div>
                ) : (
                  <div className="q-content" onClick={() => setEditingQ(idx)}>
                    <div style={{marginBottom: '8px'}}>
                      <strong>Q{idx+1}:</strong> <LatexRenderer text={q.question_english} />
                      {q.question_hindi && (
                        <div style={{marginTop:'4px', color:'#4b5563'}}>
                          <strong>(हिंदी):</strong> <LatexRenderer text={q.question_hindi} />
                        </div>
                      )}
                    </div>
                    {q.image_description && <div className="img-desc"><em>[Diagram: {q.image_description}]</em></div>}
                    <div className="opts">
                      <div>
                        A. <LatexRenderer text={q.options_1_english} />
                        {q.options_1_hindi && <div className="opt-hi" style={{fontSize:'0.85em', color:'#64748b'}}>{q.options_1_hindi}</div>}
                      </div>
                      <div>
                        B. <LatexRenderer text={q.options_2_english} />
                        {q.options_2_hindi && <div className="opt-hi" style={{fontSize:'0.85em', color:'#64748b'}}>{q.options_2_hindi}</div>}
                      </div>
                      <div>
                        C. <LatexRenderer text={q.options_3_english} />
                        {q.options_3_hindi && <div className="opt-hi" style={{fontSize:'0.85em', color:'#64748b'}}>{q.options_3_hindi}</div>}
                      </div>
                      <div>
                        D. <LatexRenderer text={q.options_4_english} />
                        {q.options_4_hindi && <div className="opt-hi" style={{fontSize:'0.85em', color:'#64748b'}}>{q.options_4_hindi}</div>}
                      </div>
                    </div>
                    <div className="ans">Ans: {q.answer}</div>
                    {q.solution && <div className="sol" style={{marginTop:'5px', color:'#475569', fontSize:'0.9rem'}}><strong>Sol:</strong> <LatexRenderer text={q.solution} /></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeModule === 'notes' && (
        <div className="gen-step config-step">
          <h2>AI Study Notes Generator</h2>
          <div className="form-grid">
            <label>Exam Name <input value={noteConfig.exam} onChange={e => setNoteConfig({...noteConfig, exam: e.target.value})} /></label>
            <label>Subject <input value={noteConfig.subject} onChange={e => setNoteConfig({...noteConfig, subject: e.target.value})} /></label>
            <label>Chapter / Topic <input value={noteConfig.chapter} onChange={e => setNoteConfig({...noteConfig, chapter: e.target.value})} placeholder="e.g. Mughal Empire" /></label>
            <label>Sub-Topic (Specific Focus) <input value={noteConfig.subTopic} onChange={e => setNoteConfig({...noteConfig, subTopic: e.target.value})} placeholder="e.g. Administration, Art & Architecture" /></label>
            <label>Minimum Words <input type="number" value={noteConfig.minWords} onChange={e => setNoteConfig({...noteConfig, minWords: e.target.value})} placeholder="e.g. 1000" /></label>
            <label>Language 
              <select value={noteConfig.language} onChange={e => setNoteConfig({...noteConfig, language: e.target.value})}>
                <option>Hindi & English (Hinglish)</option>
                <option>Hindi Only</option>
                <option>English Only</option>
              </select>
            </label>
            
            <label>Slug (Auto-generated) <input value={noteConfig.slug} onChange={e => setNoteConfig({...noteConfig, slug: e.target.value})} /></label>
            <label>Meta Title (SEO) <input value={noteConfig.meta_title} onChange={e => setNoteConfig({...noteConfig, meta_title: e.target.value})} /></label>
            <label>Meta Description (SEO) <textarea rows={2} value={noteConfig.meta_description} onChange={e => setNoteConfig({...noteConfig, meta_description: e.target.value})} /></label>
            
            <label>SEO Body / Content (Manual Edit) <textarea rows={6} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Generated content will appear here. You can also write manually." /></label>
            <div style={{gridColumn:'1/-1', marginTop:5}}>
              <button onClick={saveNotesToDb} className="primary-btn" style={{background:'#10b981'}}>Submit SEO & Content</button>
            </div>
          </div>
          <div className="actions">
            <button onClick={generateNotes} disabled={noteLoading} className="primary-btn big">
              {noteLoading ? 'Generating Notes...' : 'Generate Notes'}
            </button>
          </div>
          {noteContent && (
            <div className="notes-preview-area" style={{marginTop:20}}>
              <div className="notes-preview"><LatexRenderer text={formatMarkdown(noteContent)} /></div>
              <div className="actions" style={{marginTop:15, display:'flex', gap:10}}>
                <button onClick={saveNotesToDb} className="primary-btn">Save to Database</button>
                <button onClick={() => downloadNotesPDF(null)} className="secondary-btn">Download PDF</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeModule === 'saved-notes' && (
        <div className="gen-step">
          <h2>Saved Notes Reports</h2>
          <div className="saved-list">
            {savedNotes.length === 0 && <div style={{padding:20, color:'#666'}}>No saved reports found.</div>}
            {savedNotes.map(note => (
              <div key={note.id} className="saved-note-card">
                <div style={{flex:1}}>
                  <div style={{fontWeight:'bold', fontSize:'1.1rem', color:'#1e293b'}}>{note.chapter}</div>
                  <div style={{fontSize:'0.9rem', color:'#64748b', marginTop:4}}>
                    {note.exam} • {note.subject} • {note.language}
                  </div>
                  <div style={{fontSize:'0.8rem', color:'#94a3b8', marginTop:4}}>
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                  <div style={{marginTop:6}}>
                    <label style={{fontSize:'0.85rem', display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer'}}>
                      <input type="checkbox" checked={!!note.active} onChange={() => toggleNoteStatus(note.id, !!note.active)} /> Active (Visible to Public)
                    </label>
                  </div>
                </div>
                <button onClick={() => downloadNotesPDF(note)} className="secondary-btn" style={{whiteSpace:'nowrap'}}>Download PDF</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .q-set-gen { max-width: 1000px; margin: 0 auto; padding: 20px; background: #f8fafc; min-height: 80vh; }
        .module-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
        .module-tabs button { background: none; border: none; padding: 10px 15px; cursor: pointer; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .module-tabs button.active { color: #2563eb; border-bottom-color: #2563eb; background: #eff6ff; border-radius: 6px 6px 0 0; }
        .notes-preview { background: #fff; padding: 25px; border: 1px solid #1f74e2; border-radius: 8px; min-height: 300px; line-height: 1.7; color: #2f09b9; }
        
        .saved-note-card { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; margin-bottom: 10px; gap: 15px; }
        .saved-note-card:hover { border-color: #cbd5e1; box-shadow: 0 2px 5px rgba(0,0,0,0.03); }

        .gen-step { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        h2 { font-size: 1.2rem; margin-bottom: 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .form-grid label { display: flex; flex-direction: column; font-weight: 500; font-size: 0.9rem; color: #475569; }
        .form-grid input, .form-grid select { margin-top: 5px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
        
        .subject-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px; background: #fff; }
        .sub-header { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
        .sub-header input { font-weight: 600; flex: 1; padding: 8px; }
        .diff-inputs { display: flex; gap: 8px; align-items: center; }
        .diff-inputs label { flex-direction: row; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; }
        .diff-inputs input { width: 50px; padding: 4px; }
        .diff-inputs.small input { width: 40px; }
        .total-badge { background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
        .total-badge-small { font-size: 0.75rem; color: #64748b; margin-left: 4px; width: 20px; text-align: center; }
        .chapter-row { display: flex; gap: 10px; margin-left: 20px; margin-bottom: 8px; align-items: center; }
        .chapter-row input { padding: 6px; font-size: 0.9rem; }
        
        .add-btn { background: #eff6ff; color: #2563eb; border: 1px dashed #2563eb; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
        .add-btn.small { font-size: 0.8rem; padding: 4px 10px; margin-left: 20px; }
        .danger-btn { background: #fee2e2; color: #ef4444; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; }
        .text-btn { background: none; border: none; color: #64748b; font-size: 0.8rem; cursor: pointer; text-decoration: underline; }
        
        .mode-select { display: flex; gap: 20px; margin-bottom: 25px; }
        .mode-select label { display: flex; gap: 8px; align-items: center; cursor: pointer; font-weight: 500; }
        
        .primary-btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .primary-btn.big { width: 100%; padding: 15px; font-size: 1.1rem; }
        .secondary-btn { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        
        .console-log { background: #1e293b; color: #4ade80; padding: 20px; border-radius: 8px; font-family: monospace; height: 300px; overflow-y: auto; }
        
        .review-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: sticky; top: 0; background: white; z-index: 10; padding: 10px 0; border-bottom: 1px solid #eee; }
        .review-actions { display: flex; gap: 10px; }
        
        .q-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px; transition: all 0.2s; }
        .q-card:hover { border-color: #94a3b8; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .q-meta { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
        .badge { background: #f1f5f9; color: #475569; font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
        .q-tools { margin-left: auto; display: flex; gap: 5px; }
        .q-tools button { background: none; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer; padding: 2px 6px; }
        .q-tools button.danger { color: #ef4444; border-color: #fee2e2; }
        
        .q-content { cursor: pointer; }
        .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 10px 0; font-size: 0.9rem; color: #334155; }
        .ans { color: #16a34a; font-weight: 600; font-size: 0.9rem; }
        .img-desc { color: #6366f1; font-size: 0.85rem; margin-bottom: 5px; }
        
        .edit-mode textarea { width: 100%; height: 80px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 5px; }
      `}</style>
    </div>
  )
}