import { useEffect, useState } from 'react'

// Mode live: minta ulang snapshot tiap 2 detik dari endpoint hanya-baca di server dev.
export function useSnapshot(intervalMs = 2000) {
  const [snap, setSnap] = useState(null)
  const [galat, setGalat] = useState(null)

  useEffect(() => {
    let batal = false
    async function ambil() {
      try {
        const res = await fetch('/api/snapshot', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!batal) {
          setSnap(data)
          setGalat(null)
        }
      } catch (e) {
        if (!batal) setGalat(e.message)
      }
    }
    ambil()
    const t = setInterval(ambil, intervalMs)
    return () => {
      batal = true
      clearInterval(t)
    }
  }, [intervalMs])

  return { snap, galat }
}
