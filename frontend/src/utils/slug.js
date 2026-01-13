// Shared slug/path normalizers used by Admin + DynamicPage + Router

export function normalizeSlugPath(value) {
  if (value === undefined || value === null) return ''
  let slug = String(value).trim()
  if (!slug) return ''

  // Drop protocol and protocol-relative prefixes
  slug = slug.replace(/^[a-z]+:\/\//i, '')
  slug = slug.replace(/^\/\//, '')

  // If it looks like a full URL with host, keep only the path
  const firstSlash = slug.indexOf('/')
  if (firstSlash >= 0) {
    const hostCandidate = slug.slice(0, firstSlash)
    if (/^[A-Za-z0-9.-]+(?::\d+)?$/.test(hostCandidate)) {
      slug = slug.slice(firstSlash + 1)
    }
  } else if (/^[A-Za-z0-9.-]+(?::\d+)?$/.test(slug) && (slug.indexOf('.') !== -1 || slug.indexOf(':') !== -1)) {
    // Host only (no path) — treat as host only only when it looks like a domain (contains a dot or port)
    slug = ''
  }

  // Strip fragment/query
  const hashIndex = slug.indexOf('#')
  if (hashIndex >= 0) slug = slug.slice(0, hashIndex)
  const queryIndex = slug.indexOf('?')
  if (queryIndex >= 0) slug = slug.slice(0, queryIndex)

  // Normalise slashes and whitespace
  slug = slug.replace(/\\+/g, '/')
  slug = slug.replace(/^\.+/, '')
  slug = slug.replace(/\s+/g, '-')

  // Prevent traversal-ish segments
  while (slug.includes('../')) slug = slug.replace('../', '/')
  while (slug.includes('/./')) slug = slug.replace('/./', '/')

  // Collapse slashes + trim
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/+/, '')
  slug = slug.replace(/\/+$/, '')

  // Clean leading/trailing dots
  slug = slug.replace(/^\.+/, '')
  slug = slug.replace(/\.+$/, '')

  // Allow only safe characters
  slug = slug.replace(/[^A-Za-z0-9\-._/]+/g, '')

  // Final normalise
  slug = slug.replace(/\/+/g, '/')
  slug = slug.replace(/^\/+/, '')
  slug = slug.replace(/\/+$/, '')
  return slug
}

export function getPagePathFromInput(value) {
  const slug = normalizeSlugPath(value)
  return slug ? '/' + slug : ''
}
