import React, { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'

function normalizeSlug(value) {
  if (value === undefined || value === null) return ''
  let slug = String(value).trim()
  if (!slug) return ''
  slug = slug.replace(/^[a-z]+:\/\//i, '')
  slug = slug.replace(/^\/\//, '')
  const firstSlash = slug.indexOf('/')
  if (firstSlash >= 0) {
    const hostCandidate = slug.slice(0, firstSlash)
    if (/^[A-Za-z0-9.-]+(?::\d+)?$/.test(hostCandidate)) {
      slug = slug.slice(firstSlash + 1)
    }
  }
  const hashIndex = slug.indexOf('#')
  if (hashIndex >= 0) slug = slug.slice(0, hashIndex)
  const queryIndex = slug.indexOf('?')
  if (queryIndex >= 0) slug = slug.slice(0, queryIndex)
  slug = slug.replace(/\\+/g, '/')
  slug = slug.replace(/^\.+/, '')
  slug = slug.replace(/\s+/g, '-')
  while (slug.includes('../')) slug = slug.replace('../', '/')
  while (slug.includes('/./')) slug = slug.replace('/./', '/')
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/+/, '')
  slug = slug.replace(/\/+$/, '')
  slug = slug.replace(/^\.+/, '')
  slug = slug.replace(/\.+$/, '')
  slug = slug.replace(/[^A-Za-z0-9\-._/]+/g, '')
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/+/, '')
  slug = slug.replace(/\/+$/, '')
  return slug
}

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
  const cleanSlug = normalizeSlug(slug)
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

  useEffect(() => {
    let active = true
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const signal = controller ? controller.signal : undefined

    async function load() {
      if (!cleanSlug) {
        setPage(null)
        setError('Page slug is missing.')
        setLoading(false)
        return
      }
      try { console.log('[DynamicPage] fetching slug=', cleanSlug) } catch (e) {}
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/pages/slug/${encodeURIComponent(cleanSlug)}`, { signal })
        try { console.log('[DynamicPage] fetch status=', res.status) } catch (e) {}
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
            <iframe
              title={page?.title || 'Dynamic Page'}
              className="dynamic-page-iframe"
              sandbox=""
              srcDoc={`<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">${page?.meta_title ? `<title>${String(page.meta_title).replace(/</g,'&lt;')}</title>` : ''}${page?.meta_description ? `<meta name=\"description\" content=\"${String(page.meta_description).replace(/"/g,'&quot;')}\">` : ''}</head><body>${page.content || ''}</body></html>`}
            />
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
