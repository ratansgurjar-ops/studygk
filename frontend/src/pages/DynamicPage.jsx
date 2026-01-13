import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'

import { normalizeSlugPath } from '../utils/slug'

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
  const [pageIndex, setPageIndex] = useState(0)
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const meta = useMemo(() => {
    const title = page?.meta_title || page?.title || 'Page'
    const descriptionSource = page?.meta_description || stripHtml(page?.content || '')
    const description = descriptionSource ? descriptionSource.slice(0, 160) : ''
    const keywords = page?.keywords || ''
    return { title, description, keywords }
  }, [page?.title, page?.meta_title, page?.meta_description, page?.content, page?.keywords])

  return (
    <div className="dynamic-page-shell">
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
        <article className="dynamic-page">
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
    </div>
  )
}
