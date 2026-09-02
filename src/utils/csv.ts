export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (value: string | number) => {
    const str = String(value)
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const csv = '\uFEFF' + lines.join('\n') // BOM for Excel compatibility

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
