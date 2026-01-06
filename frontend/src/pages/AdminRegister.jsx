import React, { useState } from 'react'

export default function AdminRegister(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [question, setQuestion] = useState('What is your favorite color?')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  async function submit(e){
    e.preventDefault()
    setNotice('')
    if (!email || !password || !answer) return setNotice('Please fill required fields')
    if (password !== confirm) return setNotice('Passwords do not match')
    setLoading(true)
    try{
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, secret_question: question, secret_answer: answer })
      })
      const d = await res.json()
      if (!res.ok) return setNotice(d && d.error ? d.error : 'Registration failed')
      setNotice('Registered successfully — please login at /ratan')
      setEmail('')
      setPassword('')
      setConfirm('')
      setAnswer('')
      try{ window.history.pushState({},'', '/ratan'); window.dispatchEvent(new PopStateEvent('popstate')) }catch(e){}
    }catch(err){
      console.error(err)
      setNotice('Registration failed')
    }finally{ setLoading(false) }
  }

  return (
    <div style={{maxWidth:720,margin:'24px auto',padding:18}}>
      <h2>Admin Register</h2>
      <p>Create the single admin account for the site. Only one admin account is allowed.</p>
      <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:8}}>
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com" />
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" />
        <label>Confirm Password</label>
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirm password" />
        <label>Secret question</label>
        <input value={question} onChange={e=>setQuestion(e.target.value)} />
        <label>Secret answer (used to reset password)</label>
        <input value={answer} onChange={e=>setAnswer(e.target.value)} />
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button disabled={loading} style={{padding:'8px 12px'}} type="submit">{loading? 'Creating...' : 'Create Admin'}</button>
        </div>
        {notice && <div className="muted" style={{marginTop:8}}>{notice}</div>}
      </form>
    </div>
  )
}
