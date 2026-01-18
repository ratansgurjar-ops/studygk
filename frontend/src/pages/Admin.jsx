import React, { useState, useEffect, useRef } from 'react'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import JoditEditor from 'jodit-react'
import 'jodit/build/jodit.min.css'
import AdminGK from '../components/AdminGK'
import QuestionSetGenerator from '../components/QuestionSetGenerator'

function normalizePageSlugInput(value) {
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
  } else if (/^[A-Za-z0-9.-]+(?::\d+)?$/.test(slug)) {
    slug = ''
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
  slug = slug.replace(/\.+$/, '')
  slug = slug.replace(/[^A-Za-z0-9\-._/]+/g, '')
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/+/, '')
  slug = slug.replace(/\/+$/, '')
  return slug
}

function Overview({ token, onViewCategory }){
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ fetchOverview() }, [])
  async function fetchOverview(){
    setLoading(true)
    try{
      const res = await fetch('/api/admin/overview', { headers: { 'Authorization': 'Bearer ' + (token||'') } })
      if (!res.ok) { setData(null); setLoading(false); return }
      const d = await res.json(); setData(d)
    }catch(e){ console.error(e); setData(null) }
    setLoading(false)
  }
  if (loading) return <div style={{padding:12}}>Loading overview…</div>
  if (!data) return <div style={{padding:12,color:'#666'}}>No overview data available.</div>
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Blogs</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.blogs_count}</div>
      </div>
      {data && (data.questions_by_category && (Array.isArray(data.questions_by_category) || typeof data.questions_by_category === 'object')) && (
        <div style={{gridColumn:'1/-1',padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)',marginTop:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:700}}>Questions by category</div>
            <div style={{fontSize:12,color:'#6b7280'}}>Click View to open GK manager filtered by category</div>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                  <th style={{textAlign:'left',padding:8}}>Category</th>
                  <th style={{padding:8}}>Count</th>
                  <th style={{padding:8}}>Views</th>
                </tr>
            </thead>
            <tbody>
              {(() => {
                const raw = Array.isArray(data.questions_by_category) ? data.questions_by_category : Object.entries(data.questions_by_category || {})
                const rows = []
                raw.forEach(row => {
                  let cat = ''
                  let cnt = 0
                  let views = 0
                  if (Array.isArray(row)){
                    cat = row[0]
                    const v = row[1]
                    if (typeof v === 'number') cnt = v
                    else if (v && typeof v === 'object'){
                      cnt = v.c ?? v.count ?? v.qty ?? v.total ?? 0
                      views = v.views ?? v.hits ?? v.total_views ?? 0
                    }
                  } else if (row && typeof row === 'object'){
                    cat = row.category ?? row[0] ?? ''
                    cnt = row.c ?? row.count ?? row.qty ?? row.total ?? 0
                    views = row.views ?? row.hits ?? row.total_views ?? 0
                  }
                  rows.push({ category: String(cat || '').trim(), count: Number(cnt || 0), views: Number(views || 0) })
                })
                // Ensure Current Affairs row exists
                if (!rows.some(r => (r.category || '').toLowerCase() === 'current affairs')){
                  rows.unshift({ category: 'Current Affairs', count: 0, views: 0 })
                }
                return rows.map(r => (
                  <tr key={String(r.category)} style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                    <td style={{padding:8}}>{r.category || '(Uncategorized)'}</td>
                    <td style={{padding:8,textAlign:'center'}}>{r.count}</td>
                    <td style={{padding:8,textAlign:'center'}}>{r.views}</td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      )}
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Total Blog Views</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.total_blog_views}</div>
      </div>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Comments</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.comments_count}</div>
      </div>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Brand Strips</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.strips_count}</div>
      </div>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Product Brands</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.brands_count}</div>
      </div>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Pending Brand Requests</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.brand_requests_pending}</div>
      </div>
      <div style={{padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:12,color:'#6b7280'}}>Current Affairs Questions</div>
        <div style={{fontSize:20,fontWeight:700}}>{data.current_affairs_questions_count || 0}</div>
      </div>

      <div style={{gridColumn:'1/-1',padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)'}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Top Trending Blogs</div>
        {Array.isArray(data.trending_blogs) && data.trending_blogs.length ? (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr><th style={{textAlign:'left',padding:8}}>Title</th><th style={{padding:8}}>Views</th><th style={{padding:8}}>Comments</th></tr>
            </thead>
            <tbody>
              {data.trending_blogs.map(b=> (
                <tr key={b.id} style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                  <td style={{padding:8}}>{b.title}</td>
                  <td style={{padding:8,textAlign:'center'}}>{b.views || 0}</td>
                  <td style={{padding:8,textAlign:'center'}}>{b.comments_count || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{color:'#666'}}>No trending blogs yet.</div>}
      </div>
      <div style={{gridColumn:'1/-1',padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)',marginTop:12}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Top Brand Strip Items (by clicks)</div>
        {Array.isArray(data.top_brand_strip) && data.top_brand_strip.length ? (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr><th style={{textAlign:'left',padding:8}}>Title</th><th style={{padding:8}}>Views</th></tr>
            </thead>
            <tbody>
              {data.top_brand_strip.map(b=> (
                <tr key={b.id} style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                  <td style={{padding:8}}>{b.title}</td>
                  <td style={{padding:8,textAlign:'center'}}>{b.views || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{color:'#666'}}>No brand strip clicks recorded yet.</div>}
      </div>

      <div style={{gridColumn:'1/-1',padding:12,background:'#fff',borderRadius:8,boxShadow:'0 1px 0 rgba(2,6,23,0.04)',marginTop:12}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Top Product Brands (by clicks)</div>
        {Array.isArray(data.top_product_brands) && data.top_product_brands.length ? (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr><th style={{textAlign:'left',padding:8}}>Title</th><th style={{padding:8}}>Views</th></tr>
            </thead>
            <tbody>
              {data.top_product_brands.map(b=> (
                <tr key={b.id} style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                  <td style={{padding:8}}>{b.title}</td>
                  <td style={{padding:8,textAlign:'center'}}>{b.views || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{color:'#666'}}>No product brand clicks recorded yet.</div>}
      </div>
    </div>
  )
}

function getPagePathFromInput(value) {
  const slug = normalizePageSlugInput(value)
  return slug ? '/' + slug : ''
}

export default function Admin(){
  // editor refs and helpers
  const quillRef = useRef(null)
  const joditRef = useRef(null)
  const pageEditorRef = useRef(null)
  const [selectedEditor, setSelectedEditor] = useState('jodit')
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'image', 'blockquote', 'code-block'],
      ['clean']
    ],
    clipboard: { matchVisual: false }
  }

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'bullet', 'link', 'image', 'blockquote', 'code-block'
  ]

  const joditConfig = {
    readonly: false,
    height: 360,
    toolbarAdaptive: true,
    showXPathInStatusbar: false,
    askBeforePasteHTML: false,
    defaultActionOnPaste: 'insert_as_html',
    // use default toolbar (do not supply `buttons` as an object)
  }
  const [token, setToken] = useState(localStorage.getItem('token'))
  // Do not pre-fill credentials in UI to avoid accidental leaks
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [secretQuestion, setSecretQuestion] = useState('')
  const [forgotAnswer, setForgotAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [forgotNotice, setForgotNotice] = useState('')
  const [blogs, setBlogs] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 6
  const [form, setForm] = useState({title:'', summary:'', content:'', published:false, slug:'', meta_title:'', meta_description:'', keywords:'', featured_image:'', category:'', is_hero:false, hero_order:0})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const setFormContent = (html) => setForm(prev => ({ ...prev, content: html }))
  const [editingId, setEditingId] = useState(null)
  const [pasteHtmlVisible, setPasteHtmlVisible] = useState(false)
  const [pasteHtmlText, setPasteHtmlText] = useState('')
  const makeEmptyPageForm = () => ({ title:'', slugInput:'', content:'', meta_title:'', meta_description:'', keywords:'', published:true })
  const [pages, setPages] = useState([])
  const [pageForm, setPageForm] = useState(()=>makeEmptyPageForm())
  const [editingPageId, setEditingPageId] = useState(null)
  const [seoPages, setSeoPages] = useState({})
  const [seoLoading, setSeoLoading] = useState(false)
  const [pageSearch, setPageSearch] = useState('')
  const [pageLoading, setPageLoading] = useState(false)
  const [pageNotice, setPageNotice] = useState('')
  const setPageFormContent = (html) => setPageForm(prev => ({ ...prev, content: html }))
  const currentPageLivePath = getPagePathFromInput(pageForm.slugInput || '')
  const currentPageLiveUrl = currentPageLivePath ? ((siteOrigin || '') + currentPageLivePath) : ''

  useEffect(()=>{ if (token) { fetchBlogs() } }, [token])
  const [activePanel, setActivePanel] = useState('blogs')
  const [initialGKCategory, setInitialGKCategory] = useState('')
  const [requests, setRequests] = useState([])
  const [categories, setCategories] = useState([])
  const [stripList, setStripList] = useState([])
  const [blogSort, setBlogSort] = useState('new')
  const [blogMinViews, setBlogMinViews] = useState(0)
  const [blogSearch, setBlogSearch] = useState('')
  const [blogDateFrom, setBlogDateFrom] = useState('')
  const [blogDateTo, setBlogDateTo] = useState('')

  const [newsList, setNewsList] = useState([])
  const [newsSearch, setNewsSearch] = useState('')
  const [newsDateFrom, setNewsDateFrom] = useState('')
  const [newsDateTo, setNewsDateTo] = useState('')
  const [newsForm, setNewsForm] = useState({title:'', link:'', position:0, active:true})
  const [editingNewsId, setEditingNewsId] = useState(null)
  const [requestSearch, setRequestSearch] = useState('')
  const [requestDateFrom, setRequestDateFrom] = useState('')
  const [requestDateTo, setRequestDateTo] = useState('')
  const [newsPushRed, setNewsPushRed] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('newsPushRed')||'false') }catch(e){ return false } })
  const [adminComments, setAdminComments] = useState([])
  const [adminCommentsLoading, setAdminCommentsLoading] = useState(false)
  const [commentStatusFilter, setCommentStatusFilter] = useState('pending')
  const [commentBlogFilter, setCommentBlogFilter] = useState('')
  const [commentSearch, setCommentSearch] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  useEffect(()=>{ try{ localStorage.setItem('newsPushRed', JSON.stringify(newsPushRed)) }catch(e){} },[newsPushRed])

  async function fetchRequests(){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      const res = await fetch('/api/brand-requests', { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (res.status === 401) {
        alert('Not authorized. Please login again.')
        setRequests([])
        return
      }
      if (!res.ok) { console.error('Fetch requests failed', res.status); setRequests([]); return }
      const d = await res.json()
      setRequests(Array.isArray(d)?d:[])
    }catch(err){ console.error(err) }
  }

  async function fetchNews(){
    try{
      const res = await fetch('/api/news')
      if (!res.ok) return setNewsList([])
      const d = await res.json()
      setNewsList(Array.isArray(d)?d:[])
    }catch(e){ console.error(e); setNewsList([]) }
  }

  async function fetchStripList(){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      const res = await fetch('/api/brand-strip', { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) { setStripList([]); return }
      const d = await res.json()
      setStripList(Array.isArray(d)?d:[])
    }catch(err){ console.error('fetchStripList', err); setStripList([]) }
  }

  async function fetchAdminComments(params = {}){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) { setAdminComments([]); return }
      setAdminCommentsLoading(true)
      const status = params.status !== undefined ? params.status : commentStatusFilter
      const blogId = params.blog_id !== undefined ? params.blog_id : commentBlogFilter
      const searchParams = new URLSearchParams()
      if (status && status !== 'all') searchParams.set('status', status)
      if (blogId) searchParams.set('blog_id', blogId)
      const url = '/api/admin/comments' + (searchParams.toString() ? ('?' + searchParams.toString()) : '')
      const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) {
        setAdminComments([])
        return
      }
      const data = await res.json()
      setAdminComments(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('fetchAdminComments', err)
      setAdminComments([])
    }finally{
      setAdminCommentsLoading(false)
    }
  }

  async function setCommentStatus(id, status){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) return alert('Not authorized')
      const res = await fetch('/api/admin/comments/' + id, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + tokenVal, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) {
        const d = await res.json().catch(()=>null)
        alert((d && d.error) ? d.error : 'Failed to update comment')
        return
      }
      fetchAdminComments()
    }catch(err){
      console.error('setCommentStatus', err)
      alert('Failed to update comment')
    }
  }

  async function deleteComment(id){
    if (!window.confirm('Delete this comment?')) return
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) return alert('Not authorized')
      const res = await fetch('/api/admin/comments/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) {
        alert('Failed to delete comment')
        return
      }
      fetchAdminComments()
    }catch(err){
      console.error('deleteComment', err)
      alert('Failed to delete comment')
    }
  }

  async function saveNews(e){
    e.preventDefault()
    try{
      const tokenVal = localStorage.getItem('token') || ''
      const payload = { title: newsForm.title, link: newsForm.link, position: Number(newsForm.position||0), active: newsForm.active }
      let res
      if (editingNewsId) {
        res = await fetch('/api/news/'+editingNewsId, { method: 'PUT', headers: { 'Authorization':'Bearer '+tokenVal, 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      } else {
        res = await fetch('/api/news', { method: 'POST', headers: { 'Authorization':'Bearer '+tokenVal, 'Content-Type':'application/json' }, body: JSON.stringify(payload) })
      }
      if (!res.ok) { const d = await res.json().catch(()=>({})); alert(d.error||'Save failed'); return }
      setNewsForm({title:'',link:'',position:0,active:true}); setEditingNewsId(null); fetchNews()
    }catch(err){ console.error(err); alert('Save failed') }
  }

  async function removeNews(id){
    if (!confirm('Delete this news item?')) return
    try{
      const tokenVal = localStorage.getItem('token') || ''
      const res = await fetch('/api/news/'+id, { method: 'DELETE', headers: { 'Authorization':'Bearer '+tokenVal } })
      if (!res.ok) { alert('Delete failed'); return }
      fetchNews()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  function startNewPage(){
    setEditingPageId(null)
    setPageForm(makeEmptyPageForm())
    setPageNotice('')
  }

  async function fetchDynamicPages(params = {}){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) { setPages([]); return }
      setPageLoading(true)
      const searchTerm = params.search !== undefined ? params.search : pageSearch
      const searchParams = new URLSearchParams()
      if (searchTerm) searchParams.set('search', searchTerm)
      const url = '/api/pages' + (searchParams.toString() ? ('?' + searchParams.toString()) : '')
      const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) throw new Error('Failed to load pages')
      const data = await res.json()
      setPages(Array.isArray(data) ? data : [])
    }catch(err){
      console.error('fetchDynamicPages', err)
      setPages([])
    }finally{
      setPageLoading(false)
    }
  }

  async function loadDynamicPage(id){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) return alert('Not authorized')
      const res = await fetch('/api/pages/' + id, { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) { alert('Unable to load page'); return }
      const data = await res.json()
      setEditingPageId(data.id || id)
      // detect if this page was saved as a "code" page (contains <script> or <style> or our runner id)
      const rawContent = data.content || ''
      const looksLikeCode = /<script[\s\S]*?>|<style[\s\S]*?>|id=["']code-runner-root["']/i.test(rawContent)
      setPageForm({
        title: data.title || '',
        slugInput: data.slug_input || data.slug || '',
        content: looksLikeCode ? '' : rawContent,
        code: looksLikeCode ? rawContent : '',
        type: looksLikeCode ? 'code' : 'jodit',
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        keywords: data.keywords || '',
        published: data.published !== false
      })
      setPageNotice('')
    }catch(err){
      console.error('loadDynamicPage', err)
      alert('Failed to load page')
    }
  }

  async function saveDynamicPage(e){
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) return alert('Not authorized')
      const wasEditing = Boolean(editingPageId)
      const payload = {
        title: pageForm.title || '',
        slug: pageForm.slugInput || '',
        // if this is a code page prefer the combined `code` field; otherwise use `content`
        content: (pageForm.type === 'code' ? (pageForm.code || pageForm.content || '') : (pageForm.content || pageForm.code || '')),
        meta_title: pageForm.meta_title || '',
        meta_description: pageForm.meta_description || '',
        keywords: pageForm.keywords || '',
        published: !!pageForm.published
      }
      const method = editingPageId ? 'PUT' : 'POST'
      const url = editingPageId ? '/api/pages/' + editingPageId : '/api/pages'
      const res = await fetch(url, { method, headers: { 'Authorization': 'Bearer ' + tokenVal, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const d = await res.json().catch(()=>null)
        alert((d && d.error) ? d.error : 'Save failed')
        return
      }
      const data = await res.json()
      const newId = data && data.id ? data.id : editingPageId
      setEditingPageId(newId || null)
      // after save, detect code pages and keep `type` and `code` populated so editor stays in code mode
      const savedContent = data.content || ''
      const savedLooksLikeCode = /<script[\s\S]*?>|<style[\s\S]*?>|id=["']code-runner-root["']/i.test(savedContent)
      setPageForm({
        title: data.title || '',
        slugInput: data.slug_input || data.slug || '',
        content: savedLooksLikeCode ? '' : savedContent,
        code: savedLooksLikeCode ? savedContent : '',
        type: savedLooksLikeCode ? 'code' : 'jodit',
        meta_title: data.meta_title || '',
        meta_description: data.meta_description || '',
        keywords: data.keywords || '',
        published: data.published !== false
      })
      setPageNotice(wasEditing ? 'Page updated' : 'Page created')
      setTimeout(()=>setPageNotice(''), 2600)
      fetchDynamicPages()
    }catch(err){
      console.error('saveDynamicPage', err)
      alert('Failed to save page')
    }
  }

  async function removeDynamicPage(id){
    if (!window.confirm('Delete this page?')) return
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      if (!tokenVal) return alert('Not authorized')
      const res = await fetch('/api/pages/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) {
        const d = await res.json().catch(()=>null)
        alert((d && d.error) ? d.error : 'Delete failed')
        return
      }
      if (editingPageId === id) startNewPage()
      fetchDynamicPages()
    }catch(err){
      console.error('removeDynamicPage', err)
      alert('Failed to delete page')
    }
  }

  const handlePasteHtml = (html) => {
    try{
      if (selectedEditor === 'jodit') {
        if (joditRef.current) {
          const editorComp = joditRef.current;
          const instance = editorComp && editorComp.editor ? editorComp.editor : editorComp;
          if (instance && typeof instance.insertHTML === 'function') {
            instance.insertHTML(html)
          } else if (instance && typeof instance.setCode === 'function') {
            instance.setCode(html)
          } else {
            setFormContent(html)
          }
        } else setFormContent(html)
        return
      }

      if (quillRef.current && quillRef.current.getEditor){
        const editor = quillRef.current.getEditor()
        editor.clipboard.dangerouslyPasteHTML(html)
      } else {
        setFormContent(html)
      }
    }catch(err){ console.warn('Insert HTML failed', err); setFormContent(html) }
  }

  useEffect(()=>{ if (token) { fetchRequests() } }, [token])
  useEffect(()=>{ if (token) { fetchStripList() } }, [token])
  useEffect(()=>{ try{ console.log('Admin activePanel ->', activePanel) }catch(e){} }, [activePanel])
  useEffect(()=>{ if (activePanel === 'requests') { fetchRequests() } }, [activePanel])
  // ensure strip list is fetched when Hero Strip panel becomes active
  useEffect(()=>{ if (token && activePanel === 'hero-strip') { fetchStripList() } }, [token, activePanel])
  useEffect(()=>{ if (token) { fetchAdminCategories() } }, [token])
  useEffect(()=>{ if (token && activePanel === 'pages') { fetchDynamicPages() } }, [token, activePanel])
  useEffect(()=>{ if (token && activePanel === 'comments') { fetchAdminComments({ status: commentStatusFilter, blog_id: commentBlogFilter }) } }, [token, activePanel, commentStatusFilter, commentBlogFilter])

  async function fetchAdminCategories(){
    try{
      const tokenVal = localStorage.getItem('token') || token || ''
      const res = await fetch('/api/admin/categories', { headers: { 'Authorization': 'Bearer ' + tokenVal } })
      if (!res.ok) { setCategories([]); return }
      const d = await res.json(); setCategories(Array.isArray(d)?d:[])
    }catch(err){ console.error(err); setCategories([]) }
  }
  function fetchBlogs(){
    fetch('/api/blogs')
      .then(r=>r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        list.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
        setBlogs(list)
        setCurrentPage(1)
      })
      .catch(console.error)
  }
  async function login(e){
    e.preventDefault();
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!res.ok) {
      // try to extract text (could be HTML) and show a helpful message
      const txt = await res.text();
      alert('Login failed: ' + res.status + ' ' + (txt || res.statusText));
      return;
    }
    // now parse JSON safely
    let data;
    try {
      data = await res.json();
    } catch (err) {
      alert('Invalid JSON response from server');
      return;
    }
    if (data && data.token) { localStorage.setItem('token', data.token); setToken(data.token); }
    else alert(data?.error || 'Login failed')
  }
  async function getForgotQuestion(e){
    e && e.preventDefault && e.preventDefault()
    setForgotNotice('')
    try{
      const res = await fetch('/api/admin/forgot-question?email=' + encodeURIComponent(forgotEmail))
      if (!res.ok) { const d = await res.json().catch(()=>null); setForgotNotice((d && d.error) ? d.error : 'Not found'); return }
      const d = await res.json()
      setSecretQuestion(d.secret_question || '')
    }catch(err){ console.error(err); setForgotNotice('Request failed') }
  }

  async function resetForgot(e){
    e && e.preventDefault && e.preventDefault()
    setForgotNotice('')
    if (!forgotEmail || !forgotAnswer || !newPassword) return setForgotNotice('Please fill fields')
    try{
      const res = await fetch('/api/admin/forgot-reset', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email: forgotEmail, answer: forgotAnswer, newPassword }) })
      const d = await res.json().catch(()=>null)
      if (!res.ok) return setForgotNotice((d && d.error) ? d.error : 'Reset failed')
      setForgotNotice('Password reset; please login')
      setShowForgot(false)
      setForgotEmail('')
      setForgotAnswer('')
      setNewPassword('')
    }catch(err){ console.error(err); setForgotNotice('Reset failed') }
  }
  async function create(e){
    e.preventDefault();
    try {
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? '/api/blogs/' + editingId : '/api/blogs'
      const res = await fetch(url, { method, headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify(form) })
      if (res.ok) {
        setForm({title:'',summary:'',content:'',published:false, meta_title:'', meta_description:'', keywords:''}); setEditingId(null); fetchBlogs();
        try{ setFormContent('') }catch(e){}
      } else {
        const txt = await res.text();
        try {
          const d = txt ? JSON.parse(txt) : null;
          alert((d && d.error) ? d.error : ('Error: ' + res.status));
        } catch {
          alert('Error: ' + res.status + ' ' + (txt || res.statusText));
        }
      }
    } catch (err) { console.error(err); alert('Request failed') }
  }

  async function loadForEdit(id){
    const res = await fetch('/api/blogs/' + id)
    if (!res.ok) { alert('Cannot load'); return }
    const b = await res.json()
    setForm({ title: b.title || '', summary: b.summary || '', content: b.content || '', published: Boolean(b.published), slug: b.slug || '', meta_title: b.meta_title || '', meta_description: b.meta_description || '', keywords: b.keywords || '', featured_image: b.featured_image || '', category: b.category_id || b.category || '', is_hero: Boolean(b.is_hero), hero_order: Number(b.hero_order || 0) })
    setEditingId(b.id)
    window.scrollTo({top:0,behavior:'smooth'})
    setFormContent(b.content || '')
    // also set in quill editor if available
    setTimeout(()=>{
      try{ if (quillRef.current && quillRef.current.getEditor){ quillRef.current.getEditor().clipboard.dangerouslyPasteHTML(b.content || '') } }catch(e){}
    }, 0)
  }

  async function remove(id){
    if (!confirm('Delete this blog?')) return
    const res = await fetch('/api/blogs/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
    if (res.ok) fetchBlogs(); else { alert('Delete failed') }
  }

  async function bumpBlog(id){
    if (!confirm('Make this post recent (bump to now)?')) return
    try{
      const res = await fetch('/api/blogs/' + id + '/bump', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
      if (!res.ok) { const d = await res.json().catch(()=>null); alert(d && d.error ? d.error : 'Failed to bump'); return }
      fetchBlogs()
    }catch(e){ console.error(e); alert('Failed to bump') }
  }

  function logout(){ localStorage.removeItem('token'); setToken(null); }
  function makePreviewHtml(snippet){
    try{
      if (/<[a-z][\s\S]*>/i.test(snippet)) return snippet
      const escapeHtml = (s)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      const urlRegex = /(?:(?:https?:\/\/)|(?:www\.))[^\s<]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,6}\b(\/[^\s<]*)?/ig
      return escapeHtml(snippet).replace(urlRegex, (m)=>{ const u = /^https?:\/\//i.test(m) ? m : ('http://'+m); return `<a href="${u}" target="_blank" rel="noopener noreferrer">${escapeHtml(m)}</a>` })
    }catch(e){ return snippet }
  }

  async function generateBlogWithAI() {
    if (!aiPrompt.trim()) return alert('Please enter a topic')
    setAiLoading(true)
    try {
      const res = await fetch('/api/admin/ai/generate-blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ topic: aiPrompt })
      })
      if (!res.ok) {
        if (res.status === 404) throw new Error('AI endpoint not found on server. Please update backend.')
        const txt = await res.text()
        try {
          const err = JSON.parse(txt)
          throw new Error(err.error || 'Generation failed')
        } catch (e) { throw new Error('Server error: ' + res.status) }
      }
      const data = await res.json()
      
      setForm(prev => ({
        ...prev,
        title: data.title || prev.title,
        slug: data.slug || prev.slug,
        meta_title: data.meta_title || prev.meta_title,
        meta_description: data.meta_description || prev.meta_description,
        keywords: data.keywords || prev.keywords,
        summary: data.summary || prev.summary,
        content: data.content || prev.content
      }))
    } catch (e) {
      console.error(e)
      alert('Error: ' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      {!token ? (
        <div style={{maxWidth:420}}>
          {!showForgot ? (
            <form onSubmit={login}>
              <h2>Admin Login</h2>
              <div><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/></div>
              <div style={{marginTop:8}}><input value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" type="password"/></div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button type="submit">Login</button>
                <button type="button" onClick={()=>{ setShowForgot(true); setForgotEmail(email); setSecretQuestion(''); setForgotNotice('') }}>Forgot?</button>
              </div>
            </form>
          ) : (
            <form onSubmit={getForgotQuestion}>
              <h2>Forgot password</h2>
              <div><input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="admin email"/></div>
              {!secretQuestion ? (
                <div style={{display:'flex',gap:8,marginTop:8}}>
                  <button type="submit">Get secret question</button>
                  <button type="button" onClick={()=>{ setShowForgot(false); setSecretQuestion(''); setForgotNotice('') }}>Back</button>
                </div>
              ) : (
                <div style={{marginTop:8}}>
                  <div style={{fontWeight:700}}>Question:</div>
                  <div style={{marginBottom:8}}>{secretQuestion}</div>
                  <div><input value={forgotAnswer} onChange={e=>setForgotAnswer(e.target.value)} placeholder="Answer"/></div>
                  <div style={{marginTop:8}}><input value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" type="password"/></div>
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <button type="button" onClick={resetForgot}>Reset password</button>
                    <button type="button" onClick={()=>{ setShowForgot(false); setSecretQuestion(''); setForgotNotice('') }}>Back</button>
                  </div>
                </div>
              )}
              {forgotNotice && <div className="muted" style={{marginTop:8}}>{forgotNotice}</div>}
            </form>
          )}
        </div>
      ) : (
        <div className="admin-layout">
          <aside className="sidebar">
            <div className="sidebar-section">
              <button className={`side-btn ${activePanel==='overview'?'active':''}`} onClick={()=>setActivePanel('overview')}>Overview</button>
              <button className={`side-btn ${activePanel==='blogs'?'active':''}`} onClick={()=>setActivePanel('blogs')}>Blog Management</button>
              <button className={`side-btn ${activePanel==='pages'?'active':''}`} onClick={()=>setActivePanel('pages')}>Dynamic Pages</button>
              <button className={`side-btn ${activePanel==='branding'?'active':''}`} onClick={()=>setActivePanel('branding')}>Product Branding</button>
              <button className={`side-btn ${activePanel==='hero-strip'?'active':''}`} onClick={()=>setActivePanel('hero-strip')}>Hero Strip</button>
              <button className={`side-btn ${activePanel==='news'?'active':''}`} onClick={()=>{ setActivePanel('news'); fetchNews(); }}>News Ticker</button>
              <button className={`side-btn ${activePanel==='requests'?'active':''}`} onClick={()=>setActivePanel('requests')}>Brand Requests <span className="badge">{requests.length}</span></button>
              <button className={`side-btn ${activePanel==='categories'?'active':''}`} onClick={()=>{ setActivePanel('categories'); fetchAdminCategories(); }}>Categories</button>
              <button className={`side-btn ${activePanel==='comments'?'active':''}`} onClick={()=>{ setActivePanel('comments'); fetchAdminComments({ status: commentStatusFilter, blog_id: commentBlogFilter }); }}>Comments</button>
              <button className={`side-btn ${activePanel==='questions'?'active':''}`} onClick={()=>{ setActivePanel('questions'); }}>GK Questions</button>
              <button className={`side-btn ${activePanel==='current-affairs'?'active':''}`} onClick={()=>{ setActivePanel('current-affairs'); }}>Current Affairs</button>
              <button className={`side-btn ${activePanel==='ai-generator'?'active':''}`} onClick={()=>{ setActivePanel('ai-generator'); }}>AI Question Generator</button>
              <button className={`side-btn ${activePanel==='page-seo'?'active':''}`} onClick={()=>{ setActivePanel('page-seo'); }}>Page SEO (GK/CA)</button>
              <button className={`side-btn ${activePanel==='settings'?'active':''}`} onClick={()=>setActivePanel('settings')}>Settings</button>
              <div style={{marginTop:12}}><button onClick={logout}>Logout</button></div>
            </div>
          </aside>

          <div className="content-area">
            {activePanel === 'settings' && (
              <SettingsPanel token={token} />
            )}
            
            {activePanel === 'ai-generator' && (
              <QuestionSetGenerator token={token} />
            )}

            {activePanel === 'questions' && (
              <AdminGK token={token} initialCategoryFilter={initialGKCategory} />
            )}

            {activePanel === 'current-affairs' && (
              <div>
                <h2>Current Affairs Management</h2>
                <p className="muted">Manage multiple-choice questions in the <strong>Current Affairs</strong> category. Use the filters to edit chapters, search text, or bulk import questions. You can also export the current list as CSV.</p>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
                  <button type="button" onClick={async ()=>{
                    try{
                      const q = new URLSearchParams({ category: 'Current Affairs', limit: '10000' })
                      const res = await fetch('/api/questions?'+q.toString(), { headers: { 'Authorization': 'Bearer ' + (token || '') } })
                      if (!res.ok) { const b = await res.json().catch(()=>({})); return alert(b.error || 'Failed to fetch questions') }
                      const data = await res.json()
                      const items = Array.isArray(data.items) ? data.items : []
                      if (!items.length) return alert('No Current Affairs questions found')
                      const headers = ['id','question_english','question_hindi','options_1_english','options_2_english','options_3_english','options_4_english','options_1_hindi','options_2_hindi','options_3_hindi','options_4_hindi','answer','category','chapter_name','solution']
                      const escapeCell = (v) => {
                        if (v === null || v === undefined) return ''
                        const s = String(v)
                        if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
                        return s
                      }
                      const rows = [headers.join(',')]
                      for (const it of items){
                        const row = headers.map(h => escapeCell(it[h] || ''))
                        rows.push(row.join(','))
                      }
                      const csv = rows.join('\n')
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'current-affairs-questions.csv'
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    }catch(err){ console.error(err); alert('Export failed') }
                  }}>Export CSV</button>
                </div>
                <AdminGK token={token} initialCategoryFilter={'Current Affairs'} />
              </div>
            )}
            {activePanel === 'page-seo' && (
              <div>
                <h2>Page SEO — General Knowledge & Current Affairs</h2>
                <p className="muted">Edit SEO meta for the public pages. Changes affect Open Graph and description used by link preview crawlers.</p>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}>
                  {['general-knowledge','currentaffairs'].map((slug)=>{
                    const key = slug
                    const data = seoPages[key] || { meta_title:'', meta_description:'', keywords:'', id: null }
                    return (
                      <div key={key} style={{padding:12,background:'#fff',borderRadius:8}}>
                        <h3 style={{marginTop:0}}>{slug === 'general-knowledge' ? 'General Knowledge' : 'Current Affairs'}</h3>
                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                          <label>Meta Title</label>
                          <input value={data.meta_title || ''} onChange={(e)=> setSeoPages(prev => ({ ...prev, [key]: { ...(prev[key]||{}), meta_title: e.target.value } }))} />
                          <label>Meta Description</label>
                          <textarea rows={3} value={data.meta_description || ''} onChange={(e)=> setSeoPages(prev => ({ ...prev, [key]: { ...(prev[key]||{}), meta_description: e.target.value } }))} />
                          <label>Keywords (comma separated)</label>
                          <input value={data.keywords || ''} onChange={(e)=> setSeoPages(prev => ({ ...prev, [key]: { ...(prev[key]||{}), keywords: e.target.value } }))} />
                          <div style={{display:'flex',gap:8,marginTop:8}}>
                            <button type="button" onClick={async ()=>{
                              try{
                                setSeoLoading(true)
                                const res = await fetch('/api/pages/slug/' + encodeURIComponent(slug))
                                if (!res.ok) {
                                  // initialize empty
                                  setSeoPages(prev => ({ ...prev, [key]: { meta_title:'', meta_description:'', keywords:'', id: null } }))
                                  return
                                }
                                const d = await res.json()
                                setSeoPages(prev => ({ ...prev, [key]: { meta_title: d.meta_title || '', meta_description: d.meta_description || '', keywords: d.keywords || '', id: d.id || null } }))
                              }catch(err){ console.error('load seo failed', err); alert('Failed to load') } finally { setSeoLoading(false) }
                            }}>Load</button>
                            <button type="button" onClick={async ()=>{
                              try{
                                setSeoLoading(true)
                                const tokenVal = localStorage.getItem('token') || token || ''
                                if (!tokenVal) return alert('Not authorized')
                                const payload = {
                                  title: (slug === 'general-knowledge' ? 'General Knowledge' : 'Current Affairs'),
                                  slug: slug,
                                  content: '',
                                  meta_title: (seoPages[key] && seoPages[key].meta_title) || '',
                                  meta_description: (seoPages[key] && seoPages[key].meta_description) || '',
                                  keywords: (seoPages[key] && seoPages[key].keywords) || '',
                                  published: true
                                }
                                if (seoPages[key] && seoPages[key].id) {
                                  const res = await fetch('/api/pages/' + seoPages[key].id, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + tokenVal, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                                  if (!res.ok) { const d = await res.json().catch(()=>null); return alert(d && d.error ? d.error : 'Save failed') }
                                  const d = await res.json()
                                  setSeoPages(prev => ({ ...prev, [key]: { meta_title: d.meta_title || '', meta_description: d.meta_description || '', keywords: d.keywords || '', id: d.id || null } }))
                                  alert('Updated')
                                } else {
                                  const res = await fetch('/api/pages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tokenVal, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                                  if (!res.ok) { const d = await res.json().catch(()=>null); return alert(d && d.error ? d.error : 'Create failed') }
                                  const d = await res.json()
                                  setSeoPages(prev => ({ ...prev, [key]: { meta_title: d.meta_title || '', meta_description: d.meta_description || '', keywords: d.keywords || '', id: d.id || null } }))
                                  alert('Created')
                                }
                              }catch(err){ console.error('save seo failed', err); alert('Failed to save') } finally { setSeoLoading(false) }
                            }}>{seoPages[key] && seoPages[key].id ? 'Update' : 'Create'}</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {activePanel === 'blogs' && (
              <div>
                <h2>Blog Management</h2>
                <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', padding:15, borderRadius:8, marginBottom:20, maxWidth:920}}>
                  <div style={{fontWeight:600, marginBottom:8, color:'#334155'}}>AI Auto-Fill</div>
                  <div style={{display:'flex', gap:8}}>
                    <input 
                      value={aiPrompt} 
                      onChange={e=>setAiPrompt(e.target.value)} 
                      placeholder="Enter blog topic or instructions..." 
                      style={{flex:1}} 
                    />
                    <button type="button" onClick={generateBlogWithAI} disabled={aiLoading} style={{background: aiLoading ? '#94a3b8' : '#7c3aed', color:'white', border:'none', whiteSpace:'nowrap'}}>
                      {aiLoading ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                </div>
                <form onSubmit={create} style={{maxWidth:920}}>
                  <div style={{display:'flex',gap:8}}>
                    <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title" style={{flex:1}}/>
                    <button type="button" onClick={()=>{ const s = (form.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); setForm({...form,slug: s}) }} style={{whiteSpace:'nowrap'}}>Generate Slug</button>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="Slug (URL)" style={{flex:1}}/>
                    <button type="button" onClick={()=>{ try{ const url = window.location.origin + '/posts/' + (form.slug || form.id || ''); navigator.clipboard.writeText(url); alert('URL copied'); }catch(e){}}}>Copy URL</button>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                    <div style={{flex:1}}>
                      <small className="muted">Featured image</small>
                      <div style={{marginTop:6}}>
                        {form.featured_image ? (<img src={form.featured_image} alt="featured" style={{maxWidth:220,borderRadius:6}}/>) : (<div style={{height:80,background:'#f3f4f6',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>No image</div>)}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      <input type="file" accept="image/*" onChange={async (e)=>{
                        const f = e.target.files && e.target.files[0]; if (!f) return;
                        const fd = new FormData(); fd.append('file', f);
                        setUploading(true);
                        try{
                          const slugSource = (form.slug || form.title || '').toString().trim();
                          const sanitized = slugSource
                            .toLowerCase()
                            .replace(/[^a-z0-9\-]+/g,'-')
                            .replace(/^-+|-+$/g,'');
                          const finalSlug = sanitized || ('blog-' + Date.now());
                          const extMatch = (f.name || '').match(/\.[a-z0-9]{1,8}$/i);
                          const ext = (extMatch ? extMatch[0] : '.jpg').toLowerCase();
                          fd.append('filename', `${finalSlug}-featured${ext}`);
                          const res = await fetch('/api/upload-rename', { method:'POST', headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token')||'') }, body: fd });
                          const d = await res.json();
                          if (res.ok && d.url) {
                            setForm(prev=> ({
                              ...prev,
                              featured_image: d.url,
                              ...(prev.slug ? {} : sanitized ? { slug: sanitized } : {})
                            }));
                          } else {
                            alert(d.error || 'Upload failed');
                          }
                        }catch(err){ console.error(err); alert('Upload failed') }
                        setUploading(false);
                      }} />
                      <button type="button" onClick={()=>setForm({...form,featured_image:''})}>Remove</button>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <select value={form.category||''} onChange={e=>setForm({...form,category:e.target.value})} style={{flex:1}}>
                      <option value="">Uncategorized</option>
                      {categories.map(c=> (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                    <label style={{display:'flex',gap:6,alignItems:'center',whiteSpace:'nowrap'}}>
                      <input type="checkbox" checked={Boolean(form.is_hero)} onChange={e=>setForm({...form,is_hero:e.target.checked})} />
                      Hero
                    </label>
                    <input type="number" value={Number(form.hero_order||0)} onChange={e=>setForm({...form,hero_order:Number(e.target.value||0)})} placeholder="Hero order" style={{width:120}}/>
                  </div>
                  <div><input value={form.summary} onChange={e=>setForm({...form,summary:e.target.value})} placeholder="Summary"/></div>
                  <div><input value={form.meta_title} onChange={e=>setForm({...form,meta_title:e.target.value})} placeholder="Meta Title (SEO)"/></div>
                  <div><textarea value={form.meta_description} onChange={e=>setForm({...form,meta_description:e.target.value})} placeholder="Meta Description (SEO)" rows={2} style={{width:'100%'}}/></div>
                  <div><input value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="Keywords (comma separated)"/></div>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                      <div style={{flex:1}}>
                        <small style={{color:'#666'}}>Content</small>
                      </div>
                      <div>
                        <button type="button" onClick={()=>{ setPasteHtmlVisible(true); setPasteHtmlText('') }} style={{padding:'6px 10px'}}>Paste HTML</button>
                      </div>
                    </div>
                  <div>
                      <div style={{margin:'8px 0'}}>
                        <label style={{fontSize:13,color:'#333'}}>Editor:
                          <select value={selectedEditor} onChange={e=>setSelectedEditor(e.target.value)} style={{marginLeft:8}}>
                            <option value="jodit">Jodit</option>
                            <option value="quill">Quill</option>
                          </select>
                        </label>
                      </div>
                      {
                        (()=>{
                          const editorConfig = {
                            readonly: false,
                            height: 400,
                            placeholder: 'Write content here...',
                            // try to preserve pasted HTML (insert as HTML and avoid cleaning)
                            defaultActionOnPaste: 'insert_as_html',
                            cleanHTML: false,
                            askBeforePasteFromWord: false,
                            // paste event: if clipboard has HTML, insert it directly
                            events: {
                              paste: function (e) {
                                try {
                                  const cb = (e.clipboardData || window.clipboardData);
                                  const html = cb && cb.getData && cb.getData('text/html');
                                  if (html) {
                                    e.preventDefault();
                                    // 'this' is Jodit editor instance
                                    this.s.insertHTML(html);
                                  }
                                } catch (err) {
                                  // fallback - do nothing
                                }
                              }
                            },
                            // allow many inline tags/styles (be permissive)
                            allowTags: null,
                            allowEmptyTags: ['span','a','i','b','strong','em'],
                          }
                          return (
                            selectedEditor === 'jodit' ? (
                              <JoditEditor
                                ref={joditRef}
                                value={form.content}
                                config={joditConfig}
                                onBlur={newContent => setFormContent(newContent)}
                              />
                            ) : (
                              <ReactQuill
                                ref={quillRef}
                                value={form.content}
                                onChange={setFormContent}
                                modules={quillModules}
                                formats={quillFormats}
                                theme="snow"
                              />
                            )
                          )
                        })()
                      }
                  </div>
                  <div><label><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/> Published</label></div>
                  <div style={{marginTop:8}}>
                    <button type="submit">{editingId ? 'Update Blog' : 'Create Blog'}</button>
                    {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({title:'',summary:'',content:'',published:false, slug:'', meta_title:'', meta_description:'', keywords:'', featured_image:'', category:'', is_hero:false, hero_order:0}); try{ setFormContent('') }catch(e){} }} style={{marginLeft:8}}>Cancel</button>}
                  </div>
                </form>

                <h3 style={{marginTop:20}}>Existing Blogs ({blogs.length})</h3>
                <div style={{display:'block',marginTop:12}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:10}}>
                    <input placeholder="Search blogs..." value={blogSearch} onChange={e=>setBlogSearch(e.target.value)} style={{flex:1}} />
                    <label style={{display:'flex',flexDirection:'column',fontSize:12}}>From
                      <input type="date" value={blogDateFrom} onChange={e=>setBlogDateFrom(e.target.value)} /></label>
                    <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
                      <input type="date" value={blogDateTo} onChange={e=>setBlogDateTo(e.target.value)} /></label>
                    <label style={{display:'flex',gap:8,alignItems:'center'}}>Min views:
                      <input type="number" value={blogMinViews} onChange={e=>setBlogMinViews(Number(e.target.value||0))} style={{width:120,marginLeft:8}} />
                    </label>
                  </div>
                  {
                    (()=>{
                      // apply min views filter and sorting
                      let filtered = blogs.filter(b=> Number(b.views||0) >= Number(blogMinViews||0))
                      const s = (blogSearch||'').trim().toLowerCase()
                      if (s) filtered = filtered.filter(b=> ((b.title||'')+ ' ' + (b.summary||'') + ' ' + (b.content||'')).toLowerCase().includes(s))
                      if (blogDateFrom) {
                        const from = new Date(blogDateFrom)
                        filtered = filtered.filter(b=> { try{ return new Date(b.created_at) >= from }catch(e){ return true } })
                      }
                      if (blogDateTo) {
                        const to = new Date(blogDateTo); to.setHours(23,59,59,999)
                        filtered = filtered.filter(b=> { try{ return new Date(b.created_at) <= to }catch(e){ return true } })
                      }
                      if (blogSort === 'views_desc') filtered = filtered.slice().sort((a,b)=> Number(b.views||0) - Number(a.views||0))
                      else if (blogSort === 'views_asc') filtered = filtered.slice().sort((a,b)=> Number(a.views||0) - Number(b.views||0))
                      else filtered = filtered.slice().sort((a,b)=> new Date(b.created_at) - new Date(a.created_at))
                      const total = filtered.length
                      const totalPages = Math.max(1, Math.ceil(total / perPage))
                      const start = (currentPage-1)*perPage
                      const pageItems = filtered.slice(start, start+perPage)
                      return (
                        <div>
                          <div style={{display:'flex',flexDirection:'column',gap:12}}>
                            <table className="admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
                              <thead>
                                <tr>
                                  <th style={{textAlign:'left',padding:12}}>Title</th>
                                  <th style={{textAlign:'left',padding:12}}>Category / Hero</th>
                                  <th style={{textAlign:'left',padding:12}}>Votes • Comments • Views</th>
                                  <th style={{textAlign:'left',padding:12}}>Status</th>
                                  <th style={{textAlign:'left',padding:12}}>Excerpt</th>
                                  <th style={{textAlign:'left',padding:12}}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pageItems.map(b => {
                                  const raw = b.content || ''
                                  const snippet = raw.length > 400 ? raw.slice(0,400) + '...' : raw
                                  const previewHtml = makePreviewHtml(snippet)
                                  return (
                                    <tr key={b.id} style={{borderTop:'1px solid rgba(2,6,23,0.04)'}}>
                                      <td style={{padding:12,verticalAlign:'top',width:'22%'}}>
                                        <div style={{fontWeight:700}}>{b.title}</div>
                                        <div className="muted" style={{fontSize:12,marginTop:6}}>{new Date(b.created_at).toLocaleDateString()}</div>
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top',width:'12%'}}>
                                        <div>{b.category ? b.category : 'Uncategorized'}</div>
                                        {(b.is_hero || b.is_hero === 1) && <div className="muted" style={{marginTop:6}}>Hero #{Number(b.hero_order||0)}</div>}
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top',width:'18%'}}>
                                        <div>Up: {Number(b.up_votes || 0)}</div>
                                        <div>Down: {Number(b.down_votes || 0)}</div>
                                        <div>Comments: {Number(b.comments_count || 0)}</div>
                                        <div>Views: {Number(b.views || 0)}</div>
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top',width:'8%'}}>
                                        <span className="muted">{b.published? 'Published' : 'Draft'}</span>
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top',width:'36%'}}>
                                        <div className="admin-preview-content" dangerouslySetInnerHTML={{__html: previewHtml }} />
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top',width:'8%'}}>
                                        <div style={{display:'flex',flexDirection:'column',gap:8}}>
                                          <button onClick={()=>loadForEdit(b.id)}>Edit</button>
                                          <button onClick={()=>bumpBlog(b.id)}>Make Recent</button>
                                          <button onClick={()=>remove(b.id)}>Delete</button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="pagination" style={{display:'flex',gap:8,marginTop:12}}>
                            {Array.from({length: totalPages}).map((_,i)=> (
                              <button key={i} className={`page-btn ${currentPage===i+1?'active':''}`} onClick={()=>setCurrentPage(i+1)}>{i+1}</button>
                            ))}
                          </div>
                        </div>
                      )
                    })()
                  }
                </div>
              </div>
            )}


            {activePanel === 'pages' && (
              <div>
                <h2>Dynamic Pages</h2>
                <div className="muted" style={{marginBottom:16}}>Design custom pages with the Jodit editor and link them anywhere on the site by slug.</div>
                {pageNotice && (
                  <div style={{padding:'10px 12px',background:'#ecfdf5',border:'1px solid #bbf7d0',borderRadius:6,color:'#166534',marginBottom:12}}>{pageNotice}</div>
                )}
                <form onSubmit={saveDynamicPage} style={{display:'flex',flexDirection:'column',gap:12}}>
                  <input value={pageForm.title} onChange={e=>setPageForm({...pageForm,title:e.target.value})} placeholder="Page title" required />
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                    <input value={pageForm.slugInput} onChange={e=>setPageForm({...pageForm,slugInput:e.target.value})} placeholder="Slug (example: notification)" style={{flex:'1 1 240px'}} />
                    <div style={{fontSize:12,color:'#555',display:'flex',flexDirection:'column',gap:2}}>
                      <span style={{fontWeight:500}}>Custom slug: {pageForm.slugInput || '(auto)'}</span>
                      <span>Live URL: {currentPageLivePath ? (currentPageLiveUrl || currentPageLivePath) : 'Not set'}</span>
                    </div>
                  </div>
                  <input value={pageForm.meta_title} onChange={e=>setPageForm({...pageForm,meta_title:e.target.value})} placeholder="Meta title (optional)" />
                  <textarea value={pageForm.meta_description} onChange={e=>setPageForm({...pageForm,meta_description:e.target.value})} placeholder="Meta description" rows={2} style={{width:'100%'}} />
                  <input value={pageForm.keywords} onChange={e=>setPageForm({...pageForm,keywords:e.target.value})} placeholder="Keywords (comma separated)" />

                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <label style={{marginRight:8}}>Page Type</label>
                    <select value={pageForm.type || 'jodit'} onChange={e=>{ const t = e.target.value; setPageForm(prev=>({ ...prev, type: t })); if (t === 'jodit') { /* keep existing content */ } }}>
                      <option value="jodit">Rich HTML (editor)</option>
                      <option value="code">Code Runner (HTML/CSS/JS)</option>
                    </select>
                  </div>

                  { (pageForm.type || 'jodit') === 'code' ? (
                    <div style={{marginTop:12}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:12}}>
                        <div>
                          <label style={{fontWeight:600}}>Combined Code (include &lt;style&gt; and &lt;script&gt; if needed)</label>
                          <textarea rows={15} value={pageForm.code||''} onChange={e=>{ const v = e.target.value; setPageForm(prev=>({ ...prev, code: v })); }} style={{width:'100%',padding:8,borderRadius:6,fontFamily:'monospace'}}/>
                          <div style={{marginTop:8,fontSize:13,color:'#6b7280'}}>You can include HTML, CSS (&lt;style&gt;) and JavaScript (&lt;script&gt;) together in this box.</div>
                        </div>

                        <div>
                          <div style={{display:'flex',gap:8,marginBottom:8}}>
                            <button type="button" onClick={()=>{ setPageForm(prev=>({ ...prev, code: '' })); }}>Clear</button>
                          </div>

                          <div style={{border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
                            <iframe title="Code preview" style={{width:'100%',height:340,border:0}} srcDoc={("<meta charset=\"utf-8\">" + (pageForm.code||''))}></iframe>
                          </div>
                        </div>
                      </div>
                      <div style={{marginTop:8,color:'#6b7280',fontSize:13}}>Tip: click <strong>Insert to content</strong> to save the composed code into the page's content before creating/updating the page.</div>
                    </div>
                  ) : (
                    <JoditEditor
                      ref={pageEditorRef}
                      value={pageForm.content}
                      config={joditConfig}
                      onBlur={setPageFormContent}
                    />
                  ) }
                  <label style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={pageForm.published} onChange={e=>setPageForm({...pageForm,published:e.target.checked})} />
                    Published
                  </label>
                  <div>
                    <button type="submit">{editingPageId ? 'Update Page' : 'Create Page'}</button>
                    <button type="button" onClick={startNewPage} style={{marginLeft:8}}>New Page</button>
                    {editingPageId && currentPageLivePath && (
                      <button
                        type="button"
                        onClick={()=>{
                          if (!currentPageLivePath) return
                          const target = currentPageLiveUrl || currentPageLivePath
                          const win = window.open(target, '_blank')
                          if (win) win.opener = null
                        }}
                        style={{marginLeft:8}}
                      >
                        View live
                      </button>
                    )}
                  </div>
                </form>

                {(() => {
                  const hiddenSlugs = new Set(['currentaffairs', 'general-knowledge'])
                  const filteredPages = (pages || []).filter(p => {
                    const s = normalizePageSlugInput(p.slug || p.slug_input || '')
                    return !hiddenSlugs.has(s)
                  })
                  return (
                    <>
                      <h3 style={{marginTop:28}}>Saved Pages ({filteredPages.length})</h3>
                      <form onSubmit={e=>{ e.preventDefault(); fetchDynamicPages({ search: pageSearch.trim() }); }} style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                        <input value={pageSearch} onChange={e=>setPageSearch(e.target.value)} placeholder="Search by title or slug" style={{flex:'1 1 240px'}} />
                        <button type="submit">Search</button>
                        <button type="button" onClick={()=>{ setPageSearch(''); fetchDynamicPages({ search: '' }); }}>Reset</button>
                      </form>

                      {pageLoading ? (
                        <div style={{padding:12}}>Loading pages...</div>
                      ) : (
                        filteredPages.length === 0 ? (
                          <div style={{padding:12,color:'#666'}}>No pages yet.</div>
                        ) : (
                          <div style={{overflowX:'auto'}}>
                            <table className="admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
                              <thead>
                                <tr>
                                  <th style={{textAlign:'left',padding:12}}>Title</th>
                                  <th style={{textAlign:'left',padding:12}}>Slug</th>
                                  <th style={{textAlign:'left',padding:12}}>Status</th>
                                  <th style={{textAlign:'left',padding:12}}>Updated</th>
                                  <th style={{textAlign:'left',padding:12}}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredPages.map(p => {
                                  const normalizedSlug = normalizePageSlugInput(p.slug || p.slug_input || '')
                                  const slugPath = normalizedSlug ? '/' + normalizedSlug : ''
                                  const fullLink = slugPath ? ((siteOrigin || '') + slugPath) : ''
                                  const displaySlug = p.slug_input || (slugPath || '')
                                  let updatedLabel = '—'
                                  if (p.updated_at) {
                                    try { updatedLabel = new Date(p.updated_at).toLocaleString() } catch (err) { updatedLabel = p.updated_at }
                                  }
                                  return (
                                    <tr key={p.id} style={{borderTop:'1px solid rgba(2,6,23,0.06)'}}>
                                      <td style={{padding:12,verticalAlign:'top'}}>{p.title}</td>
                                      <td style={{padding:12,verticalAlign:'top'}}>
                                        {displaySlug ? (
                                          <div>
                                            <div>{displaySlug}</div>
                                            {fullLink && <div style={{fontSize:12,color:'#555',marginTop:4}}>{fullLink}</div>}
                                          </div>
                                        ) : '—'}
                                      </td>
                                      <td style={{padding:12,verticalAlign:'top'}}>{p.published ? 'Published' : 'Draft'}</td>
                                      <td style={{padding:12,verticalAlign:'top'}}>{updatedLabel}</td>
                                      <td style={{padding:12,verticalAlign:'top'}}>
                                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                          <button type="button" onClick={()=>loadDynamicPage(p.id)}>Edit</button>
                                          {slugPath && (
                                            <button type="button" onClick={()=>{ const target = fullLink || slugPath; const win = window.open(target, '_blank'); if (win) win.opener = null }}>View</button>
                                          )}
                                          <button type="button" onClick={()=>removeDynamicPage(p.id)}>Delete</button>
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </>
                  )
                })()}
                </div>
              )}

            {activePanel === 'branding' && (
              <div>
                <h2>Product Branding</h2>
                <BrandingManager token={token} />
              </div>
            )}

            {activePanel === 'hero-strip' && (
              <div>
                <h2>Hero Strip</h2>
                <BrandingStripManager token={token} />
              </div>
            )}

            {activePanel === 'overview' && (
              <div>
                <h2>Overview</h2>
                <Overview token={token} onViewCategory={(cat)=>{ setInitialGKCategory(cat || ''); setActivePanel('questions') }} />
              </div>
            )}

            {activePanel === 'categories' && (
              <div>
                <CategoriesManager token={token} onChange={fetchAdminCategories} />
              </div>
            )}

            {activePanel === 'comments' && (
              <div>
                <h2>Comments</h2>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>
                    Status
                    <select value={commentStatusFilter} onChange={e=>setCommentStatusFilter(e.target.value)} style={{marginTop:4}}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>
                    Blog ID
                    <input value={commentBlogFilter} onChange={e=>setCommentBlogFilter(e.target.value)} placeholder="e.g. 12" style={{marginTop:4,minWidth:120}} />
                  </label>
                  <input value={commentSearch} onChange={e=>setCommentSearch(e.target.value)} placeholder="Search author, email or content" style={{flex:'1 1 240px'}} />
                  <button type="button" onClick={()=>fetchAdminComments({ status: commentStatusFilter, blog_id: commentBlogFilter })}>Refresh</button>
                </div>

                <div style={{marginBottom:12,color:'#6b7280'}}>
                  Showing {adminComments.length} comments fetched{commentStatusFilter !== 'all' ? ` (${commentStatusFilter})` : ''}.
                </div>

                {adminCommentsLoading && <div style={{color:'#666',marginBottom:12}}>Loading comments…</div>}

                {!adminCommentsLoading && (
                  (()=>{
                    const search = (commentSearch||'').trim().toLowerCase()
                    const filtered = adminComments.filter(c => {
                      if (!search) return true
                      const hay = ((c.author_name||'') + ' ' + (c.author_email||'') + ' ' + (c.content||'') + ' ' + (c.blog_title||'')).toLowerCase()
                      return hay.includes(search)
                    })
                    if (filtered.length === 0) {
                      return <div style={{color:'#6b7280'}}>No matching comments.</div>
                    }
                    const formatContent = (text) => String(text||'').slice(0,220).replace(/\n/g,'<br />')
                    return (
                      <div style={{overflowX:'auto'}}>
                        <table className="admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
                          <thead>
                            <tr>
                              <th style={{padding:8,textAlign:'left'}}>Blog</th>
                              <th style={{padding:8,textAlign:'left'}}>Author</th>
                              <th style={{padding:8,textAlign:'left'}}>Status</th>
                              <th style={{padding:8,textAlign:'left'}}>Created</th>
                              <th style={{padding:8,textAlign:'left'}}>Content</th>
                              <th style={{padding:8,textAlign:'left'}}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(c => (
                              <tr key={c.id} style={{borderTop:'1px solid rgba(15,23,42,0.08)'}}>
                                <td style={{padding:8,verticalAlign:'top',minWidth:160}}>
                                  <div style={{fontWeight:600}}>{c.blog_title || 'Untitled'}</div>
                                  <div style={{fontSize:12,color:'#6b7280'}}>ID: {c.blog_id}</div>
                                </td>
                                <td style={{padding:8,verticalAlign:'top',minWidth:160}}>
                                  <div>{c.author_name || 'Anonymous'}</div>
                                  {c.author_email && <div style={{fontSize:12,color:'#6b7280'}}>{c.author_email}</div>}
                                </td>
                                <td style={{padding:8,verticalAlign:'top'}}>
                                  <span style={{textTransform:'capitalize'}}>{c.status || 'pending'}</span>
                                </td>
                                <td style={{padding:8,verticalAlign:'top',minWidth:140}}>
                                  {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                                </td>
                                <td style={{padding:8,verticalAlign:'top',minWidth:220}}>
                                  <div style={{fontSize:14,lineHeight:1.5}} dangerouslySetInnerHTML={{__html: formatContent(c.content)}} />
                                </td>
                                <td style={{padding:8,verticalAlign:'top',minWidth:260}}>
                                  {(() => {
                                    const actionStyles = {
                                      approve: { bg: '#ecfdf5', border: '#bbf7d0', text: '#047857', dot: '#22c55e' },
                                      pending: { bg: '#fefce8', border: '#fde68a', text: '#b45309', dot: '#f59e0b' },
                                      reject: { bg: '#f3f4f6', border: '#e5e7eb', text: '#374151', dot: '#9ca3af' },
                                      delete: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', dot: '#ef4444' }
                                    }
                                    const actions = [
                                      {
                                        key: 'approve',
                                        label: 'Approve',
                                        disabled: c.status === 'approved',
                                        handler: () => setCommentStatus(c.id, 'approved')
                                      },
                                      {
                                        key: 'pending',
                                        label: 'Mark Pending',
                                        disabled: c.status === 'pending',
                                        handler: () => setCommentStatus(c.id, 'pending')
                                      },
                                      {
                                        key: 'reject',
                                        label: 'Reject',
                                        disabled: c.status === 'rejected',
                                        handler: () => setCommentStatus(c.id, 'rejected')
                                      },
                                      {
                                        key: 'delete',
                                        label: 'Delete',
                                        disabled: false,
                                        handler: () => deleteComment(c.id)
                                      }
                                    ]
                                    return (
                                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                        {actions.map(action => {
                                          const palette = actionStyles[action.key]
                                          return (
                                            <button
                                              key={action.key}
                                              type="button"
                                              disabled={action.disabled}
                                              onClick={action.handler}
                                              style={{
                                                display:'flex',
                                                alignItems:'center',
                                                gap:6,
                                                borderRadius:999,
                                                border:`1px solid ${palette.border}`,
                                                background:palette.bg,
                                                color:palette.text,
                                                padding:'6px 14px',
                                                cursor: action.disabled ? 'not-allowed' : 'pointer',
                                                opacity: action.disabled ? 0.55 : 1,
                                                fontSize:12,
                                                fontWeight:600
                                              }}
                                            >
                                              <span style={{width:8,height:8,borderRadius:'50%',background:palette.dot,display:'inline-block'}}></span>
                                              <span>{action.label}</span>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()
                )}
              </div>
            )}

            {activePanel === 'news' && (
              <div>
                <h2>News Ticker</h2>
                <div style={{marginBottom:8}}>
                  <label style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="checkbox" checked={newsPushRed} onChange={e=>setNewsPushRed(e.target.checked)} />
                    <span>Red Push Button</span>
                  </label>
                </div>
                <form onSubmit={saveNews} style={{maxWidth:720,display:'flex',gap:8,alignItems:'center',marginBottom:12}}>
                  <input value={newsForm.title} onChange={e=>setNewsForm({...newsForm,title:e.target.value})} placeholder="News title" style={{flex:2}} />
                  <input value={newsForm.link} onChange={e=>setNewsForm({...newsForm,link:e.target.value})} placeholder="Link (optional)" style={{flex:2}} />
                  <input type="number" value={Number(newsForm.position||0)} onChange={e=>setNewsForm({...newsForm,position:Number(e.target.value||0)})} placeholder="Position" style={{width:100}} />
                  <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={Boolean(newsForm.active)} onChange={e=>setNewsForm({...newsForm,active:e.target.checked})} /> Active</label>
                  <div>
                    <button type="submit" className={newsPushRed ? 'push-red' : ''}>{editingNewsId? 'Save' : 'Add'}</button>
                    {editingNewsId && <button type="button" onClick={()=>{ setEditingNewsId(null); setNewsForm({title:'',link:'',position:0,active:true}) }} style={{marginLeft:8}}>Cancel</button>}
                  </div>
                </form>

                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <input placeholder="Search news..." value={newsSearch} onChange={e=>setNewsSearch(e.target.value)} style={{flex:1}} />
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>From
                    <input type="date" value={newsDateFrom} onChange={e=>setNewsDateFrom(e.target.value)} /></label>
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
                    <input type="date" value={newsDateTo} onChange={e=>setNewsDateTo(e.target.value)} /></label>
                </div>

                <div style={{marginTop:8,overflowX:'auto'}}>
                  <table className="admin-requests-table admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        <th style={{padding:8}}>Title</th>
                        <th style={{padding:8}}>Link</th>
                        <th style={{padding:8}}>Position</th>
                        <th style={{padding:8}}>Active</th>
                        <th style={{padding:8}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(newsList||[]).filter(n=>{
                        const s = (newsSearch||'').trim().toLowerCase()
                        if (s) { const hay = ((n.title||'') + ' ' + (n.link||'')).toLowerCase(); if (!hay.includes(s)) return false }
                        if (newsDateFrom) { try{ if (new Date(n.created_at) < new Date(newsDateFrom)) return false }catch(e){} }
                        if (newsDateTo) { try{ const to = new Date(newsDateTo); to.setHours(23,59,59,999); if (new Date(n.created_at) > to) return false }catch(e){} }
                        return true
                      }).map(n=> (
                        <tr key={n.id}>
                          <td style={{padding:8,verticalAlign:'top'}}>{n.title}</td>
                          <td style={{padding:8,verticalAlign:'top'}}>{n.link}</td>
                          <td style={{padding:8,verticalAlign:'top'}}>{n.position}</td>
                          <td style={{padding:8,verticalAlign:'top'}}>{n.active ? 'Yes' : 'No'}</td>
                          <td style={{padding:8,verticalAlign:'top',display:'flex',gap:8}}>
                            <button onClick={()=>{ setEditingNewsId(n.id); setNewsForm({title:n.title||'',link:n.link||'',position:n.position||0,active: n.active===1 || n.active===true}); window.scrollTo(0,0) }}>Edit</button>
                            <button onClick={()=>removeNews(n.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

                {pasteHtmlVisible && (
                  <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setPasteHtmlVisible(false)}>
                    <div className="modal-card" onClick={e=>e.stopPropagation()}>
                      <button className="modal-close" onClick={()=>setPasteHtmlVisible(false)} aria-label="Close">×</button>
                      <h3>Paste HTML</h3>
                      <p style={{color:'#555'}}>Paste the full HTML (including inline styles) you copied from the source site below, then click <strong>Insert</strong>.</p>
                          <div><textarea value={pasteHtmlText} onChange={e=>setPasteHtmlText(e.target.value)} rows={10} style={{width:'100%',padding:8,borderRadius:6}}/></div>
                      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:10}}>
                        <button type="button" onClick={()=>setPasteHtmlVisible(false)}>Cancel</button>
                        <button type="button" onClick={()=>{ handlePasteHtml(pasteHtmlText || ''); setPasteHtmlVisible(false); }}>Insert</button>
                      </div>
                    </div>
                  </div>
                )}

            {activePanel === 'requests' && (
              <div>
                <h2>Brand Requests</h2>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                  <input placeholder="Search requests..." value={requestSearch} onChange={e=>setRequestSearch(e.target.value)} style={{flex:1}} />
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>From
                    <input type="date" value={requestDateFrom} onChange={e=>setRequestDateFrom(e.target.value)} /></label>
                  <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
                    <input type="date" value={requestDateTo} onChange={e=>setRequestDateTo(e.target.value)} /></label>
                </div>
                <div style={{marginTop:8,overflowX:'auto'}}>
                  <table className="admin-requests-table admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Image</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Name</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>WhatsApp</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Title</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Description</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Status</th>
                        <th style={{textAlign:'left',padding:8,borderBottom:'1px solid #eee'}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      { (requests||[]).filter(r=>{
                        const s = (requestSearch||'').trim().toLowerCase()
                        if (s) {
                          const hay = ((r.name||'') + ' ' + (r.mobile||'') + ' ' + (r.title||'') + ' ' + (r.description||'')).toLowerCase()
                          if (!hay.includes(s)) return false
                        }
                        if (requestDateFrom) {
                          try{ if (new Date(r.created_at) < new Date(requestDateFrom)) return false }catch(e){}
                        }
                        if (requestDateTo) {
                          try{ const to = new Date(requestDateTo); to.setHours(23,59,59,999); if (new Date(r.created_at) > to) return false }catch(e){}
                        }
                        return true
                      }).map(r => (
                        <tr key={r.id} style={{borderBottom:'1px solid #fafafa'}}>
                          <td style={{padding:8,verticalAlign:'top',width:120}}>
                            {r.image ? <img src={r.image} alt="preview" style={{maxWidth:100,maxHeight:80,borderRadius:6}}/> : <div className="muted" style={{fontSize:12}}>No image</div>}
                          </td>
                          <td style={{padding:8,verticalAlign:'top'}}>{r.name}</td>
                          <td style={{padding:8,verticalAlign:'top'}}>{r.mobile}</td>
                          <td style={{padding:8,verticalAlign:'top',maxWidth:220}}>{r.title || '-'}</td>
                          <td style={{padding:8,verticalAlign:'top',maxWidth:420,whiteSpace:'normal'}}>{r.description}</td>
                          <td style={{padding:8,verticalAlign:'top'}}>{r.status}</td>
                          <td style={{padding:8,verticalAlign:'top',display:'flex',gap:8,alignItems:'center'}}>
                            {r.status === 'solved' ? (
                              <span className="solved-icon" title="Solved" style={{display:'inline-flex',alignItems:'center',gap:0,color:'#059669'}}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            ) : (
                              <button title="Mark solved" onClick={async ()=>{
                                if (!confirm('Mark solved?')) return;
                                try{
                                  const t = localStorage.getItem('token') || token || '';
                                  const res = await fetch('/api/brand-requests/'+r.id, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}, body:JSON.stringify({status:'solved'}) });
                                  if (res.ok) fetchRequests(); else { const txt = await res.text().catch(()=>null); alert('Update failed: ' + (txt||res.statusText)) }
                                }catch(e){ console.error(e); alert('Update failed') }
                              }} className="icon-btn" style={{display:'inline-flex',alignItems:'center'}}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            )}

                            <button aria-label="Delete request" title="Delete request" onClick={async ()=>{
                              if (!confirm('Delete this request?')) return;
                              try{
                                const t = localStorage.getItem('token') || token || '';
                                const res = await fetch('/api/brand-requests/'+r.id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + t } });
                                if (res.ok) fetchRequests(); else { const txt = await res.text().catch(()=>null); alert('Delete failed: ' + (txt||res.statusText)) }
                              }catch(err){ console.error(err); alert('Delete failed') }
                            }} className="icon-btn" style={{background:'transparent',border:'1px solid rgba(2,6,23,0.06)',padding:'6px 8px',borderRadius:8}}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                                <path d="M3 6h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M10 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CategoriesManager({ token, onChange }){
  const [list, setList] = React.useState([])
  const [catSearch, setCatSearch] = React.useState('')
  const [catDateFrom, setCatDateFrom] = React.useState('')
  const [catDateTo, setCatDateTo] = React.useState('')
  const [form, setForm] = React.useState({ name:'', slug:'', description:'', meta_title:'', meta_description:'', keywords:'', position:0, active:true })
  const [editingId, setEditingId] = React.useState(null)

  useEffect(()=>{ fetchList() }, [])
  async function fetchList(){
    try{ const t = localStorage.getItem('token') || token || ''; const res = await fetch('/api/admin/categories', { headers: { 'Authorization':'Bearer '+t } }); const d = await res.json(); setList(Array.isArray(d)?d:[]) }catch(e){ console.error(e); setList([]) }
  }

  async function save(e){ e && e.preventDefault && e.preventDefault(); try{
    const t = localStorage.getItem('token') || token || '';
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? '/api/categories/' + editingId : '/api/categories'
    const res = await fetch(url, { method, headers: { 'Content-Type':'application/json','Authorization':'Bearer '+t }, body: JSON.stringify(form) })
    if (res.ok) { setForm({ name:'', slug:'', description:'', position:0, active:true }); setEditingId(null); fetchList(); if (onChange) onChange(); }
    else { const txt = await res.text(); try{ const d = txt?JSON.parse(txt):null; alert(d?.error||('Error: '+res.status)) }catch{ alert('Error: '+res.status+' '+ (txt||res.statusText)) } }
  }catch(err){ console.error(err); alert('Save failed') } }

  async function editIt(c){ setForm({ name:c.name||'', slug:c.slug||'', description:c.description||'', meta_title: c.meta_title||'', meta_description: c.meta_description||'', keywords: c.keywords||'', position:Number(c.position||0), active: c.active===1||c.active===true }); setEditingId(c.id); window.scrollTo({top:0,behavior:'smooth'}) }
  async function remove(id){ if (!confirm('Delete category?')) return; const t = localStorage.getItem('token') || token || ''; const res = await fetch('/api/categories/'+id, { method:'DELETE', headers: { 'Authorization': 'Bearer '+t } }); if (res.ok) { fetchList(); if (onChange) onChange(); } else alert('Delete failed') }

  return (
    <div>
      <h2>Categories</h2>
      <form onSubmit={save} style={{maxWidth:720,marginBottom:12}}>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{flex:1}} />
          <input placeholder="Slug (optional)" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} style={{width:240}} />
        </div>
        <div style={{marginTop:8}}>
          <textarea placeholder="Description (optional)" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        </div>
        <div style={{marginTop:8,display:'grid',gap:8}}>
          <input placeholder="Meta title (SEO)" value={form.meta_title} onChange={e=>setForm({...form,meta_title:e.target.value})} />
          <textarea placeholder="Meta description (SEO)" rows={2} value={form.meta_description} onChange={e=>setForm({...form,meta_description:e.target.value})} />
          <input placeholder="Keywords (comma separated)" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} />
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={Boolean(form.active)} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
          <input type="number" value={Number(form.position||0)} onChange={e=>setForm({...form,position:Number(e.target.value||0)})} style={{width:120}} />
          <div style={{marginLeft:'auto'}}>
            <button type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ name:'', slug:'', description:'', meta_title:'', meta_description:'', keywords:'', position:0, active:true }) }} style={{marginLeft:8}}>Cancel</button>}
          </div>
        </div>
      </form>

      <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
        <input placeholder="Search categories..." value={catSearch} onChange={e=>setCatSearch(e.target.value)} style={{flex:1}} />
        <label style={{display:'flex',flexDirection:'column',fontSize:12}}>From
          <input type="date" value={catDateFrom} onChange={e=>setCatDateFrom(e.target.value)} /></label>
        <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
          <input type="date" value={catDateTo} onChange={e=>setCatDateTo(e.target.value)} /></label>
      </div>
      <div style={{marginTop:8,overflowX:'auto'}}>
        <table className="admin-requests-table admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{padding:8}}>Name</th>
              <th style={{padding:8}}>Slug</th>
              <th style={{padding:8}}>Description</th>
              <th style={{padding:8}}>Position</th>
              <th style={{padding:8}}>Active</th>
              <th style={{padding:8}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            { (list||[]).filter(c=>{
              const s = (catSearch||'').trim().toLowerCase(); if (s) { const hay = ((c.name||'') + ' ' + (c.slug||'') + ' ' + (c.description||'')).toLowerCase(); if (!hay.includes(s)) return false }
              if (catDateFrom) { try{ if (new Date(c.created_at) < new Date(catDateFrom)) return false }catch(e){} }
              if (catDateTo) { try{ const to = new Date(catDateTo); to.setHours(23,59,59,999); if (new Date(c.created_at) > to) return false }catch(e){} }
              return true
            }).map(c=> (
              <tr key={c.id}>
                <td style={{padding:8,verticalAlign:'top'}}>{c.name}</td>
                <td style={{padding:8,verticalAlign:'top'}}>{c.slug}</td>
                <td style={{padding:8,verticalAlign:'top'}}>{c.description}</td>
                <td style={{padding:8,verticalAlign:'top'}}>{c.position}</td>
                <td style={{padding:8,verticalAlign:'top'}}>{c.active ? 'Yes' : 'No'}</td>
                <td style={{padding:8,verticalAlign:'top',display:'flex',gap:8}}>
                  <button onClick={()=>editIt(c)}>Edit</button>
                  <button onClick={()=>remove(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SettingsPanel({ token }){
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);
  useEffect(()=>{
    const t = localStorage.getItem('token') || token || '';
    if (!t) return;
    fetch('/api/settings', { headers: { 'Authorization': 'Bearer ' + t } }).then(r=>r.json()).then(d=> setSettings(d)).catch(()=>{})
  },[token])

  async function save(e){
    e.preventDefault();
    setLoading(true);
    try{
      const t = localStorage.getItem('token') || token || '';
      const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Authorization':'Bearer '+t, 'Content-Type':'application/json' }, body: JSON.stringify(settings) })
      if (!res.ok) { alert('Save failed'); setLoading(false); return }
      const d = await res.json().catch(()=>null)
      alert('Settings saved')
    }catch(err){ console.error(err); alert('Save failed') }
    setLoading(false)
  }

  return (
    <div>
      <h2>Site Settings</h2>
      <form onSubmit={save} style={{maxWidth:920}}>
        <div><label className="field-label">Homepage Meta Title</label><input value={settings.homepage_meta_title||''} onChange={e=>setSettings({...settings,homepage_meta_title:e.target.value})} /></div>
        <div><label className="field-label">Homepage Meta Description</label><textarea value={settings.homepage_meta_description||''} onChange={e=>setSettings({...settings,homepage_meta_description:e.target.value})} rows={3} /></div>
        <div><label className="field-label">Request Page Meta Title</label><input value={settings.request_meta_title||''} onChange={e=>setSettings({...settings,request_meta_title:e.target.value})} /></div>
        <div><label className="field-label">Request Page Meta Description</label><textarea value={settings.request_meta_description||''} onChange={e=>setSettings({...settings,request_meta_description:e.target.value})} rows={3} /></div>
        <div><label className="field-label">Site Keywords (comma separated)</label><input value={settings.site_keywords||''} onChange={e=>setSettings({...settings,site_keywords:e.target.value})} /></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={Boolean(settings.amazon_affiliate_enabled)} onChange={e=>setSettings({...settings,amazon_affiliate_enabled:e.target.checked})} /> Enable Amazon affiliate tag</label>
        </div>
        <div><label className="field-label">Amazon Affiliate Tag (for Amazon links)</label><input value={settings.amazon_affiliate_tag||''} onChange={e=>setSettings({...settings,amazon_affiliate_tag:e.target.value})} placeholder="your-associate-tag-20" /></div>
        <div><label className="field-label">Amazon Affiliate Disclosure (shown on pages)</label><textarea value={settings.amazon_affiliate_disclosure||''} onChange={e=>setSettings({...settings,amazon_affiliate_disclosure:e.target.value})} rows={2} /></div>
        <div style={{marginTop:12}}>
          <h3>AI Configuration</h3>
          <p className="muted">Configure your AI provider for automatic question generation.</p>
          <div><label className="field-label">AI API Key</label><input type="password" value={settings.ai_config?.apiKey||''} onChange={e=>setSettings({...settings, ai_config: {...(settings.ai_config||{}), apiKey: e.target.value}})} placeholder="sk-..." /></div>
          <div><label className="field-label">Base URL (optional)</label><input value={settings.ai_config?.baseUrl||''} onChange={e=>setSettings({...settings, ai_config: {...(settings.ai_config||{}), baseUrl: e.target.value}})} placeholder="https://api.openai.com/v1/chat/completions" /></div>
          <div><label className="field-label">Model Name</label><input value={settings.ai_config?.model||''} onChange={e=>setSettings({...settings, ai_config: {...(settings.ai_config||{}), model: e.target.value}})} placeholder="gpt-3.5-turbo" /></div>
        </div>
        <div style={{marginTop:12}}>
          <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Settings'}</button>
        </div>
      </form>
    </div>
  )
}

function BrandingManager({ token }){
  const [brands, setBrands] = useState([])
  const [brandSort, setBrandSort] = useState('default')
  const [brandMinViews, setBrandMinViews] = useState(0)
  const [brandSearch, setBrandSearch] = useState('')
  const [brandDateFrom, setBrandDateFrom] = useState('')
  const [brandDateTo, setBrandDateTo] = useState('')
  const [form, setForm] = useState({ title:'', slug:'', image:'', link:'', description:'', meta_title:'', meta_description:'', keywords:'', active:true, position:0 })
  const [slugEdited, setSlugEdited] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(()=>{ fetchList() }, [])
  async function fetchList(){
    try{ const res = await fetch('/api/brands', { headers: { 'Authorization': 'Bearer ' + (token||'') } }); const d = await res.json(); setBrands(Array.isArray(d)?d:[]) }catch(e){ console.error(e); setBrands([]) }
  }

  async function handleUpload(e){
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    setUploading(true);
    try{
      const source = (form.title || '').toString().trim() || (f.name || '').replace(/\.[^/.]+$/, '') || '';
      let sanitized = source.toLowerCase().replace(/[^a-z0-9\-]+/g,'-').replace(/^-+|-+$/g,'');
      if (!sanitized) sanitized = 'brand-' + Date.now();
      const extMatch = (f.name || '').match(/\.[a-z0-9]{1,8}$/i);
      const ext = (extMatch ? extMatch[0] : '.jpg').toLowerCase();
      fd.append('filename', sanitized + ext);
      const res = await fetch('/api/upload-rename', { method:'POST', headers: { 'Authorization': 'Bearer ' + (token||'') }, body: fd });
      const d = await res.json(); if (res.ok && d.url) setForm(prev=>({ ...prev, image: d.url })); else alert(d.error || 'Upload failed');
    }catch(err){ console.error(err); alert('Upload failed') }
    setUploading(false);
  }

  async function save(e){
    e && e.preventDefault && e.preventDefault();
    try{
      const method = editingId ? 'PUT' : 'POST'
      const url = editingId ? '/api/brands/' + editingId : '/api/brands'
      // ensure slug sanitized before sending
      const payload = { ...form, slug: (form.slug || '').toString().trim().toLowerCase().replace(/[^a-z0-9\-_/]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'') }
      const res = await fetch(url, { method, headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + (token||'') }, body: JSON.stringify(payload) })
      if (res.ok) { setForm({ title:'', slug:'', image:'', link:'', description:'', meta_title:'', meta_description:'', keywords:'', active:true, position:0 }); setSlugEdited(false); setEditingId(null); fetchList(); }
      else { const txt = await res.text(); try{ const d = txt?JSON.parse(txt):null; alert(d?.error||('Error: '+res.status)) }catch{ alert('Error: '+res.status+' '+ (txt||res.statusText)) } }
    }catch(err){ console.error(err); alert('Save failed') }
  }

  async function edit(b){
    setForm({ title:b.title||'', slug:b.slug||'', image:b.image||'', link:b.link||'', description:b.description||'', meta_title: b.meta_title||'', meta_description: b.meta_description||'', keywords: b.keywords||'', active: b.active===1||b.active===true, position: Number(b.position||0) })
    setSlugEdited(Boolean(b.slug))
    setEditingId(b.id)
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function remove(id){ if (!confirm('Delete brand?')) return; const res = await fetch('/api/brands/'+id, { method:'DELETE', headers: { 'Authorization':'Bearer '+(token||'') } }); if (res.ok) fetchList(); else alert('Delete failed') }

  return (
    <div>
      <form onSubmit={save} style={{maxWidth:720,marginBottom:12}}>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Title" value={form.title} onChange={e=>{
            const newTitle = e.target.value
            // generate slug from title
            const gen = (newTitle||'').toString().trim().toLowerCase().replace(/[^a-z0-9\s-]+/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'')
            if (!slugEdited) setForm({...form, title: newTitle, slug: gen})
            else setForm({...form, title: newTitle})
          }} style={{flex:1}} />
          <input placeholder="Slug (auto-generated)" value={form.slug} onChange={e=>{ setForm({...form,slug:e.target.value}); setSlugEdited(true) }} style={{width:260}} />
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <div style={{flex:1}}>
            {form.image ? (<img src={form.image} alt="brand" style={{maxWidth:180,borderRadius:8}}/>) : (<div style={{height:80,background:'#f3f4f6',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>No image</div>)}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <input type="file" accept="image/*" onChange={handleUpload} />
            <button type="button" onClick={()=>setForm({...form,image:''})}>Remove</button>
          </div>
        </div>
        <div style={{marginTop:8}}>
          <textarea placeholder="Short description" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        </div>
        <div style={{marginTop:8}}>
          <input placeholder="Link (https://...)" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} />
        </div>
        <div style={{marginTop:8,display:'grid',gridTemplateColumns:'1fr',gap:8}}>
          <input placeholder="Meta title (SEO)" value={form.meta_title} onChange={e=>setForm({...form,meta_title:e.target.value})} />
          <textarea placeholder="Meta description (SEO)" rows={2} value={form.meta_description} onChange={e=>setForm({...form,meta_description:e.target.value})} />
          <input placeholder="Keywords (comma separated)" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} />
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={Boolean(form.active)} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
          <input type="number" value={Number(form.position||0)} onChange={e=>setForm({...form,position:Number(e.target.value||0)})} style={{width:120}} />
          <div style={{marginLeft:'auto'}}>
            <button type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ title:'', slug:'', image:'', link:'', description:'', meta_title:'', meta_description:'', keywords:'', active:true, position:0 }); setSlugEdited(false) }} style={{marginLeft:8}}>Cancel</button>}
          </div>
        </div>
      </form>

      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
        <h3 style={{margin:0}}>Existing Brands</h3>
        <input placeholder="Search brands..." value={brandSearch} onChange={e=>setBrandSearch(e.target.value)} style={{marginLeft:12}} />
        <label style={{display:'flex',flexDirection:'column',fontSize:12,marginLeft:8}}>From
          <input type="date" value={brandDateFrom} onChange={e=>setBrandDateFrom(e.target.value)} /></label>
        <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
          <input type="date" value={brandDateTo} onChange={e=>setBrandDateTo(e.target.value)} /></label>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>Sort:
            <select value={brandSort} onChange={e=>setBrandSort(e.target.value)} style={{marginLeft:8}}>
              <option value="default">Default</option>
              <option value="views_desc">Most viewed</option>
              <option value="views_asc">Least viewed</option>
            </select>
          </label>
          <label style={{display:'flex',gap:8,alignItems:'center'}}>Min views:
            <input type="number" value={brandMinViews} onChange={e=>setBrandMinViews(Number(e.target.value||0))} style={{width:120,marginLeft:8}} />
          </label>
        </div>
      </div>
      <div style={{marginTop:8,overflowX:'auto'}}>
        {(function(){
          let list = Array.isArray(brands) ? brands.slice() : []
          list = list.filter(x=> Number(x.views||0) >= Number(brandMinViews||0))
          const bs = (brandSearch||'').trim().toLowerCase()
          if (bs) list = list.filter(b=> ((b.title||'') + ' ' + (b.description||'') + ' ' + (b.link||'')).toLowerCase().includes(bs))
          if (brandDateFrom) { const from = new Date(brandDateFrom); list = list.filter(b=> { try{ return new Date(b.created_at) >= from }catch(e){ return true } }) }
          if (brandDateTo) { const to = new Date(brandDateTo); to.setHours(23,59,59,999); list = list.filter(b=> { try{ return new Date(b.created_at) <= to }catch(e){ return true } }) }
          if (brandSort === 'views_desc') list = list.slice().sort((a,b)=> Number(b.views||0) - Number(a.views||0))
          else if (brandSort === 'views_asc') list = list.slice().sort((a,b)=> Number(a.views||0) - Number(b.views||0))
          return (
            <table className="admin-requests-table admin-table" style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={{padding:8}}>Image</th>
                  <th style={{padding:8}}>Title</th>
                  <th style={{padding:8}}>Link</th>
                  <th style={{padding:8}}>Description</th>
                  <th style={{padding:8}}>Views</th>
                  <th style={{padding:8}}>Active</th>
                  <th style={{padding:8}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(b=> (
                  <tr key={b.id}>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.image ? <img src={b.image} alt={b.title} style={{width:84,height:56,objectFit:'cover',borderRadius:6}} /> : <div style={{width:84,height:56,background:'#f3f4f6',borderRadius:6}}/>}</td>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.title}</td>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.link}</td>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.description}</td>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.views || 0}</td>
                    <td style={{padding:8,verticalAlign:'top'}}>{b.active ? 'Yes' : 'No'}</td>
                    <td style={{padding:8,verticalAlign:'top',display:'flex',gap:8}}>
                      <button onClick={()=>edit(b)}>Edit</button>
                      <button onClick={()=>remove(b.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>
    </div>
  )
}

function BrandingStripManager({ token }){
  const [items, setItems] = useState([])
  const [stripSearchLocal, setStripSearchLocal] = useState('')
  const [stripDateFromLocal, setStripDateFromLocal] = useState('')
  const [stripDateToLocal, setStripDateToLocal] = useState('')
  const [form, setForm] = useState({ image:'', link:'', position:0, active:true })
  const fileInputRef = useRef(null)
  // include title, price_text and SEO fields for strip items
  const [formExt, setFormExt] = useState({ title: '', price_text: '', slug: '', h1: '', h2: '', h3: '', meta_description: '', keywords: '' })
  const [slugEditedStrip, setSlugEditedStrip] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(()=>{ fetchList() }, [])
  async function fetchList(){
    try{ const res = await fetch('/api/brand-strip', { headers: { 'Authorization': 'Bearer ' + (token||'') } }); const d = await res.json(); setItems(Array.isArray(d)?d:[]) }catch(e){ console.error(e); setItems([]) }
  }

  async function handleUpload(e){
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    setUploading(true);
    try{
      const rawSlug = (formExt && formExt.slug) ? String(formExt.slug).trim() : '';
      const fromTitle = (formExt && formExt.title) ? String(formExt.title).trim() : '';
      const fromFile = (f.name || '').replace(/\.[^/.]+$/, '');
      const slugSource = rawSlug || fromTitle || fromFile || '';
      let sanitized = slugSource
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9\-]+/g,'-')
        .replace(/^-+|-+$/g,'');
      if (!sanitized) sanitized = 'strip-' + Date.now();
      const extMatch = (f.name || '').match(/\.[a-z0-9]{1,8}$/i);
      const ext = (extMatch ? extMatch[0] : '.jpg').toLowerCase();
      fd.append('filename', sanitized + ext);
      const res = await fetch('/api/upload-rename', { method:'POST', headers: { 'Authorization': 'Bearer ' + (token||'') }, body: fd });
      const d = await res.json();
      if (res.ok && d.url) {
        // cache-bust to force fresh preview
        const urlWithBust = d.url + '?_=' + Date.now();
        setForm(prev=>({ ...prev, image: urlWithBust }));
        // clear the file input so re-selecting same file will trigger change
        try { if (fileInputRef && fileInputRef.current) fileInputRef.current.value = '' } catch(e){}
        if (!rawSlug && sanitized) {
          setFormExt(prev=> ({ ...prev, slug: sanitized }));
        }
      } else {
        alert(d.error || 'Upload failed');
      }
    }catch(err){ console.error(err); alert('Upload failed') }
    setUploading(false);
  }

  async function save(e){ e && e.preventDefault && e.preventDefault(); try{
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? '/api/brand-strip/' + editingId : '/api/brand-strip'
    // sanitize slug
    const rawSlug = (formExt.slug || formExt.title || '').toString().trim()
    const sanitizedSlug = rawSlug.toLowerCase().replace(/[^a-z0-9\-]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'')
    const payload = { ...form, title: formExt.title || '', price_text: (form.link ? 'Check price on Amazon' : (formExt.price_text || '')), slug: sanitizedSlug || '', h1: formExt.h1 || '', h2: formExt.h2 || '', h3: formExt.h3 || '', meta_description: formExt.meta_description || '', keywords: formExt.keywords || '' }
    const res = await fetch(url, { method, headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+(token||'') }, body: JSON.stringify(payload) })
    if (res.ok) { setForm({ image:'', link:'', position:0, active:true }); setFormExt({ title:'', price_text:'', slug:'', h1:'', h2:'', h3:'', meta_description:'', keywords:'' }); setSlugEditedStrip(false); setEditingId(null); fetchList(); }
    else { const txt = await res.text(); try{ const d = txt?JSON.parse(txt):null; alert(d?.error||('Error: '+res.status)) }catch{ alert('Error: '+res.status+' '+ (txt||res.statusText)) } }
  }catch(err){ console.error(err); alert('Save failed') } }

  async function edit(it){ setForm({ image:it.image||'', link:it.link||'', position:Number(it.position||0), active: it.active===1||it.active===true }); setFormExt({ title: it.title || '', price_text: it.price_text || '', slug: it.slug || '', h1: it.h1 || '', h2: it.h2 || '', h3: it.h3 || '', meta_description: it.meta_description || '', keywords: it.keywords || '' }); setSlugEditedStrip(Boolean(it.slug)); setEditingId(it.id) }
  async function remove(id){ if (!confirm('Delete item?')) return; const res = await fetch('/api/brand-strip/'+id, { method:'DELETE', headers: { 'Authorization':'Bearer '+(token||'') } }); if (res.ok) fetchList(); else alert('Delete failed') }

  return (
    <div>
      <form onSubmit={save} style={{maxWidth:720,marginBottom:12}}>
        <div style={{display:'flex',gap:8}}>
          <input placeholder="Link (https://...)" value={form.link} onChange={e=>setForm({...form,link:e.target.value})} style={{flex:1}} />
          <input type="number" value={Number(form.position||0)} onChange={e=>setForm({...form,position:Number(e.target.value||0)})} style={{width:120}} />
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <div style={{flex:1}}>
            {form.image ? (<img src={form.image} alt="strip" style={{maxWidth:180,borderRadius:8}}/>) : (<div style={{height:80,background:'#f3f4f6',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)'}}>No image</div>)}
            <div style={{marginTop:8,display:'grid',gap:6}}>
              <input placeholder="Title (product name)" value={formExt.title} onChange={e=>{
                const newTitle = e.target.value
                const gen = (newTitle||'').toString().trim().toLowerCase().replace(/[^a-z0-9\s-]+/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'')
                setFormExt(prev => ({ ...prev, title: newTitle, slug: (!slugEditedStrip ? gen : prev.slug) }))
              }} />
              <input placeholder="Slug (for SEO) e.g. boat-rockerz-255-pro-plus-review" value={formExt.slug} onChange={e=>{ const v = e.target.value; setSlugEditedStrip(true); setFormExt(prev=>({...prev, slug: v })) }} />
              <div style={{display:'flex',gap:8}}>
                <div style={{flex:1}} />
                <button type="button" onClick={async ()=>{
                  const s = (formExt.slug || formExt.title || '').toString().trim();
                  const gen = s.replace(/^\/+|\/+$/g,'').replace(/[^a-zA-Z0-9\-]+/g,'-').toLowerCase();
                  if(!gen) { alert('Please provide a slug or title to generate image name'); return }
                  const currentImage = (form && form.image) ? String(form.image) : '';
                  const currentName = currentImage.startsWith('/uploads/') ? currentImage.slice('/uploads/'.length) : '';
                  const currentExt = currentName.match(/\.[a-z0-9]{1,8}$/i)?.[0]?.toLowerCase() || '.jpg';
                  const fileName = gen + currentExt;
                  const url = '/uploads/' + fileName;

                  // If an image already exists but has a different name, request backend rename
                  if (currentName && currentName !== fileName) {
                    try{
                      const tokenVal = localStorage.getItem('token') || token || '';
                      const resRename = await fetch('/api/uploads/rename-existing', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + tokenVal, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ current: currentName, desired: fileName })
                      });
                      if (resRename.ok) {
                        const dataRename = await resRename.json().catch(()=>({}));
                        const newUrl = (dataRename && dataRename.url) ? dataRename.url : url;
                        setForm(prev=>({ ...prev, image: newUrl }));
                      } else {
                        const txt = await resRename.text();
                        console.warn('Rename failed', txt);
                      }
                    }catch(err){ console.error('Rename existing upload failed', err); }
                  }

                  const exists = await new Promise(res => {
                    const img = new Image();
                    img.onload = () => res(true);
                    img.onerror = () => res(false);
                    img.src = url + '?_=' + Date.now();
                  });
                  if (exists) {
                    setForm(prev=>({ ...prev, image: url }));
                    return
                  }
                  // if client-side check failed, ask server for uploads list (admin only)
                  try{
                    const tokenVal = localStorage.getItem('token') || token || '';
                    const res = await fetch('/api/uploads-list', { headers: { 'Authorization': 'Bearer ' + tokenVal } });
                    if (!res.ok) {
                      alert('Image not found on server at ' + url + '. Please upload an image or use the uploader.');
                      return
                    }
                    const d = await res.json();
                    const have = Array.isArray(d.files) && d.files.includes(fileName);
                    if (have) {
                      alert('File exists on server but dev-server proxy returned 404. Try opening http://localhost:4000' + url + ' to verify directly.');
                    } else {
                      const sample = Array.isArray(d.files) ? d.files.slice(0,12).join('\n') : 'no files';
                      alert('Image not found. Uploads folder does not contain ' + fileName + '.\nSample files:\n' + sample + '\n\nPlease upload using the uploader (set slug first so file will be saved as ' + fileName + ').');
                    }
                  }catch(e){ console.error(e); alert('Image not found on server at ' + url + '. Please upload an image or use the uploader.'); }
                }}>Auto-fill image from slug</button>
              </div>
              <input placeholder="H1 (optional)" value={formExt.h1} onChange={e=>setFormExt({...formExt,h1:e.target.value})} />
              <input placeholder="H2 (optional)" value={formExt.h2} onChange={e=>setFormExt({...formExt,h2:e.target.value})} />
              <input placeholder="H3 (optional)" value={formExt.h3} onChange={e=>setFormExt({...formExt,h3:e.target.value})} />
              <input placeholder="Meta description (SEO)" value={formExt.meta_description} onChange={e=>setFormExt({...formExt,meta_description:e.target.value})} />
              <input placeholder="Keywords (comma separated)" value={formExt.keywords} onChange={e=>setFormExt({...formExt,keywords:e.target.value})} />
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} />
            <button type="button" onClick={()=>{ setForm({...form,image:''}); try { if (fileInputRef && fileInputRef.current) fileInputRef.current.value = '' }catch(e){} }}>Remove</button>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
          <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={Boolean(form.active)} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label>
          <div style={{marginLeft:'auto'}}>
            <button type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && <button type="button" onClick={()=>{ setEditingId(null); setForm({ image:'', link:'', position:0, active:true }); setFormExt({ title:'', price_text:'', slug:'', h1:'', h2:'', h3:'', meta_title:'', meta_description:'', keywords:'' }); setSlugEditedStrip(false) }} style={{marginLeft:8}}>Cancel</button>}
          </div>
        </div>
      </form>

      <h3>Strip Items</h3>
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
        <input placeholder="Search strips..." value={stripSearchLocal} onChange={e=>setStripSearchLocal(e.target.value)} style={{flex:1}} />
        <label style={{display:'flex',flexDirection:'column',fontSize:12}}>From
          <input type="date" value={stripDateFromLocal} onChange={e=>setStripDateFromLocal(e.target.value)} /></label>
        <label style={{display:'flex',flexDirection:'column',fontSize:12}}>To
          <input type="date" value={stripDateToLocal} onChange={e=>setStripDateToLocal(e.target.value)} /></label>
      </div>
      <div style={{display:'grid',gap:10,marginTop:8}}>
        {(items||[]).filter(i=>{
          const s = (stripSearchLocal||'').trim().toLowerCase(); if (s) { const hay = ((i.link||'') + ' ' + (i.image||'')).toLowerCase(); if (!hay.includes(s)) return false }
          if (stripDateFromLocal) { try{ if (new Date(i.created_at) < new Date(stripDateFromLocal)) return false }catch(e){} }
          if (stripDateToLocal) { try{ const to = new Date(stripDateToLocal); to.setHours(23,59,59,999); if (new Date(i.created_at) > to) return false }catch(e){} }
          return true
        }).map(i=> (
          <div key={i.id} className="request-card" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              {i.image ? <a href={i.link||'#'} target="_blank" rel="noopener noreferrer"><img src={i.image} alt="item" style={{width:84,height:56,objectFit:'cover',borderRadius:6}} /></a> : <div style={{width:84,height:56,background:'#f3f4f6',borderRadius:6}}/>}
              <div>
                <div style={{fontWeight:700}}><a href={i.link||'#'} target="_blank" rel="noopener noreferrer" style={{color:'inherit',textDecoration:'none'}}>{i.title || 'Untitled'}</a></div>
                <div className="muted" style={{fontSize:13}}>{i.link}</div>
                <div style={{marginTop:6}}><a className="button-link" href={i.link||'#'} target="_blank" rel="nofollow noopener noreferrer">Check price on Amazon</a></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>edit(i)}>Edit</button>
              <button onClick={()=>remove(i.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
