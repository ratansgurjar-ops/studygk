import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'

export default function Request(){
  const [form, setForm] = useState({name:'', mobile:'', title:'', description:'', image:''})
  const [meta, setMeta] = useState({title:'Request Free Feature', description:''})
  const [loading, setLoading] = useState(false)

  async function handleFileChange(e){
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('file', f);
    setLoading(true)
    try{
      const res = await fetch('/api/upload-public', { method: 'POST', body: fd })
      const d = await res.json().catch(()=>null)
      if (!res.ok) { alert(d && d.error ? d.error : 'Upload failed'); setLoading(false); return }
      setForm(prev => ({ ...prev, image: d.url || '' }))
    }catch(err){ console.error(err); alert('Upload failed') }
    setLoading(false)
  }

  useEffect(()=>{
    fetch('/api/public-settings').then(r=>r.json()).then(s=>{
      setMeta({ title: s.request_meta_title || 'Request Free Feature', description: s.request_meta_description || '' })
    }).catch(()=>{})
  },[])

  async function submit(e){
    e.preventDefault()
    setLoading(true)
    try{
      const res = await fetch('/api/brand-requests', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(form) })
      const d = await res.json().catch(()=>null)
      if (!res.ok) { alert(d && d.error ? d.error : 'Submit failed'); setLoading(false); return }
      alert('Request submitted — thank you')
      setForm({name:'',mobile:'',title:'',description:'', image:''})
    }catch(e){ alert('Submit failed') }
    setLoading(false)
  }

  return (
    <div style={{maxWidth:880,margin:'18px auto',padding:'0 18px'}}>
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={(typeof window !== 'undefined' ? window.location.origin : '') + '/request'} />
      </Helmet>
      <h2>{meta.title}</h2>
      {meta.description && <p className="muted">{meta.description}</p>}
      <form onSubmit={submit} style={{marginTop:12}}>
        <div><label className="field-label">Full name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
        <div><label className="field-label">WhatsApp number</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} required/></div>
        <div><label className="field-label">Title</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Short title for your request"/></div>
        <div><label className="field-label">Description</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required rows={6}/></div>
        <div style={{marginTop:8}}>
          <label className="field-label">Image (optional)</label>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <input value={form.image} onChange={e=>setForm({...form,image:e.target.value})} placeholder="Or paste image URL" style={{flex:1}}/>
          </div>
          {form.image && <div style={{marginTop:8}}><img src={form.image} alt="preview" style={{maxWidth:240,borderRadius:6}}/></div>}
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
          <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</button>
        </div>
      </form>
    </div>
  )
}
