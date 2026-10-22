import { useEffect, useState } from 'react'

// Mode replay (build statis untuk juri): satu rekaman dari public/rekaman/snapshot.json.
export const REPLAY = import.meta.env.VITE_SAKSAMA_REPLAY === '1'

// Mode live: minta ulang snapshot tiap 2 detik dari endpoint hanya-baca di server dev.
export function useSnapshot(intervalMs = 2000) {
  const [snap, setSnap] = useState(null)
  const [galat, setGalat] = useState(null)

  useEffect(() => {
    let batal = false
    async function ambil() {
      try {
        const url = REPLAY ? `${import.meta.env.BASE_URL}rekaman/snapshot.json` : '/api/snapshot'
        const res = await fetch(url, { cache: 'no-store' })
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
    if (REPLAY) return () => (batal = true)
    const t = setInterval(ambil, intervalMs)
    return () => {
      batal = true
      clearInterval(t)
    }
  }, [intervalMs])

  return { snap, galat }
}
