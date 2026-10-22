// Foto profil opsional dari src/assets/avatars/<nama-kontak>.jpg (tidak masuk repo); tanpa foto, avatar memakai inisial.
// Nama di luar daftar jatuh ke inisial.
const FOTO = import.meta.glob('../assets/avatars/*.jpg', { eager: true, import: 'default' })

// "Pak Budi Santoso" -> pak-budi-santoso.jpg
function fotoUntuk(nama = '') {
  return FOTO[`../assets/avatars/${nama.trim().toLowerCase().replace(/\s+/g, '-')}.jpg`]
}

function inisial(nama = '') {
  return nama.replace(/^(Bu|Pak)\s+/, '').slice(0, 1).toUpperCase() || '?'
}

export default function Avatar({ nama, size = 36 }) {
  const src = fotoUntuk(nama)
  const gaya = { width: size, height: size }
  if (src) {
    return <img src={src} alt={nama} className="shrink-0 rounded-full object-cover" style={gaya} />
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{ ...gaya, background: 'var(--color-app-bg-hint)', color: 'var(--color-app-text)' }}
    >
      {inisial(nama)}
    </div>
  )
}
