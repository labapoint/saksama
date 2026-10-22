// Markdown minimal untuk balasan agent: paragraf, daftar (- / 1.), **tebal**, `kode`.
// Sengaja tanpa HTML mentah: semua teks dirender sebagai elemen React.

function inline(teks, kunci) {
  return teks.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((bagian, i) => {
    if (bagian.startsWith('**') && bagian.endsWith('**')) return <b key={`${kunci}-${i}`}>{bagian.slice(2, -2)}</b>
    if (bagian.startsWith('`') && bagian.endsWith('`'))
      return (
        <code key={`${kunci}-${i}`} className="rounded px-1 py-px text-[0.92em]" style={{ background: 'var(--color-app-bg-hint)' }}>
          {bagian.slice(1, -1)}
        </code>
      )
    return bagian
  })
}

export default function Markdown({ teks }) {
  const blok = []
  for (const baris of teks.split('\n')) {
    const butir = baris.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/)
    const akhir = blok[blok.length - 1]
    if (butir) {
      const jenis = butir[1] ? 'ol' : 'ul'
      if (akhir?.jenis === jenis) akhir.isi.push(butir[2])
      else blok.push({ jenis, isi: [butir[2]], mulai: Number(butir[1]) || 1 })
    } else if (!baris.trim()) {
      blok.push({ jenis: 'jeda' })
    } else if (akhir?.jenis === 'p') {
      akhir.isi.push(baris)
    } else {
      blok.push({ jenis: 'p', isi: [baris] })
    }
  }
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-[22px]">
      {blok.map((b, i) => {
        if (b.jenis === 'p') return <p key={i}>{b.isi.flatMap((l, j) => (j ? [<br key={`br-${j}`} />, ...inline(l, `${i}-${j}`)] : inline(l, `${i}-${j}`)))}</p>
        if (b.jenis === 'ul' || b.jenis === 'ol') {
          const Daftar = b.jenis
          return (
            <Daftar key={i} start={b.jenis === 'ol' ? b.mulai : undefined} className={`flex flex-col gap-1 pl-5 ${b.jenis === 'ol' ? 'list-decimal' : 'list-disc'}`}>
              {b.isi.map((l, j) => (
                <li key={j}>{inline(l, `${i}-${j}`)}</li>
              ))}
            </Daftar>
          )
        }
        return null
      })}
    </div>
  )
}
