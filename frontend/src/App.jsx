import React, { useState, useEffect, lazy, Suspense } from 'react'
import Home from './pages/Home'
const Admin = lazy(() => import('./pages/Admin'))
const AdminRegister = lazy(() => import('./pages/AdminRegister'))
const Post = lazy(() => import('./pages/Post'))
const RequestPage = lazy(() => import('./pages/Request'))
const TermsPage = lazy(() => import('./pages/Terms'))
const PolicyPage = lazy(() => import('./pages/PromotionPolicy'))
const ContactPage = lazy(() => import('./pages/Contact'))
const AboutPage = lazy(() => import('./pages/About'))
const DynamicPage = lazy(() => import('./pages/DynamicPage'))
import { HelmetProvider } from 'react-helmet-async'

const normalizeRoutePath = (path) => {
  if (!path) return '/'
  let normalized = String(path)
  if (!normalized.startsWith('/')) normalized = '/' + normalized
  normalized = normalized.replace(/\/{2,}/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1)
  return normalized || '/'
}

const normalizeDynamicSlug = (value) => {
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

const safeDecode = (value = '') => {
  try { return decodeURIComponent(value) } catch (err) { return value }
}

export default function App(){
  const [route, setRoute] = useState(()=>normalizeRoutePath(window.location.pathname))
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  useEffect(()=>{
    const onPop = ()=> setRoute(normalizeRoutePath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return ()=> window.removeEventListener('popstate', onPop)
  },[])

  // Redirect legacy /admin path to home to obscure admin route
  useEffect(()=>{
    if (window.location.pathname === '/admin') {
      try{ window.history.replaceState({},'', '/'); setRoute('/'); }catch(e){ window.location.pathname = '/' }
    }
  },[])
  useEffect(()=>{
    fetch('/api/categories')
      .then(r=>r.json())
      .then(d=> setCategories(Array.isArray(d) ? d : []))
      .catch(()=> setCategories([]))
  },[])

  const getSelectedCategory = ()=>{
    try{ return new URLSearchParams(window.location.search).get('category') || '' }catch(e){ return '' }
  }

  const nav = (path = '/') => {
    let target = String(path || '/')
    if (!target.startsWith('/')) target = '/' + target
    window.history.pushState({}, '', target)
    setRoute(normalizeRoutePath(window.location.pathname))
    // notify listeners (components reading query params) about navigation
    try { window.dispatchEvent(new PopStateEvent('popstate')) } catch (e) {}
  }

  const pathOnly = route || '/'
  const isAdmin = pathOnly === '/ratan'
  const staticPaths = new Set(['/request', '/terms', '/policy', '/about', '/ratans'])
  const isPostRoute = pathOnly.startsWith('/posts/')
  const rawDynamicSlug = !isAdmin && !staticPaths.has(pathOnly) && !isPostRoute && pathOnly !== '/' ? safeDecode(pathOnly.slice(1)) : ''
  const dynamicSlug = normalizeDynamicSlug(rawDynamicSlug) || rawDynamicSlug

  if (dynamicSlug) {
    return (
      <HelmetProvider>
        <div className="dynamic-page-standalone">
          <Suspense fallback={<div style={{ padding: 20 }}>Loading...</div>}>
            <DynamicPage slug={dynamicSlug} />
          </Suspense>
        </div>
      </HelmetProvider>
    )
  }

  return (
    <HelmetProvider>
    <div className="site-root">
      {!isAdmin && (
        <header className="site-header">
          <div className="header-top">
            <div className="header-inner">
              <div className="logo-wrap" onClick={()=>nav('/')} role="button" tabIndex={0} onKeyDown={(e)=>{ if (e.key === 'Enter' || e.key === ' ') nav('/') }}>
                <div className="logo">StudyGKHub</div>
                <div className="logo-sub">Quality blog publishing • Promote your brand with featured posts</div>
                <div className="logo-tagline" style={{fontSize:13, color:'#ffffff', marginTop:4}}>
                  <strong>Learn. Share. Grow.</strong> Curated general-knowledge articles to help you prepare and learn.
                </div>
              </div>
              <div className="header-actions">
                <input aria-label="Search posts" className="search-input header-search" placeholder="Search posts" value={search} onChange={e=>setSearch(e.target.value)} />
                <button className="nav-btn header-request" onClick={()=>nav('/request')}>Request Free Feature</button>
              </div>
              {/* Mobile categories quick access (visible on small screens) */}
              <div className="mobile-only-cat">
                <div className="cat-nav">
                  {categories.map(c => (
                    <button key={c} className={`cat-btn ${getSelectedCategory()===c ? 'active' : ''}`} onClick={()=>nav('/?category='+encodeURIComponent(c))}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="header-bottom">
            <div className="header-inner">
              <nav className="nav">
                <button className="nav-btn" onClick={()=>nav('/')}>Home</button>
                <div className="cat-nav" aria-label="Categories">
                  {categories.map(c => (
                    <button key={c} className={`cat-btn ${getSelectedCategory()===c ? 'active' : ''}`} onClick={()=>nav('/?category='+encodeURIComponent(c))}>{c}</button>
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </header>
      )}

      <main>
        <Suspense fallback={<div style={{padding:20}}>Loading...</div>}>
          {isAdmin ? <Admin />
            : pathOnly === '/request' ? <RequestPage />
            : pathOnly === '/terms' ? <TermsPage />
            : pathOnly === '/policy' ? <PolicyPage />
            : pathOnly === '/contact' ? <ContactPage />
            : pathOnly === '/about' ? <AboutPage />
            : pathOnly === '/ratans' ? <AdminRegister />
            : isPostRoute ? <Post slug={safeDecode(pathOnly.replace('/posts/',''))} />
            : <Home search={search} setSearch={setSearch} />}
        </Suspense>
      </main>

      {!isAdmin && (
        <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-grid" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',flex:'1 1 320px',minWidth:220,gap:6}}>
              <div style={{fontWeight:700,fontSize:16}}>Free Brand Feature</div>
              <div className="muted" style={{fontSize:13,lineHeight:1.35}}>Publish a branded post for free to boost your brand's visibility — submit your details and we'll review your request.</div>
            </div>

            <div style={{display:'flex',flex:'0 0 220px',justifyContent:'flex-end',alignItems:'center'}}>
              <button className="footer-cta-btn" onClick={()=>nav('/request')} style={{padding:'10px 14px',fontSize:14}}>Get Free Feature</button>
            </div>
          </div>

            <div style={{textAlign:'center', padding:12, fontSize:15}}>
            <span style={{cursor:'pointer', margin:'0 8px'}} onClick={()=>nav('/about')}>About!</span>
            <span style={{cursor:'pointer', margin:'0 8px'}} onClick={()=>nav('/terms')}>Terms!</span>
            <span style={{cursor:'pointer', margin:'0 8px'}} onClick={()=>nav('/policy')}>Promotion!</span>
            <span style={{cursor:'pointer', marginLeft:12, fontWeight:600}} onClick={()=>nav('/contact')}>Contact</span>
          </div>

          <div style={{textAlign:'center', padding:'6px 12px', fontSize:13, marginTop:6}}>
            © {new Date().getFullYear()} StudyGKHub — Built with ❤️
          </div>
        </div>
        </footer>
      )}
    </div>
    </HelmetProvider>
  )
}
