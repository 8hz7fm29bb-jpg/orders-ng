// Render the actual report using the application's print stylesheet.
function printStyles(rules: CSSRuleList): string {
  return Array.from(rules).map(rule => {
    if (rule instanceof CSSMediaRule) {
      return /\bprint\b/.test(rule.conditionText) ? printStyles(rule.cssRules) : ''
    }
    if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{${printStyles(rule.cssRules)}}`
    return rule.cssText
  }).join('\n')
}

export async function exportReportPdf(panel: HTMLElement, filename: string) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:1200px;border:0;pointer-events:none'
  document.body.appendChild(frame)
  try {
    const target = frame.contentDocument!
    const style = target.createElement('style')
    style.textContent = Array.from(document.styleSheets).map(sheet => {
      try { return printStyles(sheet.cssRules) } catch { throw new Error('Impossibile leggere lo stile di stampa del report.') }
    }).join('\n') + '\nhtml,body{width:186mm!important;margin:0!important;padding:0!important;background:white!important}body{overflow:visible!important}'
    target.head.appendChild(style)
    const clone = panel.cloneNode(true) as HTMLElement
    target.body.appendChild(clone)
    await target.fonts.ready
    const box = clone.getBoundingClientRect()
    const pxPerMm = box.width / 186
    const pageHeight = 267 * pxPerMm // A4: top 18 mm, bottom 12 mm.
    const rows = Array.from(clone.querySelectorAll('tr')).map(row => {
      const rect = row.getBoundingClientRect()
      return { top: rect.top - box.top, bottom: rect.bottom - box.top }
    })
    const tables = Array.from(clone.querySelectorAll('table')).map(table => {
      const rect = table.getBoundingClientRect(), head = table.tHead?.getBoundingClientRect()
      return { top: rect.top - box.top, bottom: rect.bottom - box.top, headTop: head ? head.top - box.top : 0, headHeight: head?.height || 0 }
    })
    const doc = new jsPDF({ orientation: 'portrait', format: 'a4', compress: true })
    let offset = 0, page = 0
    while (offset < box.height - .5) {
      const continuing = page > 0 ? tables.find(table => offset > table.top && offset < table.bottom - .5) : undefined
      const repeatHeight = continuing?.headHeight || 0
      let end = Math.min(box.height, offset + pageHeight - repeatHeight)
      const crossing = rows.find(row => row.top < end && row.bottom > end + .5)
      if (crossing && crossing.top > offset + 1) end = crossing.top
      // Keep a dish heading with its first ingredient and a table header with its first row.
      for (const heading of Array.from(clone.querySelectorAll('.productionDishRow,thead,.dedicatedReportSummary h4'))) {
        const rect = heading.getBoundingClientRect(), top = rect.top - box.top, bottom = rect.bottom - box.top
        const following = rows.filter(row => row.top >= bottom - .5 && row.bottom > bottom + .5)
        const next = following[heading.matches('h4') ? 1 : 0]
        if (top > offset + 1 && bottom <= end + .5 && next && next.bottom > end) end = Math.min(end, top)
      }
      if (page++) doc.addPage()
      let y = 18
      const capture = (top: number, height: number) => html2canvas(clone, {
        backgroundColor: '#ffffff', scale: 2, width: box.width, height,
        y: top, scrollX: 0, scrollY: 0, windowWidth: 800, logging: false
      })
      if (continuing && repeatHeight) {
        const header = await capture(continuing.headTop, repeatHeight)
        doc.addImage(header, 'PNG', 12, y, 186, repeatHeight / pxPerMm)
        header.width = header.height = 0
        y += repeatHeight / pxPerMm
      }
      const canvas = await capture(offset, end - offset)
      doc.addImage(canvas, 'PNG', 12, y, 186, (end - offset) / pxPerMm)
      canvas.width = canvas.height = 0
      offset = end
    }
    doc.save(filename)
  } finally {
    frame.remove()
  }
}
