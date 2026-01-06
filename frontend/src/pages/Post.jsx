import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import EngagementControls from '../components/EngagementControls'
import CommentEngagementControls from '../components/CommentEngagementControls'

function stripHtml(html){
	if (!html) return ''
	const d = typeof document !== 'undefined' ? document.createElement('div') : null
	if (d) { d.innerHTML = html; return d.textContent || d.innerText || '' }
	return html.replace(/<[^>]*>/g, '')
}

export default function Post({ slug }){
	const [post, setPost] = useState(null)
	const [amazonTag, setAmazonTag] = useState('')
	const [amazonEnabled, setAmazonEnabled] = useState(false)
	const [comments, setComments] = useState([])
	const [commentsLoading, setCommentsLoading] = useState(false)
	const [commentForm, setCommentForm] = useState({ name: '', email: '', content: '' })
	const [commentImageFile, setCommentImageFile] = useState(null)
	const [commentImagePreview, setCommentImagePreview] = useState('')
	const [commentImageUploading, setCommentImageUploading] = useState(false)
	const [commentImageUrl, setCommentImageUrl] = useState('')
	const [commentFeedback, setCommentFeedback] = useState('')
	const [commentError, setCommentError] = useState('')
	const [commentSubmitting, setCommentSubmitting] = useState(false)
	const [commentCount, setCommentCount] = useState(0)
	const [commentsOpen, setCommentsOpen] = useState(false)
	const [replyingTo, setReplyingTo] = useState(null)
	const [collapsedThreads, setCollapsedThreads] = useState({})
	const [highlightedCommentKey, setHighlightedCommentKey] = useState('')
	const commentFormRef = useRef(null)

	useEffect(()=>{
		fetch('/api/public-settings').then(r=>r.json()).then(s=>{
			setAmazonTag(s.amazon_affiliate_tag || '')
			setAmazonEnabled(!!s.amazon_affiliate_enabled)
		}).catch(()=>{})

		if (!slug) return
		try{
			if (typeof window !== 'undefined' && window.__SSR_BLOG && (String(window.__SSR_BLOG.slug) === String(slug) || String(window.__SSR_BLOG.id) === String(slug))) {
				setPost(window.__SSR_BLOG)
				try{ delete window.__SSR_BLOG }catch(e){}
				return
			}
		}catch(e){}
		let cancelled = false
		const load = async ()=>{
			try{
				const r1 = await fetch('/api/blogs/slug/' + encodeURIComponent(slug))
				const d1 = await r1.json().catch(()=>null)
				if (r1.ok && d1 && !d1.error) {
					if (!cancelled) {
						setPost(d1)
						try {
							const url = '/api/hit/blog/' + encodeURIComponent(d1.id)
							if (navigator && navigator.sendBeacon) {
								try { navigator.sendBeacon(url) } catch (e) {}
							} else {
								fetch(url, { method: 'POST', keepalive: true }).catch(()=>{})
							}
						} catch (e) {
							console.warn('blog view tracking failed', e)
						}
					}
					return
				}

				if (/^\d+$/.test(String(slug))) {
					const r2 = await fetch('/api/blogs/' + encodeURIComponent(slug))
					const d2 = await r2.json().catch(()=>null)
					if (r2.ok && d2 && !d2.error) { if (!cancelled) setPost(d2); return }
				}
				if (!cancelled) setPost(null)
			}catch(e){
				if (!cancelled) setPost(null)
			}
		}
		load()
		return ()=>{ cancelled = true }
	},[slug])

	useEffect(()=>{
		setCommentCount(Number(post?.comments_count || 0))
	}, [post?.comments_count])

	useEffect(()=>{
		setReplyingTo(null)
		setCollapsedThreads({})
		setCommentsOpen(false)
	}, [post?.id])

	useEffect(()=>{
		if (!post || !post.id) {
			setComments([])
			setCommentCount(0)
			return
		}
		let cancelled = false
		const loadComments = async ()=>{
			setCommentsLoading(true)
			try{
				const res = await fetch('/api/blogs/' + encodeURIComponent(post.id) + '/comments')
				if (!res.ok) throw new Error('Failed to load comments')
				const data = await res.json().catch(()=>[])
				if (!cancelled) {
					const list = Array.isArray(data) ? data : []
					setComments(list)
					setCommentCount(list.length)
				}
			}catch(err){
				if (!cancelled) {
					setComments([])
					setCommentCount(Number(post.comments_count || 0))
				}
			}finally{
				if (!cancelled) setCommentsLoading(false)
			}
		}
		loadComments()
		return ()=>{ cancelled = true }
	}, [post?.id, post?.comments_count])

	function decorateLinksLocal(html){
		if (!html) return ''
		if (typeof window === 'undefined' || typeof document === 'undefined') return html
		try{
			const parser = new DOMParser()
			const doc = parser.parseFromString(String(html), 'text/html')
			const anchors = Array.from(doc.querySelectorAll('a[href]'))
			for (const a of anchors) {
				const href = a.getAttribute('href') || ''
				if (/^https?:\/\//i.test(href)) {
					const isSameOrigin = href.startsWith(window.location.origin)
					if (!isSameOrigin) {
						a.setAttribute('target', '_blank')
						const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean)
						for (const v of ['noopener','noreferrer']) if (!rel.includes(v)) rel.push(v)
						try{
							if (amazonEnabled && amazonTag && /amazon\./i.test(href)){
								const url = new URL(href, window.location.origin)
								if (!url.searchParams.get('tag')) url.searchParams.set('tag', amazonTag)
								a.setAttribute('href', url.toString())
								if (!rel.includes('nofollow')) rel.push('nofollow')
							}
						}catch(e){}
						a.setAttribute('rel', rel.join(' '))
					}
				}
			}
			return doc.body.innerHTML
		}catch(e){
			return html
		}
	}

	const handleCommentInput = (field) => (event) => {
		const value = event?.target ? event.target.value : event
		setCommentForm(prev => ({ ...prev, [field]: value }))
	}

	const uploadImageFile = async (file) => {
		if (!file) return ''
		setCommentImageUploading(true)
		try{
			const fd = new FormData()
			fd.append('file', file)
			const res = await fetch('/api/upload-public', { method: 'POST', body: fd })
			const data = await res.json().catch(()=>null)
			if (!res.ok) throw new Error((data && data.error) ? data.error : 'Upload failed')
			return (data && data.url) ? data.url : ''
		}catch(err){
			console.error('image upload failed', err)
			return ''
		}finally{
			setCommentImageUploading(false)
		}
	}

	const handleImageChange = async (ev) => {
		const file = ev && ev.target && ev.target.files && ev.target.files[0] ? ev.target.files[0] : null
		if (!file) return
		// local preview
		try{
			const url = URL.createObjectURL(file)
			setCommentImageFile(file)
			setCommentImagePreview(url)
			// upload immediately
			const uploaded = await uploadImageFile(file)
			if (uploaded) setCommentImageUrl(uploaded)
		}catch(e){
			console.error(e)
		}
	}

	const threadedData = useMemo(() => {
		const list = Array.isArray(comments) ? comments : []
		const nodes = list.map(comment => {
			const idNumeric = Number(comment?.id)
			const normalizedId = Number.isInteger(idNumeric) && idNumeric > 0 ? idNumeric : comment?.id
			const parentNumeric = Number(comment?.parent_comment_id)
			const normalizedParent = Number.isInteger(parentNumeric) && parentNumeric > 0 ? parentNumeric : null
			return {
				...comment,
				id: normalizedId,
				parent_comment_id: normalizedParent,
				_idKey: normalizedId !== undefined && normalizedId !== null ? String(normalizedId) : String(comment?.id || ''),
				_parentKey: normalizedParent ? String(normalizedParent) : '',
				children: []
			}
		})

		const map = new Map()
		nodes.forEach(node => {
			if (node && node._idKey) {
				map.set(node._idKey, node)
			}
		})

		const roots = []
		nodes.forEach(node => {
			const parentKey = node._parentKey
			if (parentKey && map.has(parentKey) && parentKey !== node._idKey) {
				const parentNode = map.get(parentKey)
				if (parentNode) parentNode.children.push(node)
			} else {
				roots.push(node)
			}
		})

		const toTime = (value) => {
			if (!value) return 0
			const result = new Date(value).getTime()
			return Number.isFinite(result) ? result : 0
		}

		const sortNodes = (items) => {
			items.sort((a, b) => {
				const diff = toTime(a.created_at) - toTime(b.created_at)
				if (diff !== 0) return diff
				const idA = Number(a.id) || 0
				const idB = Number(b.id) || 0
				return idA - idB
			})
			items.forEach(child => {
				if (child.children && child.children.length) sortNodes(child.children)
			})
		}

		sortNodes(roots)
		return { roots, map }
	}, [comments])

	const threadedComments = threadedData.roots
	const commentMap = threadedData.map

	useEffect(() => {
		if (!(commentMap instanceof Map)) return
		const validKeys = new Set(Array.from(commentMap.keys()))
		setCollapsedThreads(prev => {
			let changed = false
			const next = {}
			for (const key in prev) {
				if (Object.prototype.hasOwnProperty.call(prev, key) && validKeys.has(key)) {
					next[key] = prev[key]
				} else {
					changed = true
				}
			}
			return changed ? next : prev
		})
	}, [commentMap])

	useEffect(() => {
		if (!highlightedCommentKey) return
		if (!(commentMap instanceof Map)) return
		if (!commentMap.has(highlightedCommentKey)) {
			setHighlightedCommentKey('')
		}
	}, [commentMap, highlightedCommentKey])

	const submitComment = async (event) => {
		event.preventDefault()
		if (!post || !post.id) return
		setCommentError('')
		setCommentFeedback('')
		const contentTrimmed = (commentForm.content || '').trim()
		if (!contentTrimmed) {
			setCommentError('Please enter a comment.')
			return
		}
		const nameTrimmed = (commentForm.name || '').trim()
		if (!nameTrimmed) {
			setCommentError('Please enter your name.')
			return
		}
		const payload = {
			author_name: nameTrimmed,
			author_email: (commentForm.email || '').trim(),
			content: contentTrimmed
		}
		if (commentImageUrl) payload.image = commentImageUrl
		if (replyingTo && replyingTo.id) {
			const parentNumeric = Number(replyingTo.id)
			if (Number.isInteger(parentNumeric) && parentNumeric > 0) {
				payload.parent_comment_id = parentNumeric
			}
		}
		setCommentSubmitting(true)
		try{
			const res = await fetch('/api/blogs/' + encodeURIComponent(post.id) + '/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
			const data = await res.json().catch(()=>null)
			if (!res.ok) {
				setCommentError((data && data.error) ? data.error : 'Failed to submit comment.')
				return
			}
			setCommentFeedback((data && data.message) ? data.message : 'Comment submitted for review.')
			setCommentForm({ name: '', email: '', content: '' })
			setCommentImageFile(null)
			setCommentImagePreview('')
			setCommentImageUrl('')
			setReplyingTo(null)
			setCommentCount(prev => Number(prev || 0) + 1)
		}catch(err){
			console.error('comment submit failed', err)
			setCommentError('Failed to submit comment.')
		}finally{
			setCommentSubmitting(false)
		}
	}

	const scrollToComments = () => {
		setCommentsOpen(true)
		if (typeof document === 'undefined') return
		const scroll = () => {
			const el = document.getElementById('comments-section')
			if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
			if (!replyingTo && commentFormRef && commentFormRef.current && commentFormRef.current.querySelector) {
				const textArea = commentFormRef.current.querySelector('textarea')
				if (textArea && typeof textArea.focus === 'function') {
					textArea.focus()
				}
			}
		}
		if (commentsOpen) {
			scroll()
		} else {
			setTimeout(scroll, 140)
		}
	}

	const beginReply = (target) => {
		if (!target || !target.id) return
		const numericId = Number(target.id)
		const replyId = Number.isInteger(numericId) && numericId > 0 ? numericId : target.id
		setCommentsOpen(true)
		setReplyingTo({ id: replyId, author_name: target.author_name || 'Anonymous' })
		setCommentError('')
		setCommentFeedback('')
		setTimeout(() => {
			if (typeof document === 'undefined') return
			const selector = `#comment-${replyId} textarea[data-reply-textarea="true"]`
			const field = document.querySelector(selector)
			if (field && typeof field.focus === 'function') {
				field.focus()
			}
		}, 160)
	}

	useEffect(() => {
		if (typeof window === 'undefined') return
		if (!(commentMap instanceof Map)) return
		let timerId
		const handleHashTarget = () => {
			const hash = window.location.hash || ''
			if (!hash.startsWith('#comment-')) return
			const rawId = hash.slice('#comment-'.length).trim()
			if (!rawId) return
			const candidates = [rawId]
			const numericCandidate = Number(rawId)
			if (Number.isInteger(numericCandidate) && numericCandidate > 0) {
				candidates.push(String(numericCandidate))
			}
			let key = ''
			for (const candidate of candidates) {
				if (commentMap.has(candidate)) {
					key = candidate
					break
				}
			}
			if (!key) return
			const node = commentMap.get(key)
			if (!node) return

			setCommentsOpen(true)
			setCollapsedThreads(prev => {
				let updated = prev
				let changed = false
				let current = node
				while (current && current._parentKey) {
					const parentKey = current._parentKey
					if (updated[parentKey]) {
						if (!changed) updated = { ...updated }
						updated[parentKey] = false
						changed = true
					}
					current = commentMap.get(parentKey)
				}
				return changed ? updated : prev
			})

			const highlightKey = node._idKey || key
			setHighlightedCommentKey(highlightKey)
			if (timerId) clearTimeout(timerId)
			timerId = setTimeout(() => {
				setHighlightedCommentKey(current => (current === highlightKey ? '' : current))
			}, 4000)
			setTimeout(() => {
				const el = document.getElementById(`comment-${node.id}`)
				if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
			}, 140)
		}

		handleHashTarget()
		window.addEventListener('hashchange', handleHashTarget)
		return () => {
			window.removeEventListener('hashchange', handleHashTarget)
			if (timerId) clearTimeout(timerId)
		}
	}, [commentMap])

	useEffect(() => {
		if (!replyingTo || !replyingTo.id) return
		if (!(commentMap instanceof Map)) return
		const key = String(replyingTo.id)
		if (!commentMap.has(key)) {
			setReplyingTo(null)
		}
	}, [commentMap, replyingTo])

	const formatCommentBody = (text) => {
		if (!text) return ''
		return String(text).replace(/\n/g, '<br />')
	}

	const toggleReplies = (commentId) => {
		if (commentId === null || commentId === undefined) return
		const key = String(commentId)
		setCollapsedThreads(prev => ({ ...prev, [key]: !prev[key] }))
	}

	const renderComposer = ({ inline = false, parentId = null, offset = 0 } = {}) => {
		if (inline) {
			if (!replyingTo || String(replyingTo.id) !== String(parentId)) return null
		} else if (replyingTo) {
			return null
		}

		const wrapperStyle = inline ? { marginLeft: offset, marginTop: 12 } : { marginTop: comments.length ? 6 : 8 }
		const formStyle = {
			display: 'flex',
			flexDirection: 'column',
			gap: 8,
			background: inline ? '#f3f4f6' : '#f9fafb',
			padding: inline ? 10 : 10,
			borderRadius: 12,
			border: '1px solid #e5e7eb'
		}
		const buttonRowStyle = {
			display: 'flex',
			alignItems: 'center',
			gap: 8,
			flexWrap: 'wrap',
			justifyContent: inline ? 'flex-end' : 'flex-start'
		}
		const submitLabel = commentSubmitting ? 'Posting...' : (inline ? 'Post reply' : 'Post comment')

		const cancelInline = inline ? (
			<button
				type="button"
				onClick={() => {
					setReplyingTo(null)
					setCommentError('')
					setCommentImageFile(null)
					setCommentImagePreview('')
					setCommentImageUrl('')
					setTimeout(() => {
						if (commentFormRef && commentFormRef.current && commentFormRef.current.querySelector) {
							const textArea = commentFormRef.current.querySelector('textarea')
							if (textArea && typeof textArea.focus === 'function') {
								textArea.focus()
							}
						}
					}, 120)
				}}
				style={{
					border: 'none',
					background: 'none',
					color: '#6b7280',
					cursor: 'pointer',
					fontSize: 13,
					padding: 0
				}}
			>
				Cancel
			</button>
		) : null

		return (
			<div style={wrapperStyle}>
				<form
					ref={inline ? null : commentFormRef}
					onSubmit={submitComment}
					style={formStyle}
				>
					<textarea
						value={commentForm.content}
						onChange={handleCommentInput('content')}
						placeholder={inline ? 'Write a reply...' : 'Write a comment...'}
						rows={3}
						required
						data-reply-textarea={inline ? 'true' : undefined}
						style={{
							padding: '8px 10px',
							borderRadius: 10,
							border: '1px solid #d1d5db',
							resize: 'vertical',
							fontSize: 13,
							lineHeight: 1.4,
							background: '#fff'
						}}
					/>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
						<div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 200px' }}>
							<label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Name</label>
							<input
								type="text"
								value={commentForm.name}
								onChange={handleCommentInput('name')}
								placeholder="Name"
								required
								style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize:13 }}
							/>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 200px' }}>
							<label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Email</label>
							<input
								type="email"
								value={commentForm.email}
								onChange={handleCommentInput('email')}
								placeholder="Email (optional)"
								style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize:13 }}
							/>
						</div>

						<div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
							<label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Image (optional)</label>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
								<input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
								<span style={{ padding: '8px 10px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 13, color: '#374151' }}>{commentImageUploading ? 'Uploading…' : (commentImagePreview ? 'Change image' : 'Add image')}</span>
							</label>
						</div>
					</div>
					{commentImagePreview && (
						<div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
							<img src={commentImagePreview} alt="preview" style={{ width: 88, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
							<button type="button" onClick={() => { setCommentImageFile(null); setCommentImagePreview(''); setCommentImageUrl('') }} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}>Remove</button>
						</div>
					)}

					<div style={{ marginTop: 8 }}>
						<div style={{ color: '#16a34a', fontSize: 12, lineHeight: 1.3 }}>
							हिन्दी: कृपया ध्यान दें — अपमानजनक, धमकीपूर्ण, अश्लील, जातिवाद-प्रेरित/नफ़रत फैलाने वाले या भारत के कानूनों के अंतर्गत अवैध माने जाने वाले शब्द या सूचनाएँ लिखना मना है; ऐसी टिप्पणियाँ हटा दी जाएँगी और टिप्पणीकर्ता कानूनी रूप से उत्तरदायी ठहराया जा सकता है।
						</div>
						<div style={{ color: '#16a34a', fontSize: 12, lineHeight: 1.3, marginTop: 4 }}>
							English: Please note — posting abusive, threatening, obscene, racist/hate speech, or content illegal under Indian law is prohibited; such comments will be deleted and the poster may be held legally responsible.
						</div>
					</div>
					<div style={buttonRowStyle}>
						{cancelInline}
						<button
							type="submit"
							disabled={commentSubmitting}
							style={{
								padding: '10px 20px',
								borderRadius: 999,
								border: 'none',
								background: '#2563eb',
								color: '#fff',
								fontWeight: 600,
								fontSize: 14,
								cursor: commentSubmitting ? 'default' : 'pointer',
								opacity: commentSubmitting ? 0.7 : 1
							}}
						>
							{submitLabel}
						</button>
					</div>
					{commentError && (
						<div style={{ color: '#dc2626', fontSize: 13 }}>{commentError}</div>
					)}
				</form>
			</div>
			)
	}

	const renderCommentNode = (node, depth = 0) => {
		if (!node) return null
		const commentKey = node._idKey || String(node.id || '')
		const commentId = node.id
		if (!commentKey || commentId === undefined || commentId === null) return null
		const isCollapsed = !!collapsedThreads[commentKey]
		const hasChildren = Array.isArray(node.children) && node.children.length > 0
		const parentNode = node._parentKey ? commentMap.get(node._parentKey) : null
		const isHighlighted = highlightedCommentKey !== '' && commentKey === highlightedCommentKey
		const indent = depth > 0 ? Math.min(depth * 20, 80) : 0
		const bubbleBackground = isHighlighted ? 'rgba(37, 99, 235, 0.12)' : '#f3f4f6'
		const bubbleOutline = isHighlighted ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none'
		const authorSource = node.author_name && node.author_name.trim() ? node.author_name.trim() : 'Anonymous'
		const initial = authorSource.charAt(0).toUpperCase()

		return (
			<div key={commentKey} style={{ marginLeft: indent, paddingBottom: depth === 0 ? 18 : 14 }}>
				<div id={`comment-${commentId}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
					<div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e5e7eb', color: '#111827', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
						{initial || 'A'}
					</div>
					<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
						<div style={{ background: bubbleBackground, borderRadius: 16, padding: '10px 12px', boxShadow: bubbleOutline }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: node.content ? 6 : 0 }}>
								<span style={{ fontWeight: 600, color: '#111827' }}>{authorSource}</span>
								{node.created_at && (
									<span style={{ fontSize: 12, color: '#6b7280' }}>{new Date(node.created_at).toLocaleString()}</span>
								)}
								{parentNode && (
									<span style={{ fontSize: 12, color: '#6b7280' }}>
										Replying to{' '}
										<a href={`#comment-${parentNode.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
											{parentNode.author_name || 'Anonymous'}
										</a>
									</span>
								)}
							</div>
							{node.content && (
								<div style={{ fontSize: 13, lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: formatCommentBody(node.content) }} />
							)}
							{node.image && (
								(() => {
									const src = (node.image || '').toString()
									const full = src.startsWith('http') ? src : ((typeof window !== 'undefined' ? window.location.origin : '') + src)
									return (
										<div style={{ marginTop: 8 }}>
											<img src={full} alt="comment image" style={{ maxWidth: 320, width: '100%', borderRadius: 10, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
										</div>
									)
								})()
							)}
						</div>
						<div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 6, flexWrap: 'wrap' }}>
							<CommentEngagementControls
								commentId={commentId}
								upVotes={node.up_votes}
								downVotes={node.down_votes}
								onReply={() => beginReply(node)}
							/>
							{hasChildren && (
								<button
									type="button"
									onClick={() => toggleReplies(commentId)}
									style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 12, padding: 0 }}
								>
									{isCollapsed ? `Show ${node.children.length} ${node.children.length === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
								</button>
							)}
						</div>
					</div>
				</div>
				{renderComposer({ inline: true, parentId: commentId, offset: indent + 46 })}
				{hasChildren && !isCollapsed && (
					<div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
						{node.children.map(child => renderCommentNode(child, depth + 1))}
					</div>
				)}
			</div>
		)
	}

	if (!post) return <div style={{padding:20}}>Loading...</div>

	const url = (typeof window !== 'undefined' ? window.location.origin : '') + '/posts/' + (post.slug || post.id)
	const title = post.meta_title || post.title
	const desc = post.meta_description || (stripHtml(post.content||'').slice(0,160))

	const imageUrl = post.featured_image ? (post.featured_image.startsWith('http') ? post.featured_image : (typeof window !== 'undefined' ? window.location.origin : '') + post.featured_image) : null

	const ld = {
		"@context": "https://schema.org",
		"@type": "Article",
		"headline": post.title,
		"description": desc,
		"author": { "@type": "Person", "name": post.author || 'StudyGK' },
		"datePublished": post.created_at,
		"dateModified": post.updated_at || post.created_at,
		"mainEntityOfPage": { "@type": "WebPage", "@id": url },
		...(imageUrl ? { "image": [imageUrl] } : {}),
		"publisher": { "@type": "Organization", "name": "StudyGKHub" }
	}

	return (
		<div>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={desc} />
				<meta name="keywords" content={post.keywords || ''} />
				<link rel="canonical" href={url} />

				{/* Open Graph */}
				<meta property="og:type" content="article" />
				<meta property="og:title" content={title} />
				<meta property="og:description" content={desc} />
				<meta property="og:url" content={url} />
				<meta property="og:site_name" content="StudyGKHub" />
				{imageUrl && <meta property="og:image" content={imageUrl} />}
				{imageUrl && <meta property="og:image:secure_url" content={imageUrl} />}
				{imageUrl && <meta property="og:image:alt" content={post.title || 'Post image'} />}

				{/* Twitter image */}
				{imageUrl && <meta name="twitter:image" content={imageUrl} />}
				{imageUrl && <meta name="twitter:image:alt" content={post.title || 'Post image'} />}

				{/* Twitter */}
				<meta name="twitter:card" content={imageUrl ? 'summary_large_image' : 'summary'} />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={desc} />
			</Helmet>

			<article className="post-page" style={{background:'#fff',padding:20,borderRadius:8}}>
				{post.featured_image && (
					<img
						src={post.featured_image}
						alt={post.title || 'Post image'}
						style={{width:'100%',maxHeight:420,objectFit:'cover',objectPosition:'center',borderRadius:12,marginBottom:14,display:'block'}}
						loading="eager"
						decoding="async"
					/>
				)}
				<h1 style={{marginTop:0}}>{post.title}</h1>
				<div style={{color:'#666',marginBottom:12}}>{post.author || 'Admin'} — {new Date(post.created_at).toLocaleDateString()}</div>
				<div dangerouslySetInnerHTML={{__html: decorateLinksLocal(post.content || '')}} />
				<div style={{marginTop:20,paddingTop:16,borderTop:'1px solid #e5e7eb'}}>
					<EngagementControls
						id={post.id}
						slug={post.slug}
						title={post.title}
						upVotes={post.up_votes}
						downVotes={post.down_votes}
						commentsCount={commentCount}
						onComment={scrollToComments}
					/>
				</div>
				<div id="comments-section" style={{marginTop:24}}>
					<button
						type="button"
						onClick={() => setCommentsOpen(prev => {
							const next = !prev
							if (!next) {
								setReplyingTo(null)
								setCommentError('')
							}
							return next
						})}
						aria-expanded={commentsOpen}
						style={{
							width: '100%',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							background: 'none',
							border: 'none',
							padding: '10px 0',
							cursor: 'pointer',
							fontSize: 15,
							fontWeight: 600,
							color: '#111827'
						}}
					>
						<span>{commentsOpen ? 'Hide comments' : 'Show comments'}</span>
						<span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: '#4b5563' }}>
							<span>({commentCount})</span>
							<span>{commentsOpen ? 'v' : '>'}</span>
						</span>
					</button>
					{commentsOpen && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 12 }}>
							{commentsLoading && <div style={{ color: '#666' }}>Loading comments...</div>}
							{!commentsLoading && comments.length === 0 && (
								<div style={{ color: '#6b7280', fontSize: 14 }}>Be the first to start the conversation.</div>
							)}
							{!commentsLoading && comments.length > 0 && (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
									{threadedComments.map(node => renderCommentNode(node, 0))}
								</div>
							)}
							{commentFeedback && !replyingTo && (
								<div style={{ color: '#16a34a', fontSize: 13 }}>{commentFeedback}</div>
							)}
							{renderComposer({ inline: false })}
						</div>
					)}
				</div>
			</article>

			<script type="application/ld+json">
				{JSON.stringify(ld)}
			</script>
		</div>
	)
}
