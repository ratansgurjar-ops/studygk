import React, { useEffect, useState, useRef } from 'react'
import { displayAuthor } from '../utils'
import { Helmet } from 'react-helmet-async'
import EngagementControls from '../components/EngagementControls'

function stripHtml(html){
  if (!html) return ''
  return String(html).replace(/<[^>]*>/g, ' ')
}

function escapeHtml(unsafe) {
  if (!unsafe) return ''
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function linkify(text){
  if (!text) return ''
  // regex to find URLs like http(s):// or www. or domain.tld
  const urlRegex = /(?:(?:https?:\/\/)|(?:www\.))[^\s<]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,6}\b(\/[^\s<]*)?/ig
  return escapeHtml(text).replace(urlRegex, (match)=>{
    let url = match
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(match)}</a>`
  })
}

function normalizeUrl(u){
  if (!u) return '#'
  const s = String(u).trim()
  if (!s) return '#'
  if (/^https?:\/\//i.test(s)) return s
  return 'http://' + s
}


function excerptFromPost(post, maxLen){
  const txt = stripHtml(post?.summary || post?.content_preview || post?.content || '')
  const s = txt.replace(/\s+/g,' ').trim()
  if (!s) return ''
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen).replace(/\s+\S*$/,'').trim() + '…'
}

export default function Home({ search, setSearch }){
  const [blogs, setBlogs] = useState([])
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchPage, setSearchPage] = useState(1)
  const [searchTotal, setSearchTotal] = useState(0)
  const [pageMeta, setPageMeta] = useState({ title: 'StudyGKHub — Blog & Free Brand Features', description: 'Publish blog posts and get your brand featured for free. Submit your brand to earn quality backlinks and increase visibility.', keywords: '' })
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try{ return new URLSearchParams(window.location.search).get('category') || '' }catch(e){ return '' }
  })
  const [heroIndex, setHeroIndex] = useState(0)
  const [brands, setBrands] = useState([])
  const [amazonTag, setAmazonTag] = useState('')
  const [amazonEnabled, setAmazonEnabled] = useState(false)
  const [amazonDisclosure, setAmazonDisclosure] = useState('')
  useEffect(()=>{
    fetch('/api/blogs-lite')
      .then(r=>r.json())
      .then(data => setBlogs(Array.isArray(data) ? data : []))
      .catch(console.error)
  },[])

  useEffect(()=>{
    fetch('/api/brands')
      .then(r=>r.json())
      .then(data => setBrands(Array.isArray(data) ? data : []))
      .catch(()=>setBrands([]))
  },[])

  const [brandStrip, setBrandStrip] = useState([])
  const [news, setNews] = useState([])
  // fetch news helper (used for initial load and polling)
  const fetchNews = async ()=>{
    try{
      const r = await fetch('/api/news')
      if (!r.ok) { setNews([]); return }
      const d = await r.json()
      setNews(Array.isArray(d)?d:[])
    }catch(e){ console.error(e); setNews([]) }
  }
  const heroStripRef = useRef(null)
  const [expandedPosts, setExpandedPosts] = useState(new Set())
  const [showHeroOnMain, setShowHeroOnMain] = useState(true)
  const [showStripOnMain, setShowStripOnMain] = useState(true)
  useEffect(()=>{
    fetch('/api/brand-strip')
      .then(r=>r.json())
      .then(data => setBrandStrip(Array.isArray(data) ? data : []))
      .catch(()=>setBrandStrip([]))
  },[])

  const anyAmazonLink = (arr) => {
    if (!Array.isArray(arr)) return false
    return arr.some(i => i && i.link && /amazon\./i.test(String(i.link)))
  }

  const hitBrand = async (id) => {
    try {
      const url = '/api/hit/brand/' + encodeURIComponent(id)
      if (navigator && navigator.sendBeacon) {
        try { navigator.sendBeacon(url); return } catch(e) {}
      }
      // use keepalive where available
      fetch(url, { method: 'POST', keepalive: true }).catch(()=>{})
    } catch(e) {}
  }

  const hitStrip = async (id) => {
    try {
      const url = '/api/hit/brand-strip/' + encodeURIComponent(id)
      if (navigator && navigator.sendBeacon) {
        try { navigator.sendBeacon(url); return } catch(e) {}
      }
      fetch(url, { method: 'POST', keepalive: true }).catch(()=>{})
    } catch(e) {}
  }

  useEffect(()=>{
    fetchNews()
    const poll = setInterval(fetchNews, 10 * 1000)
    return ()=> clearInterval(poll)
  },[])

  useEffect(()=>{
    if (!heroStripRef.current) return
    const el = heroStripRef.current
    const next = ()=>{
      if (!el) return
      const max = el.scrollWidth - el.clientWidth
      if (el.scrollLeft >= max - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: el.clientWidth, behavior: 'smooth' })
      }
    }
    if (!showStripOnMain || !brandStrip || brandStrip.length <= 1) return
    const timer = setInterval(next, 30 * 1000)
    return ()=> clearInterval(timer)
  },[brandStrip, showStripOnMain])

  // fetch public settings for intervals, visibility and meta
  useEffect(()=>{
    fetch('/api/public-settings').then(r=>r.json()).then(s=>{
      setShowHeroOnMain(s.showHero !== false)
      setShowStripOnMain(s.showStrip !== false)
      setPageMeta({ title: s.homepage_meta_title || pageMeta.title, description: s.homepage_meta_description || pageMeta.description, keywords: s.site_keywords || '' })
      setAmazonTag(s.amazon_affiliate_tag || '')
      setAmazonEnabled(!!s.amazon_affiliate_enabled)
      setAmazonDisclosure(s.amazon_affiliate_disclosure || '')
    }).catch(()=>{})
  },[])

  function appendAmazonTag(u, tag){
    try{
      if (!u || !tag) return u
      const s = String(u).trim()
      if (!/amazon\./i.test(s)) return s
      const url = new URL(s, window.location.origin)
      // if tag already present, do nothing
      if (url.searchParams.get('tag')) return url.toString()
      url.searchParams.set('tag', tag)
      return url.toString()
    }catch(e){ return u }
  }

  useEffect(()=>{
    const onPop = ()=>{
      try{ setSelectedCategory(new URLSearchParams(window.location.search).get('category') || '') }catch(e){ setSelectedCategory('') }
    }
    window.addEventListener('popstate', onPop)
    return ()=> window.removeEventListener('popstate', onPop)
  },[])

  useEffect(()=>{
    // debounce and call server search when query present
    const q = (search||'').trim()
    if (!q) { setSearchResults(null); setSearchLoading(false); setSearchPage(1); setSearchTotal(0); return }
    setSearchLoading(true)
    const t = setTimeout(()=>{
      fetch('/api/search?q='+encodeURIComponent(q)+`&page=${searchPage}&per_page=10`)
        .then(r=>r.json())
        .then(data => {
          if (data && data.items) { setSearchResults(data.items); setSearchTotal(data.total || 0); }
          else setSearchResults(Array.isArray(data)?data:[])
        })
        .catch(err=>{ console.error(err); setSearchResults([]) })
        .finally(()=>setSearchLoading(false))
    }, 300)
    return ()=> clearTimeout(t)
  },[search, searchPage])

  // request form now lives on /request page

  const publishedBlogs = (blogs || []).filter(b=> b.published || b.published === 1 || b.published === true)
  // Exclude hero posts from regular recent/normal lists
  const nonHeroBlogs = publishedBlogs.filter(b => !(b.is_hero || b.is_hero === 1 || b.is_hero === true))
  const heroBlogs = publishedBlogs
    .filter(b => b.is_hero || b.is_hero === 1 || b.is_hero === true)
    .slice()
    .sort((a,b)=>{
      const ao = Number(a.hero_order || 0)
      const bo = Number(b.hero_order || 0)
      if (ao !== bo) return ao - bo
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const currentHero = heroBlogs.length ? heroBlogs[Math.max(0, Math.min(heroIndex, heroBlogs.length-1))] : null

  // Auto-advance hero slider every 30s (no pause)
  useEffect(()=>{
    if (!heroBlogs || heroBlogs.length <= 1 || !showHeroOnMain) return
    const step = ()=> setHeroIndex(i => (i+1) % heroBlogs.length)
    const t = setInterval(step, 30 * 1000)
    return ()=> clearInterval(t)
  },[heroBlogs, showHeroOnMain])

  return (
    <div>
      <Helmet>
        <title>{pageMeta.title}</title>
        <meta name="description" content={pageMeta.description} />
        {pageMeta.keywords && <meta name="keywords" content={pageMeta.keywords} />}
        <link rel="canonical" href={(typeof window !== 'undefined' ? window.location.origin : '') + '/'} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudyGKHub" />
        <meta property="og:title" content={pageMeta.title} />
        <meta property="og:description" content={pageMeta.description} />
        <meta property="og:url" content={(typeof window !== 'undefined' ? window.location.origin : '') + '/'} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageMeta.title} />
        <meta name="twitter:description" content={pageMeta.description} />
      </Helmet>
      {/* News ticker between header and hero */}
      {news && news.length>0 && (
        <section className="news-ticker" aria-label="Latest news">
          <div className="news-ticker-inner">
            {news.map(n=> (
                <a key={n.id} href={normalizeUrl(n.link)} target="_blank" rel="noopener noreferrer" className="news-item" onClick={(e)=>{ if (!n.link){ e.preventDefault(); alert('No link set for this news item') } }}>
                  {n.title}
                </a>
              ))}
          </div>
        </section>
      )}

      {/* Amazon affiliate disclosure for branding links */}
      { (amazonEnabled && amazonTag && (anyAmazonLink(brandStrip) || anyAmazonLink(brands))) && (
        <div style={{maxWidth:1100,margin:'6px auto',padding:'0 18px',fontSize:13,color:'var(--muted)'}}>
          {amazonDisclosure || 'Note: Some branding links may go to Amazon. We may earn a commission from qualifying purchases as an Amazon Associate.'}
        </div>
      ) }

      {/* GK Practice top CTA removed per request */}

      {showHeroOnMain && (
        <section className="hero">
          <div className="hero-inner">
            {currentHero ? (
              <div className="hero-grid">
                <div className="hero-left">
                  <div className="hero-card">
                    {currentHero.featured_image ? (
                      <img className="hero-card-img" src={currentHero.featured_image} alt={currentHero.title || 'Featured post image'} loading="eager" decoding="async" />
                    ) : (
                      <div className="hero-card-img hero-card-img--placeholder" aria-hidden />
                    )}
                    <div className="hero-card-body">
                        <div className="hero-kicker">Featured</div>
                        <h2 className="hero-title">{currentHero.title}</h2>
                      <div className="hero-meta muted" style={{marginBottom:8}}>{new Date(currentHero.created_at).toLocaleDateString()} · {displayAuthor(currentHero.author)}</div>
                      <p className="hero-sub">{stripHtml(currentHero.summary || currentHero.content_preview || currentHero.content || '').slice(0,160)}{stripHtml(currentHero.summary || currentHero.content_preview || currentHero.content || '').length>160?'…':''}</p>
                      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}>
                        <button onClick={()=>{ const p = '/posts/'+(currentHero.slug || currentHero.id); try{ window.history.pushState({},'', p); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = p } }}>Read</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hero-right">
                  <div className="top-headlines">
                    {heroBlogs.map((b,i)=> (
                      <button key={b.id} className={`top-headline ${i===heroIndex ? 'top-headline--active' : ''}`} onClick={(e)=>{ setHeroIndex(i); }}>
                        {b.featured_image ? <img src={b.featured_image} alt={b.title||'Post image'} className="th-img" loading="lazy" decoding="async"/> : <div className="th-img th-img--placeholder"/>}
                        <div style={{flex:1,textAlign:'left'}}>
                          <div className="th-title">{b.title}</div>
                          <div className="th-meta">{new Date(b.created_at).toLocaleDateString()} · {displayAuthor(b.author) || 'Unknown'}{typeof b.comments_count !== 'undefined' ? ` · ${Number(b.comments_count||0)} comments` : ''}</div>
                          <div className="th-desc">{excerptFromPost(b, 84)}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2>Learn. Share. Grow.</h2>
                <p className="hero-sub">Curated general-knowledge articles to help you prepare and learn.</p>
              </>
            )}
          </div>
        </section>
      )}

        {/* Hero strip: small horizontal branding blocks */}
        {showStripOnMain && (
          <section className="hero-strip" aria-label="Hero branding strip">
            <div className="hero-strip-wrapper" style={{maxWidth:1100,margin:'0 auto',padding:0,position:'relative'}}>
              <div className="hero-strip-inner" ref={heroStripRef}>
                {(brandStrip || []).map((it)=> {
                  const raw = normalizeUrl(it.link)
                  const href = (amazonEnabled && amazonTag) ? appendAmazonTag(raw, amazonTag) : raw
                  const rawTitle = String(it.title || '').trim()
                  const words = rawTitle ? rawTitle.split(/\s+/) : []
                  const displayTitle = words.slice(0,3).join(' ') + (words.length > 3 ? '…' : '')
                  const slugFromTitle = rawTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
                  const targetSlug = it.slug ? String(it.slug).replace(/^\//, '') : slugFromTitle
                  const targetPath = targetSlug ? ('/posts/' + targetSlug) : href
                  return (
                    <div key={it.id} className="hero-strip-item">
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                        {it.image ? (
                          <a href={href} target="_blank" rel="nofollow noopener noreferrer" onClick={(e)=>{ if (!it.link) { e.preventDefault(); return } try{ hitStrip(it.id) }catch(e){} }}>
                            <img src={it.image} alt={it.title||'brand'} loading="lazy" decoding="async"/>
                          </a>
                        ) : <div className="hero-strip-placeholder"/>}
                        <div className="hero-strip-caption" style={{padding:0,textAlign:'center'}}>
                          {it.title && <div className="hero-strip-title" style={{fontSize:13,fontWeight:700,marginBottom:6}}><a href={targetPath} onClick={(e)=>{ e.preventDefault(); try{ if (!it.link) { /* still record click for brand */ } try{ hitStrip(it.id) }catch(e){} window.history.pushState({},'', targetPath); window.dispatchEvent(new PopStateEvent('popstate')) }catch(err){ window.location.href = targetPath } }}>{displayTitle}</a></div>}
                          {it.link && <div className="hero-strip-price" style={{marginTop:6}}><a className="hero-strip-cta" href={href} target="_blank" rel="nofollow noopener noreferrer" onClick={(e)=>{ if (!it.link) { e.preventDefault(); return } try{ hitStrip(it.id) }catch(e){} }}>Check price on Amazon</a></div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button aria-label="Prev" className="hero-strip-arrow hero-strip-arrow--left" onClick={()=>{ const el = heroStripRef.current; if (!el) return; el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' }) }}>‹</button>
              <button aria-label="Next" className="hero-strip-arrow hero-strip-arrow--right" onClick={()=>{ const el = heroStripRef.current; if (!el) return; el.scrollBy({ left: el.clientWidth, behavior: 'smooth' }) }}>›</button>
            </div>
          </section>
        )}

      {/* Recent News grid */}
      <section className="recent-news" aria-label="Recent News">
        <div className="recent-inner" style={{maxWidth:1100,margin:'18px auto',padding:'0 18px'}}>
          <div className="recent-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <h3 style={{margin:0}}>Recent News</h3>
            <a href="/" onClick={(e)=>{e.preventDefault(); window.history.pushState({},'', '/'); window.dispatchEvent(new PopStateEvent('popstate'))}} className="view-all">View all →</a>
          </div>
          <div className="recent-grid">
            {(function(){
              // show only the 4 most recently published non-hero posts
              const latest = (nonHeroBlogs || []).slice().sort((a,b)=> new Date(b.created_at) - new Date(a.created_at)).slice(0,4)
              return latest.map(b=> (
              <article key={b.id} className="recent-card">
                {b.featured_image ? <img src={b.featured_image} alt={b.title} className="recent-card-img" loading="lazy" decoding="async" /> : <div className="recent-card-img recent-card-img--placeholder" />}
                <div className="recent-card-body">
                  <div className="muted" style={{fontSize:12}}>{new Date(b.created_at).toLocaleDateString()} · {displayAuthor(b.author) || 'Unknown'}{typeof b.comments_count !== 'undefined' ? ` · ${Number(b.comments_count||0)} comments` : ''}</div>
                  <h4 style={{margin:'6px 0'}} className="recent-card-title"><a href={'/posts/'+(b.slug || b.id)} onClick={(e)=>{ e.preventDefault(); try{ window.history.pushState({},'', '/posts/'+(b.slug || b.id)); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/posts/'+(b.slug || b.id) } }}>{b.title}</a></h4>
                  <p className="muted" style={{fontSize:13}}>{stripHtml(b.summary || b.content_preview || b.content || '').slice(0,120)}{stripHtml(b.summary || b.content_preview || b.content || '').length>120?'…':''}</p>
                </div>
              </article>
              ))
            })()}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="cta-banner" aria-label="Trusted banner">
        <div className="cta-inner cta-inner--promo">
          <div className="cta-left">
            <h2 className="cta-title">12,000+ professionals & growing</h2>
            <p className="cta-sub muted">Publish a blog post or get your brand featured for free — we review submissions quickly and help increase your brand's visibility.</p>
            <div className="cta-trust" aria-hidden>
              <span className="trust-badge">Verified partners</span>
              <span className="trust-count">• 12k+ users</span>
            </div>
          </div>

          <div className="cta-right">
            <button className="cta-btn cta-btn--primary" onClick={()=>{ try{ window.history.pushState({},'', '/request'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/request' } }}>Get Free Feature</button>
            <button className="cta-btn cta-btn--ghost" onClick={()=>{ try{ window.history.pushState({},'', '/'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/' } }}>Browse Blogs</button>
          </div>
        </div>
      </section>

      {/* Brand CTA moved to site footer */}

      <section className="posts-grid" aria-label="Latest posts">
        {/* Search is shown in header now; keep clear button in posts area */}
        <div style={{display:'flex',alignItems:'center',margin:'12px 0',gap:8}}>
          {search && <button onClick={()=>setSearch('')} style={{padding:'8px 10px'}}>Clear search</button>}
        </div>

        {(function(){
          const q = (search||'').trim()
          const list = (searchResults !== null) ? searchResults : blogs
          // Exclude hero posts from normal post lists so they only appear in the hero section
          const published = list
            .filter(b=> b.published || b.published === 1 || b.published === true)
            .filter(b=> !selectedCategory || String((b.category||'')).trim() === String(selectedCategory).trim())
            .filter(b => !(b.is_hero || b.is_hero === 1 || b.is_hero === true))
          if (searchLoading) return (<div style={{padding:20,color:'var(--muted)'}}>Searching…</div>)
          if (!published || published.length === 0) return (<div style={{padding:20,color:'var(--muted)'}}>No posts match your search.</div>)
          return (
            <div className="posts-layout">
              <div className="posts-list">
                {published.map(b=> (
                  <article key={b.id} className="post-row">
                    {b.featured_image ? (
                      <img className="post-thumb" src={b.featured_image} alt={b.title || 'Post image'} loading="lazy" decoding="async" />
                    ) : (
                      <div className="post-thumb post-thumb--placeholder" aria-hidden />
                    )}
                    <div className="post-main">
                      <h3 className="post-title"><a href={'/posts/'+(b.slug || b.id)} onClick={(e)=>{ e.preventDefault(); try{ window.history.pushState({},'', '/posts/'+(b.slug || b.id)); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){ window.location.href = '/posts/'+(b.slug || b.id) } }}>{b.title}</a></h3>
                      <div className="muted" style={{fontSize:13,marginTop:6,marginBottom:8}}>{new Date(b.created_at).toLocaleDateString()} · by {displayAuthor(b.author) || 'Unknown'}{b.category ? ' · ' + b.category : ''}</div>
                            <div className="post-preview">
                              {(function(){
                                const txt = stripHtml(b.summary || b.content_preview || b.content || '')
                                const isExpanded = expandedPosts.has(b.id)
                                const shown = txt
                                return (
                                  <div>
                                    <div className={`post-desc ${isExpanded ? 'expanded' : ''}`} dangerouslySetInnerHTML={{ __html: linkify(shown) }} />
                                    {txt.length > 220 && (
                                      <button onClick={()=>{ const s = new Set(expandedPosts); if (s.has(b.id)) s.delete(b.id); else s.add(b.id); setExpandedPosts(s) }} style={{padding:'6px 8px', marginLeft:8, display:'inline-block'}}>{isExpanded ? 'Show less' : 'Read more'}</button>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                      <div className="post-actions">
                        <EngagementControls
                          id={b.id}
                          slug={b.slug}
                          title={b.title}
                          description={stripHtml(b.summary || b.content_preview || b.content || '')}
                          image={b.featured_image || ''}
                          upVotes={b.up_votes}
                          downVotes={b.down_votes}
                          commentsCount={b.comments_count}
                          onComment={()=>{
                            const target = '/posts/' + (b.slug || b.id) + '#comments'
                            try{
                              window.history.pushState({}, '', target)
                              window.dispatchEvent(new PopStateEvent('popstate'))
                            }catch(e){ window.location.href = target }
                          }}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <aside className="branding-sidebar" aria-label="Branding sidebar">
                {brands && brands.length>0 ? (
                  <>
                    {/* Primary (large) */}
                    {brands[0] && (
                      <div className="branding-item branding-primary" style={{marginBottom:14}}>
                        <a
                          href={amazonTag ? appendAmazonTag(normalizeUrl(brands[0].link), amazonTag) : normalizeUrl(brands[0].link)}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          onClick={(e)=>{
                            try{
                              if (!brands[0].link) { e.preventDefault(); return }
                              const id = brands[0].id;
                              if (navigator && navigator.sendBeacon) {
                                try{ navigator.sendBeacon('/api/hit/brand/'+encodeURIComponent(id)); }catch(err){}
                              } else fetch('/api/hit/brand/'+encodeURIComponent(id), { method: 'POST', keepalive: true }).catch(()=>{});
                            }catch(err){}
                          }}
                        >
                          {brands[0].image ? (
                            <img src={brands[0].image} alt={brands[0].title || 'Brand'} className="branding-img" loading="lazy" decoding="async" />
                          ) : (
                            <div className="branding-img placeholder" />
                          )}
                        </a>
                        <div className="branding-body">
                          {brands[0].title && <div className="branding-title">{brands[0].title}</div>}
                          {brands[0].description && <div className="branding-desc">{brands[0].description}</div>}
                        </div>
                      </div>
                    )}
                    {/* Secondary (smaller) */}
                    {brands[1] && (
                      <div className="branding-item branding-secondary" style={{marginBottom:12}}>
                        <a
                          href={amazonTag ? appendAmazonTag(normalizeUrl(brands[1].link), amazonTag) : normalizeUrl(brands[1].link)}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          onClick={(e)=>{
                            try{
                              if (!brands[1].link) { e.preventDefault(); return }
                              const id = brands[1].id;
                              if (navigator && navigator.sendBeacon) {
                                try{ navigator.sendBeacon('/api/hit/brand/'+encodeURIComponent(id)); }catch(err){}
                              } else fetch('/api/hit/brand/'+encodeURIComponent(id), { method: 'POST', keepalive: true }).catch(()=>{});
                            }catch(err){}
                          }}
                        >
                          {brands[1].image ? (
                            <img src={brands[1].image} alt={brands[1].title || 'Brand'} className="branding-img" loading="lazy" decoding="async" />
                          ) : (
                            <div className="branding-img placeholder" />
                          )}
                        </a>
                        <div className="branding-body">
                          {brands[1].title && <div className="branding-title">{brands[1].title}</div>}
                          {brands[1].description && <div className="branding-desc">{brands[1].description}</div>}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="branding-item" style={{opacity:0.6}}>No branding</div>
                )}
              </aside>
            </div>
          )
        })()}
        {searchResults && searchTotal > (searchPage * 10) && (
          <div style={{display:'flex',justifyContent:'center',marginTop:12}}>
            <button onClick={()=>{ setSearchPage(p=>p+1); setSearchLoading(true); fetch('/api/search?q='+encodeURIComponent(search)+`&page=${searchPage+1}&per_page=10`).then(r=>r.json()).then(d=>{ if (d && d.items){ setSearchResults(prev => [...prev, ...d.items]); setSearchTotal(d.total || 0) } }).finally(()=>setSearchLoading(false)) }}>Load more</button>
          </div>
        )}
      </section>

      {/* Request form moved to /request page */}
      
    </div>
  )
}
