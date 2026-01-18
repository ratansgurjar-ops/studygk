import React, { useEffect, useMemo, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'

import { normalizeSlugPath } from '../utils/slug'
import ExamNotes from './ExamNotes.jsx'

function stripHtml(html) {
  if (!html) return ''
  if (typeof document !== 'undefined') {
    const el = document.createElement('div')
    el.innerHTML = html
    return el.textContent || el.innerText || ''
  }
  return String(html).replace(/<[^>]*>/g, '')
}

export default function DynamicPage({ slug }) {
  const cleanSlug = normalizeSlugPath(slug)

  if (cleanSlug === 'examnotes') {
    return <ExamNotes />
  }

  const [pageIndex, setPageIndex] = useState(0)
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef(null)
  const [pageHeadHtml, setPageHeadHtml] = useState('')
  const [otherPages, setOtherPages] = useState([])
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false)

  useEffect(()=>{
    fetch('/api/pages-public')
      .then(r=>r.json())
      .then(d=> setOtherPages(Array.isArray(d) ? d : []))
      .catch(()=> setOtherPages([]))
  },[])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.add('dynamic-page-mode')
    return () => {
      document.body.classList.remove('dynamic-page-mode')
    }
  }, [])

  function extractBodyHtml(raw) {
    if (!raw) return ''
    const m = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (m && m[1]) return m[1]
    return String(raw)
      .replace(/<!doctype[^>]*>/i, '')
      .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/i, '')
      .replace(/<html[^>]*>/i, '')
      .replace(/<\/html>/i, '')
  }

  function extractHeadHtml(raw) {
    if (!raw) return ''
    const m = raw.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    if (m && m[1]) return m[1]
    return ''
  }

  useEffect(() => {
    let active = true
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const signal = controller ? controller.signal : undefined

    async function load() {
      if (!cleanSlug) {
        try { console.warn('[DynamicPage] missing cleanSlug, prop slug=', slug, 'cleanSlug=', cleanSlug, 'path=', window.location.pathname) } catch (e) {}
        setPage(null)
        setError('Page slug is missing. (check incoming slug and router)')
        setLoading(false)
        return
      }
      if (import.meta && import.meta.env && import.meta.env.DEV) {
        try { console.log('[DynamicPage] fetching slug=', cleanSlug) } catch (e) {}
      }
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/pages/slug/${encodeURIComponent(cleanSlug)}`, { signal })
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          try { console.log('[DynamicPage] fetch status=', res.status) } catch (e) {}
        }
        if (!active) return
        if (res.status === 404) {
          setPage(null)
          setError('not-found')
          setLoading(false)
          return
        }
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const message = body && body.error ? body.error : 'Failed to load page.'
          setPage(null)
          setError(message)
          setLoading(false)
          return
        }
        const data = await res.json()
        if (!active) return
        setPage(data || null)
        // extract head HTML (styles/scripts) when page contains a full document
        try {
          const raw = data && data.content ? String(data.content) : ''
          const headHtml = extractHeadHtml(raw)
          setPageHeadHtml(headHtml || '')
        } catch (err) { setPageHeadHtml('') }
        setPageIndex(0)
        setLoading(false)
      } catch (err) {
        if (!active) return
        if (err.name === 'AbortError') return
        console.error('Dynamic page fetch failed', err)
        setPage(null)
        setError('Unable to load page content.')
        setLoading(false)
      }
    }

    load()
    return () => {
      active = false
      if (controller) controller.abort()
    }
  }, [cleanSlug])

  // Execute any <script> tags present in the injected HTML because
  // browsers do not execute scripts inserted via innerHTML.
  useEffect(() => {
    try {
      const root = containerRef && containerRef.current
      if (!root) return
      // if head HTML exists, inject its styles and execute its scripts
      if (pageHeadHtml) {
        const temp = document.createElement('div')
        temp.innerHTML = pageHeadHtml
        // inject styles
        const styles = Array.from(temp.querySelectorAll('style'))
        styles.forEach(s => {
          const st = document.createElement('style')
          st.textContent = s.textContent || ''
          st.setAttribute('data-dynamic-head', '1')
          document.head.appendChild(st)
        })
        // inject link stylesheets
        const links = Array.from(temp.querySelectorAll('link[rel="stylesheet"]'))
        links.forEach(l => {
          const href = l.getAttribute('href')
          if (!href) return
          // avoid duplicates
          if (Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(existing => existing.href === href)) return
          const nl = document.createElement('link')
          nl.rel = 'stylesheet'
          nl.href = href
          nl.setAttribute('data-dynamic-head', '1')
          document.head.appendChild(nl)
        })
        // execute head scripts
        const headScripts = Array.from(temp.querySelectorAll('script'))
        headScripts.forEach(old => {
          const script = document.createElement('script')
          for (let i = 0; i < old.attributes.length; i++) {
            const a = old.attributes[i]
            if (a.name === 'src') script.src = a.value
            else if (a.name === 'type') script.type = a.value
            else if (a.name === 'async') script.async = true
            else script.setAttribute(a.name, a.value)
          }
          if (!old.src) script.textContent = old.textContent || ''
          script.setAttribute('data-dynamic-head', '1')
          document.head.appendChild(script)
        })
      }
      
      // find script tags inside the rendered content
      const contentNodes = root.querySelectorAll('.dynamic-page-content')
      contentNodes.forEach(node => {
        const scripts = Array.from(node.querySelectorAll('script'))
        scripts.forEach(old => {
          if (old.getAttribute('data-executed')) return
          const script = document.createElement('script')
          // copy attributes except innerHTML
          for (let i = 0; i < old.attributes.length; i++) {
            const a = old.attributes[i]
            if (a.name === 'src') {
              script.src = a.value
            } else if (a.name === 'type') {
              script.type = a.value
            } else if (a.name === 'async') {
              // preserve async if present
              script.async = true
            } else {
              script.setAttribute(a.name, a.value)
            }
          }
          // copy inline content
          if (!old.src) script.textContent = old.textContent || ''
          script.setAttribute('data-executed', '1')
          // replace the old script with the new one so it executes
          old.parentNode.insertBefore(script, old)
          old.parentNode.removeChild(old)
        })
      })
    } catch (err) {
      // non-fatal
      try { console.warn('DynamicPage script exec failed', err) } catch(e){}
    }
  }, [page, pageIndex])

  const meta = useMemo(() => {
    const title = page?.meta_title || page?.title || 'Page'
    const descriptionSource = page?.meta_description || stripHtml(page?.content || '')
    const description = descriptionSource ? descriptionSource.slice(0, 160) : ''
    const keywords = page?.keywords || ''
    return { title, description, keywords }
  }, [page?.title, page?.meta_title, page?.meta_description, page?.content, page?.keywords])

  return (
    <div className="dynamic-page-shell">
      <header className="dynamic-header">
        <a href="/">Home</a>
        <a href="/general-knowledge">General Knowledge</a>
        <a href="/currentaffairs">Current Affairs</a>
        <a href="/examnotes">Exam Notes</a>
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

      <Helmet>
        <title>{meta.title}</title>
        {meta.description && <meta name="description" content={meta.description} />}
        {meta.keywords && <meta name="keywords" content={meta.keywords} />}
      </Helmet>

      {loading ? (
        <div className="dynamic-page-status">Loading page…</div>
      ) : error === 'not-found' ? (
        <div className="dynamic-page-status">
          <h2>Page not found</h2>
          <p>This page does not exist or is unpublished.</p>
          <a href="/" onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }}>Return to homepage</a>
        </div>
      ) : error ? (
        <div className="dynamic-page-status">
          <h2>Something went wrong</h2>
          <p>{error}</p>
        </div>
      ) : (
        <article className="dynamic-page" ref={containerRef}>
          {page?.content ? (
            (function(){
              const raw = String(page.content || '')
              try { console.log('[DynamicPage] content length', raw.length) } catch(e){}
              const isFullDoc = /^\s*(?:<!doctype|<html\b)/i.test(raw)
              const looksLikeWord = /class=\"?Mso|<o:|<v:|<!--\[if|<\?xml/i.test(raw)
              const tooLarge = raw.length > 6000
              if (isFullDoc || looksLikeWord || tooLarge) {
                const cleaned = extractBodyHtml(raw)
                return (
                  <div>
                    <section className="dynamic-page-content" dangerouslySetInnerHTML={{ __html: cleaned }} />
                  </div>
                )
              }

              const marker = '<!--pagebreak-->'
              let segments = []
              if (raw.includes(marker)) {
                segments = raw.split(marker).map(s=>s || '')
              } else {
                const blockRegex = /(<[^>]+>[^<]*?<\/(?:p|div|h[1-6]|li|blockquote|section|article|table|ul|ol)>)/gi
                const parts = raw.match(blockRegex) || [raw]
                const target = 3000
                let acc = ''
                for (const part of parts) {
                  if ((acc + part).length > target && acc.trim()) {
                    segments.push(acc)
                    acc = part
                  } else {
                    acc += part
                  }
                }
                if (acc) segments.push(acc)
                if (segments.length === 1 && segments[0].length > target * 1.5) {
                  const s = segments[0]
                  segments = []
                  for (let i = 0; i < s.length; i += target) segments.push(s.slice(i, i + target))
                }
              }

              const idx = Math.max(0, Math.min(pageIndex, segments.length - 1))
              const showPagination = segments.length > 1
              return (
                <div>
                  <section className="dynamic-page-content" dangerouslySetInnerHTML={{ __html: segments[idx] || '' }} />
                  {showPagination && (
                    <div className="dynamic-page-pagination" aria-label="Page navigation">
                      <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center',marginTop:18,flexWrap:'wrap'}}>
                        {segments.map((_,i)=> (
                          <button key={i} onClick={()=>setPageIndex(i)} style={{fontWeight: i===idx?700:400,minWidth:36}}>{i+1}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()
          ) : (
            <section
              className="dynamic-page-content"
              dangerouslySetInnerHTML={{ __html: '' }}
            />
          )}
        </article>
      )}

      <style>{`
        .dynamic-header { display: flex; gap: 20px; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; align-items: center; background: #fff; justify-content: center; }
        .dynamic-header a, .header-link-btn { text-decoration: none; color: #334155; font-weight: 600; font-size: 1rem; background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; }
        .dynamic-header a:hover, .header-link-btn:hover { color: #2563eb; }
        
        .dropdown-menu { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: white; border: 1px solid #e2e8f0; z-index: 1000; min-width: 200px; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); padding: 5px 0; margin-top: 10px; }
        .dropdown-menu a { display: block; padding: 8px 16px; font-size: 0.9rem; font-weight: 500; color: #475569; text-align: left; }
        .dropdown-menu a:hover { background: #f1f5f9; color: #2563eb; }
      `}</style>
    </div>
  )
}