export function displayAuthor(author){
  if (!author) return 'Admin'
  const s = String(author).trim()
  if (!s) return 'Admin'
  // If author looks like an email (admin posts saved as email), show generic 'Admin'
  if (/@/.test(s)) return 'Admin'
  // common admin values
  if (/^admin$/i.test(s)) return 'Admin'
  return s
}
