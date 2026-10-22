#!/usr/bin/env python3
"""Pengecek aturan deterministik untuk agent Asisten Owner.

Agent memakai script ini untuk semua hitungan dan pengecekan (stok, HPP,
piutang, jadwal, izin) supaya angka tidak bergantung pada tebakan model.
Script ini HANYA membaca folder data/ dan tidak pernah menulis apa pun.

Setiap perintah mencetak satu objek JSON:
  status        ok | peringatan | ambigu | tidak_ada | ditolak_izin |
                ditolak_aturan | pengirim_tidak_dikenal
  alasan        penjelasan untuk agent (bukan untuk ditampilkan apa adanya
                kalau status ditolak_izin / tidak_ada; pakai kalimat_baku)
  kalimat_baku  kalimat yang WAJIB disalin persis ke pengguna, kalau ada
  sumber        file data yang dibaca
  data, saran   rincian tambahan

Contoh:
  python3 tools/cek_aturan.py cari --jenis kontak --nama "Budi"
  python3 tools/cek_aturan.py transfer --peminta "Bu Sari" --dari Gresik --ke Pasuruan --sku NA1K --jumlah 20 --tanggal 2026-10-22
  python3 tools/cek_aturan.py harga --peminta "Bu Sari" --sku SS500 --persen 5
  python3 tools/cek_aturan.py tagihan --peminta "Bu Sari" --reseller "Bu Ani Rahayu"
  python3 tools/cek_aturan.py jadwal --peminta "Bu Sari" --waktu "2026-10-23 12:00" --zona WIB --penerima "Pak Budi Hartono"
  python3 tools/cek_aturan.py margin --peminta Wulan --produk "sosis"
  python3 tools/cek_aturan.py kirim --peminta "Bu Sari" --penerima "Pak Budi Hartono" --isi "Notulen rapat terlampir."
  python3 tools/cek_aturan.py setujui --penyetuju Dimas --peminta-rencana "Bu Sari" --aksi transfer_stok

Tanggal "hari ini" diambil dari data/hari_ini.txt kalau ada (untuk uji
yang bisa diulang), selain itu tanggal sistem.
"""

import argparse
import csv
import json
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

ZONA_OFFSET = {"WIB": 7, "WITA": 8, "WIT": 9}
JAM_BUKA = time(8, 0)
JAM_TUTUP = time(17, 0)
SALAT_MULAI = time(11, 30)
SALAT_SELESAI = time(13, 0)
SLOT_USULAN = [time(8, 0), time(9, 0), time(10, 0), time(13, 30), time(14, 0), time(15, 0)]
HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


# ---------- utilitas ----------

def baca(nama):
    with open(DATA / nama, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def keluar(status, alasan, sumber, data=None, saran=None, kalimat_baku=None):
    hasil = {"status": status, "alasan": alasan, "sumber": sorted(set(sumber))}
    if kalimat_baku:
        hasil["kalimat_baku"] = kalimat_baku
    if data is not None:
        hasil["data"] = data
    if saran:
        hasil["saran"] = saran
    print(json.dumps(hasil, ensure_ascii=False, indent=2))
    sys.exit(0)


def hari_ini():
    f = DATA / "hari_ini.txt"
    if f.exists():
        return date.fromisoformat(f.read_text().strip())
    return date.today()


def rupiah(n):
    return "Rp " + f"{int(round(n)):,}".replace(",", ".")


def fmt_tgl(d):
    return f"{HARI[d.weekday()]}, {d.day} {BULAN[d.month - 1]} {d.year}"


def cocok(nama, kueri):
    """Semua kata di kueri muncul di nama (tidak peka huruf besar)."""
    n = nama.casefold()
    return all(k in n for k in kueri.casefold().split())


def nama_owner():
    for k in baca("kontak.csv"):
        if k["peran"] == "owner":
            return k["nama"]
    return "owner"


KALIMAT_TIDAK_DITEMUKAN = (
    "Saya tidak menemukan informasi itu di data yang bisa saya akses. "
    "Untuk pertanyaan ini, silakan hubungi {kontak}."
)
KALIMAT_PERLU_OWNER = (
    "Permintaan ini perlu disetujui owner. Saya tidak bisa menyusunnya atas nama Anda. "
    "Silakan sampaikan ke {owner}."
)
KALIMAT_TIDAK_DIKENAL = (
    "Maaf, permintaan ini tidak bisa saya proses karena pengirim belum terdaftar. "
    "Silakan hubungi {owner}."
)


KALIMAT_TIDAK_ADA_OWNER = (
    "Saya tidak menemukan informasi itu di data yang tercatat. "
    "Kalau seharusnya ada, datanya perlu ditambahkan dulu ke catatan toko."
)


def kalimat_tidak_ditemukan(peminta):
    # Owner tidak diarahkan ke dirinya sendiri (T38). Untuk owner tidak ada data yang
    # dirahasiakan, jadi "tidak ada" memang berarti tidak tercatat.
    if peminta["peran"] == "owner":
        return KALIMAT_TIDAK_ADA_OWNER
    return KALIMAT_TIDAK_DITEMUKAN.format(kontak=nama_owner())


def kenali(peminta):
    """Cari kontak berdasarkan nama persis atau id_kanal. Hentikan kalau tidak dikenal."""
    for k in baca("kontak.csv"):
        if k["nama"].casefold() == peminta.casefold() or k["id_kanal"] == peminta:
            return k
    keluar(
        "pengirim_tidak_dikenal",
        f"'{peminta}' tidak ada di kontak.csv.",
        ["kontak.csv"],
        kalimat_baku=KALIMAT_TIDAK_DIKENAL.format(owner=nama_owner()),
    )


def izin(peran, aksi):
    for r in baca("izin.csv"):
        if r["peran"] == peran and r["aksi"] == aksi:
            return r["boleh"] == "ya", r["lingkup"]
    return False, ""


def wajib_izin(kontak, aksi, cabang_terkait=None):
    boleh, lingkup = izin(kontak["peran"], aksi)
    if boleh and lingkup == "cabang_sendiri" and cabang_terkait and cabang_terkait != kontak["cabang"]:
        boleh = False
    if not boleh:
        keluar(
            "ditolak_izin",
            f"Peran {kontak['peran']} ({kontak['nama']}) tidak berwenang untuk {aksi}"
            + (f" di cabang {cabang_terkait}" if cabang_terkait else "") + ".",
            ["izin.csv", "kontak.csv"],
            kalimat_baku=KALIMAT_PERLU_OWNER.format(owner=nama_owner()),
        )


def zona_cabang(cabang):
    for c in baca("cabang.csv"):
        if c["cabang"] == cabang:
            return c["zona"]
    return None


def tutup_pada(tgl, cabang):
    """Kembalikan alasan cabang tutup pada tanggal itu, atau None."""
    if tgl.weekday() == 6:
        return "hari Minggu (tutup sesuai aturan_operasional.md)"
    for r in baca("libur.csv"):
        if r["tanggal"] == tgl.isoformat() and (r["cabang"] == "" or r["cabang"] == cabang):
            return r["keterangan"]
    return None


def hari_buka_berikut(mulai, cabang, n=2):
    hasil, d = [], mulai
    while len(hasil) < n:
        d += timedelta(days=1)
        if not tutup_pada(d, cabang):
            hasil.append(d)
    return hasil


# ---------- perintah ----------

def cmd_cari(a):
    if a.jenis == "kontak":
        baris, kolom, berkas = baca("kontak.csv"), "nama", "kontak.csv"
    elif a.jenis == "produk":
        baris, kolom, berkas = baca("produk_harga_hpp.csv"), "produk", "produk_harga_hpp.csv"
        baris = [{"sku": r["sku"], "produk": r["produk"]} for r in baris]  # tanpa harga/HPP
    elif a.jenis == "reseller":
        baris = [k for k in baca("kontak.csv") if k["peran"] == "reseller"]
        kolom, berkas = "nama", "kontak.csv"
    else:
        baris, kolom, berkas = baca("cabang.csv"), "cabang", "cabang.csv"
    temu = [r for r in baris if cocok(r[kolom], a.nama)]
    if not temu:
        keluar("tidak_ada", f"Tidak ada {a.jenis} yang cocok dengan '{a.nama}'.", [berkas])
    if len(temu) > 1:
        keluar("ambigu", f"Ada {len(temu)} {a.jenis} yang cocok dengan '{a.nama}'. Tanyakan ke penanya.", [berkas], data=temu)
    keluar("ok", f"Satu {a.jenis} cocok.", [berkas], data=temu[0])


def stok_tersedia(cabang, sku):
    """Stok tercatat di CSV dikurangi transfer yang sudah dijalankan (simulasi di outbox/).
    Outbox belum mengurangi CSV, jadi tanpa ini stok yang sama bisa dipakai dua kali (T31)."""
    r = next((x for x in baca("stok_per_cabang.csv") if x["cabang"] == cabang and x["sku"] == sku), None)
    tercatat = int(r["stok"]) if r else 0
    keluar_simulasi = 0
    for f in sorted((DATA.parent / "outbox").glob("*_transfer_stok.json")):
        try:
            inp = json.loads(f.read_text()).get("input", {})
        except (json.JSONDecodeError, OSError):
            continue
        if inp.get("dari") == cabang and inp.get("sku") == sku:
            keluar_simulasi += int(inp.get("jumlah", 0))
    return tercatat, keluar_simulasi, tercatat - keluar_simulasi


def boleh_transfer_dari(peminta, cabang):
    boleh, lingkup = izin(peminta["peran"], "transfer_stok")
    return boleh and not (lingkup == "cabang_sendiri" and cabang != peminta["cabang"])


def saran_stok_kurang(peminta, a, tersedia, satuan):
    """Opsi yang SUDAH dicek (stok, izin, hari tutup) untuk stok kurang, supaya agent
    tidak perlu mengarang alternatif sendiri (T29, T35). Hanya transfer ke cabang tujuan;
    tidak pernah memakai stok cabang tujuan sendiri."""
    tgl = date.fromisoformat(a.tanggal) if a.tanggal else None
    saran = []
    if tersedia > 0:
        saran.append(f"Kirim {tersedia} {satuan} dari {a.dari} saja (kurang {a.jumlah - tersedia} {satuan} dari permintaan)")
    sisa, kombinasi = a.jumlah - max(tersedia, 0), [f"{tersedia} dari {a.dari}"] if tersedia > 0 else []
    lain = []
    for r in baca("stok_per_cabang.csv"):
        cab = r["cabang"]
        if r["sku"] != a.sku or cab in (a.dari, a.ke):
            continue
        _, _, ada = stok_tersedia(cab, a.sku)
        if ada <= 0 or not boleh_transfer_dari(peminta, cab):
            continue
        if tgl and tutup_pada(tgl, cab):
            continue
        lain.append((ada, cab))
    for ada, cab in sorted(lain, reverse=True):
        zona = zona_cabang(cab)
        catatan_zona = f", zona {zona}" if zona != zona_cabang(a.ke) else ""
        if ada >= a.jumlah:
            saran.append(f"Kirim {a.jumlah} {satuan} dari {cab} (stok {ada}{catatan_zona})")
        if sisa > 0:
            ambil = min(sisa, ada)
            kombinasi.append(f"{ambil} dari {cab}{catatan_zona}")
            sisa -= ambil
    if len(kombinasi) > 1:
        total = a.jumlah - sisa
        saran.append("Gabungan: " + " + ".join(kombinasi) + f" = {total} {satuan}"
                     + (f" (masih kurang {sisa})" if sisa > 0 else " (pas)"))
    if not saran:
        saran.append(f"Tidak ada cabang lain yang punya stok {a.sku}. Tunda sampai ada stok masuk.")
    return saran


def cmd_transfer(a):
    peminta = kenali(a.peminta)
    wajib_izin(peminta, "transfer_stok", a.dari)
    sumber = ["kontak.csv", "izin.csv", "stok_per_cabang.csv"]
    if a.dari == a.ke:
        keluar("ditolak_aturan", "Cabang asal dan tujuan sama.", sumber)
    for c in (a.dari, a.ke):
        if not zona_cabang(c):
            keluar("tidak_ada", f"Cabang '{c}' tidak ada di cabang.csv.", sumber + ["cabang.csv"])
    stok = next((r for r in baca("stok_per_cabang.csv") if r["cabang"] == a.dari and r["sku"] == a.sku), None)
    tercatat, keluar_simulasi, tersedia = stok_tersedia(a.dari, a.sku)
    if keluar_simulasi:
        sumber.append("outbox/")
    data = {"dari": a.dari, "ke": a.ke, "sku": a.sku,
            "produk": stok["produk"] if stok else None, "jumlah": a.jumlah,
            "stok_asal": tersedia, "stok_tercatat": tercatat, "sudah_keluar_di_outbox": keluar_simulasi,
            "satuan": stok["satuan"] if stok else None}
    if a.jumlah <= 0:
        keluar("ditolak_aturan", "Jumlah harus lebih dari 0.", sumber, data)
    if tersedia < a.jumlah:
        keluar("ditolak_aturan",
               f"Stok {a.sku} di {a.dari} hanya {tersedia}, diminta {a.jumlah}."
               + (f" (tercatat {tercatat}, {keluar_simulasi} sudah keluar lewat outbox)" if keluar_simulasi else ""),
               sumber, data, saran=saran_stok_kurang(peminta, a, tersedia, stok["satuan"] if stok else "dus"))
    if a.tanggal:
        tgl = date.fromisoformat(a.tanggal)
        sumber += ["libur.csv", "aturan_operasional.md"]
        for cab in (a.dari, a.ke):
            alasan = tutup_pada(tgl, cab)
            if alasan:
                usul = []
                # Hari buka terdekat SEBELUM tanggal itu (tidak lewat dari hari ini), sering lebih
                # berguna karena barang tiba sebelum cabang tutup (T37).
                d = tgl - timedelta(days=1)
                while d >= hari_ini():
                    if not tutup_pada(d, a.dari) and not tutup_pada(d, a.ke):
                        usul.append(f"{fmt_tgl(d)} (sebelum cabang tutup)")
                        break
                    d -= timedelta(days=1)
                usul += [fmt_tgl(d) for d in hari_buka_berikut(tgl, a.ke) if not tutup_pada(d, a.dari)]
                keluar("ditolak_aturan", f"Cabang {cab} tutup pada {fmt_tgl(tgl)}: {alasan}.", sumber, data, saran=usul)
        data["tanggal"] = fmt_tgl(tgl)
    keluar("ok", f"Stok cukup ({tersedia} tersedia"
           + (f", setelah dikurangi {keluar_simulasi} yang sudah keluar lewat outbox" if keluar_simulasi else "") + ").", sumber, data)


def cmd_harga(a):
    peminta = kenali(a.peminta)
    wajib_izin(peminta, "ubah_harga")
    sumber = ["kontak.csv", "izin.csv", "produk_harga_hpp.csv"]
    p = next((r for r in baca("produk_harga_hpp.csv") if r["sku"] == a.sku), None)
    if not p:
        keluar("tidak_ada", f"SKU '{a.sku}' tidak ada di produk_harga_hpp.csv.", sumber)
    lama, hpp = int(p["harga_jual"]), int(p["hpp"])
    if a.harga is not None:
        baru = a.harga
    elif a.persen is not None:
        baru = int(round(lama * (1 + a.persen / 100)))
    else:
        keluar("ditolak_aturan", "Isi --persen atau --harga.", sumber)
    data = {"sku": a.sku, "produk": p["produk"], "harga_lama": rupiah(lama),
            "harga_baru": rupiah(baru), "hpp": rupiah(hpp),
            "perubahan_persen": round((baru - lama) / lama * 100, 2),
            "margin_baru_per_unit": rupiah(baru - hpp)}
    if baru <= 0:
        keluar("ditolak_aturan", "Harga baru tidak valid.", sumber, data)
    if baru < hpp:
        data["rugi_per_unit"] = rupiah(hpp - baru)
        keluar("peringatan",
               f"DI BAWAH HPP: harga baru {rupiah(baru)} < HPP {rupiah(hpp)}, rugi {rupiah(hpp - baru)} per unit. "
               "Hanya boleh dijalankan dengan balasan 'setuju rugi <no>'.",
               sumber, data)
    keluar("ok", f"Harga baru {rupiah(baru)} di atas HPP {rupiah(hpp)}.", sumber, data)


def cmd_tagihan(a):
    peminta = kenali(a.peminta)
    sumber = ["kontak.csv", "izin.csv", "reseller_piutang.csv"]
    reseller = next((k for k in baca("kontak.csv") if k["peran"] == "reseller" and k["nama"].casefold() == a.reseller.casefold()), None)
    if not reseller:
        temu = [k["nama"] for k in baca("kontak.csv") if k["peran"] == "reseller" and cocok(k["nama"], a.reseller)]
        if len(temu) > 1:
            keluar("ambigu", f"Ada {len(temu)} reseller cocok dengan '{a.reseller}'. Tanyakan ke penanya.", sumber, data=temu)
        keluar("tidak_ada", f"Reseller '{a.reseller}' tidak ada di kontak.csv.", sumber)
    wajib_izin(peminta, "pesan_tagihan", reseller["cabang"])
    tgl = hari_ini()
    nota = [r for r in baca("reseller_piutang.csv") if r["reseller"] == reseller["nama"]]
    if not nota:
        keluar("tidak_ada", f"Tidak ada piutang tercatat untuk {reseller['nama']}. Jangan buat pesan tagihan.", sumber,
               kalimat_baku=kalimat_tidak_ditemukan(peminta))
    rincian, total = [], 0
    for r in nota:
        jt = date.fromisoformat(r["jatuh_tempo"])
        total += int(r["nominal"])
        rincian.append({"nota": r["nota"], "nominal": rupiah(int(r["nominal"])),
                        "jatuh_tempo": fmt_tgl(jt), "lewat_jatuh_tempo": jt < tgl})
    baris_nota = "\n".join(f"- Nota {x['nota']}: {x['nominal']}, jatuh tempo {x['jatuh_tempo']}" for x in rincian)
    draf = (f"Halo {reseller['nama']}, kami mengingatkan tagihan berikut:\n{baris_nota}\n"
            f"Total {rupiah(total)}. Mohon konfirmasi rencana pembayarannya. Terima kasih.")
    data = {"reseller": reseller["nama"], "cabang": reseller["cabang"], "kanal": f"{reseller['kanal']} {reseller['id_kanal']}",
            "total": rupiah(total), "nota": rincian, "draf_pesan": draf, "hari_ini": fmt_tgl(tgl)}
    if not any(x["lewat_jatuh_tempo"] for x in rincian):
        keluar("peringatan", "Piutang ada tetapi belum ada yang lewat jatuh tempo. Konfirmasi ke penanya apakah tetap ditagih.", sumber, data)
    keluar("ok", f"Total piutang {rupiah(total)}.", sumber, data)


def cmd_jadwal(a):
    peminta = kenali(a.peminta)
    sumber = ["kontak.csv", "izin.csv", "cabang.csv", "libur.csv", "aturan_operasional.md"]
    if a.penerima:
        p = next((k for k in baca("kontak.csv") if k["nama"].casefold() == a.penerima.casefold()), None)
        if not p:
            temu = [k["nama"] for k in baca("kontak.csv") if cocok(k["nama"], a.penerima)]
            if len(temu) > 1:
                keluar("ambigu", f"Ada {len(temu)} kontak cocok dengan '{a.penerima}'. Tanyakan ke penanya.", sumber, data=temu)
            keluar("tidak_ada", f"'{a.penerima}' tidak ada di kontak.csv. Minta kontaknya, jangan menebak.", sumber)
        zona_p, cabang_p = p["zona"], p["cabang"]
    else:
        zona_p, cabang_p = a.zona, ""
    wajib_izin(peminta, "jadwalkan", cabang_p or None)
    if a.zona not in ZONA_OFFSET:
        keluar("ditolak_aturan", f"Zona '{a.zona}' tidak dikenal. Pakai WIB, WITA, atau WIT.", sumber)
    mulai = datetime.strptime(a.waktu, "%Y-%m-%d %H:%M")
    lokal = mulai + timedelta(hours=ZONA_OFFSET[zona_p] - ZONA_OFFSET[a.zona])
    selesai = lokal + timedelta(minutes=a.durasi)

    def masalah(t0):
        t1 = t0 + timedelta(minutes=a.durasi)
        libur = tutup_pada(t0.date(), cabang_p)
        if libur:
            return f"{fmt_tgl(t0.date())}: {libur}"
        if t0.time() < JAM_BUKA or t1.time() > JAM_TUTUP or t1.date() != t0.date():
            return f"di luar jam kerja 08.00 sampai 17.00 {zona_p}"
        if t0.weekday() == 4 and t0.time() < SALAT_SELESAI and t1.time() > SALAT_MULAI:
            return "bentrok waktu salat Jumat (11.30 sampai 13.00 waktu lokal)"
        return None

    def dua_zona(t_lokal):
        t_minta = t_lokal - timedelta(hours=ZONA_OFFSET[zona_p] - ZONA_OFFSET[a.zona])
        teks = f"{fmt_tgl(t_minta.date())} {t_minta:%H.%M} {a.zona}"
        if zona_p != a.zona:
            teks += f" ({t_lokal:%H.%M} {zona_p} waktu penerima)"
        return teks

    data = {"diminta": dua_zona(lokal), "zona_penerima": zona_p, "durasi_menit": a.durasi}
    m = masalah(lokal)
    if not m:
        keluar("ok", "Jadwal sesuai aturan.", sumber, data)
    usul, d = [], lokal.date()
    while len(usul) < 2 and (d - lokal.date()).days < 14:
        # Urutkan slot dari yang jam-nya paling dekat dengan jam yang diminta.
        menit = lokal.hour * 60 + lokal.minute
        slot = sorted(SLOT_USULAN, key=lambda s: abs(s.hour * 60 + s.minute - menit))
        for s in slot:
            t = datetime.combine(d, s)
            if t > lokal - timedelta(hours=12) and not masalah(t) and dua_zona(t) not in usul:
                usul.append(dua_zona(t))
            if len(usul) == 2:
                break
        d += timedelta(days=1)
    keluar("ditolak_aturan", f"Jadwal {m}.", sumber, data, saran=usul)


def cmd_margin(a):
    """Pertanyaan HPP/margin. Jawaban 'tidak boleh' dan 'tidak ada' sengaja identik."""
    peminta = kenali(a.peminta)
    sumber = ["kontak.csv", "izin.csv"]
    boleh, _ = izin(peminta["peran"], "lihat_hpp")
    temu = [r for r in baca("produk_harga_hpp.csv") if cocok(r["produk"], a.produk)]
    baku = kalimat_tidak_ditemukan(peminta)
    if not boleh or not temu:
        # Sumber yang dilaporkan sama untuk kedua kasus supaya tidak membocorkan apa pun.
        keluar("tidak_ada", "Tidak ada data yang bisa ditampilkan untuk penanya ini.", sumber, kalimat_baku=baku)
    sumber.append("produk_harga_hpp.csv")
    if len(temu) > 1:
        keluar("ambigu", "Lebih dari satu produk cocok. Tanyakan ke penanya.", sumber,
               data=[{"sku": r["sku"], "produk": r["produk"]} for r in temu])
    r = temu[0]
    h, c = int(r["harga_jual"]), int(r["hpp"])
    keluar("ok", "Margin dihitung dari harga jual dan HPP.", sumber,
           data={"sku": r["sku"], "produk": r["produk"], "harga_jual": rupiah(h), "hpp": rupiah(c),
                 "margin_per_unit": rupiah(h - c), "margin_persen": round((h - c) / h * 100, 1)})


def cmd_stok(a):
    peminta = kenali(a.peminta)
    sumber = ["kontak.csv", "izin.csv", "stok_per_cabang.csv"]
    boleh, lingkup = izin(peminta["peran"], "lihat_stok")
    if boleh and lingkup == "cabang_sendiri":
        if a.cabang and a.cabang != peminta["cabang"]:
            boleh = False
        cabang = peminta["cabang"]
    else:
        cabang = a.cabang
    if not boleh:
        keluar("tidak_ada", "Peminta tidak berwenang melihat stok cabang ini.", ["kontak.csv", "izin.csv"],
               kalimat_baku=kalimat_tidak_ditemukan(peminta))
    # Nama produk diambil dari file stok, bukan dari file harga/HPP.
    semua = {r["sku"]: r["produk"] for r in baca("stok_per_cabang.csv")}
    produk = [{"sku": s, "produk": n} for s, n in semua.items()
              if (a.sku and s == a.sku) or (a.produk and cocok(n, a.produk))]
    if not produk:
        # Sengaja identik dengan jawaban "tidak berwenang" di atas.
        keluar("tidak_ada", "Peminta tidak berwenang melihat stok cabang ini.", ["kontak.csv", "izin.csv"],
               kalimat_baku=kalimat_tidak_ditemukan(peminta))
    if len(produk) > 1:
        keluar("ambigu", f"Ada {len(produk)} produk yang cocok. Tanyakan ke penanya.", sumber, data=produk)
    sku = produk[0]["sku"]
    baris = [r for r in baca("stok_per_cabang.csv") if r["sku"] == sku and (not cabang or r["cabang"] == cabang)]
    data = {"sku": sku, "produk": produk[0]["produk"], "cakupan": cabang or "semua cabang",
            "stok": [{"cabang": r["cabang"], "stok": int(r["stok"]), "satuan": r["satuan"]} for r in baris]}
    keluar("ok", f"Stok {sku} di {cabang or 'semua cabang'}: " +
           (", ".join(f"{r['cabang']} {r['stok']}" for r in baris) or "tidak ada catatan stok") + ".", sumber, data)


def cmd_kirim(a):
    peminta = kenali(a.peminta)
    sumber = ["kontak.csv", "izin.csv"]
    p = next((k for k in baca("kontak.csv") if k["nama"].casefold() == a.penerima.casefold()), None)
    if not p:
        temu = [k["nama"] for k in baca("kontak.csv") if cocok(k["nama"], a.penerima)]
        if len(temu) > 1:
            keluar("ambigu", f"Ada {len(temu)} kontak cocok dengan '{a.penerima}'. Tanyakan ke penanya.", sumber, data=temu)
        keluar("tidak_ada", f"'{a.penerima}' tidak ada di kontak.csv. Minta kontaknya, jangan menebak.", sumber)
    wajib_izin(peminta, "kirim_pesan", p["cabang"] or None)
    if not a.isi.strip():
        keluar("ditolak_aturan", "Isi pesan kosong.", sumber)
    keluar("ok", f"Penerima {p['nama']} via {p['kanal']} {p['id_kanal']}.", sumber,
           data={"penerima": p["nama"], "kanal": f"{p['kanal']} {p['id_kanal']}", "isi": a.isi})


def cmd_setujui(a):
    sumber = ["kontak.csv", "izin.csv"]
    penyetuju = kenali(a.penyetuju)
    peminta = kenali(a.peminta_rencana)
    if penyetuju["peran"] == "owner":
        keluar("ok", "Owner berwenang menyetujui.", sumber)
    if penyetuju["nama"] != peminta["nama"]:
        keluar("ditolak_izin",
               f"{penyetuju['nama']} bukan peminta rencana ({peminta['nama']}) dan bukan owner.",
               sumber, kalimat_baku=KALIMAT_PERLU_OWNER.format(owner=nama_owner()))
    boleh_setuju, _ = izin(penyetuju["peran"], "setujui")
    boleh_aksi, _ = izin(penyetuju["peran"], a.aksi)
    if not (boleh_setuju and boleh_aksi):
        keluar("ditolak_izin", f"Peran {penyetuju['peran']} tidak berwenang menyetujui {a.aksi}.",
               sumber, kalimat_baku=KALIMAT_PERLU_OWNER.format(owner=nama_owner()))
    keluar("ok", "Peminta berwenang menyetujui rencananya sendiri.", sumber)


def main():
    ap = argparse.ArgumentParser(description="Pengecek aturan Asisten Owner (hanya membaca data/).")
    sub = ap.add_subparsers(dest="perintah", required=True)

    s = sub.add_parser("cari", help="cari kontak/produk/reseller/cabang, deteksi nama ambigu")
    s.add_argument("--jenis", required=True, choices=["kontak", "produk", "reseller", "cabang"])
    s.add_argument("--nama", required=True)
    s.set_defaults(fn=cmd_cari)

    s = sub.add_parser("transfer", help="cek transfer stok antarcabang")
    s.add_argument("--peminta", required=True)
    s.add_argument("--dari", required=True)
    s.add_argument("--ke", required=True)
    s.add_argument("--sku", required=True)
    s.add_argument("--jumlah", required=True, type=int)
    s.add_argument("--tanggal", help="YYYY-MM-DD")
    s.set_defaults(fn=cmd_transfer)

    s = sub.add_parser("harga", help="cek ubah harga terhadap HPP")
    s.add_argument("--peminta", required=True)
    s.add_argument("--sku", required=True)
    g = s.add_mutually_exclusive_group()
    g.add_argument("--persen", type=float, help="5 = naik 5%%, -30 = turun 30%%")
    g.add_argument("--harga", type=int, help="harga baru dalam rupiah")
    s.set_defaults(fn=cmd_harga)

    s = sub.add_parser("tagihan", help="cek piutang reseller dan buat draf pesan")
    s.add_argument("--peminta", required=True)
    s.add_argument("--reseller", required=True)
    s.set_defaults(fn=cmd_tagihan)

    s = sub.add_parser("jadwal", help="cek jadwal terhadap jam kerja, salat Jumat, libur, zona")
    s.add_argument("--peminta", required=True)
    s.add_argument("--waktu", required=True, help="'YYYY-MM-DD HH:MM'")
    s.add_argument("--zona", required=True, help="zona waktu --waktu: WIB/WITA/WIT")
    s.add_argument("--penerima", help="nama kontak; zona & cabang diambil dari kontak.csv")
    s.add_argument("--durasi", type=int, default=60, help="menit, default 60")
    s.set_defaults(fn=cmd_jadwal)

    s = sub.add_parser("margin", help="pertanyaan HPP/margin produk (jawaban tolak = jawaban tidak ada)")
    s.add_argument("--peminta", required=True)
    s.add_argument("--produk", required=True)
    s.set_defaults(fn=cmd_margin)

    s = sub.add_parser("stok", help="lihat stok satu produk per cabang (sesuai izin lihat_stok)")
    s.add_argument("--peminta", required=True)
    g = s.add_mutually_exclusive_group(required=True)
    g.add_argument("--sku")
    g.add_argument("--produk", help="nama produk, boleh sebagian")
    s.add_argument("--cabang", help="kosongkan untuk semua cabang yang boleh dilihat")
    s.set_defaults(fn=cmd_stok)

    s = sub.add_parser("kirim", help="cek kirim pesan/dokumen ke kontak")
    s.add_argument("--peminta", required=True)
    s.add_argument("--penerima", required=True)
    s.add_argument("--isi", required=True)
    s.set_defaults(fn=cmd_kirim)

    s = sub.add_parser("setujui", help="cek apakah seseorang sah menyetujui rencana")
    s.add_argument("--penyetuju", required=True)
    s.add_argument("--peminta-rencana", required=True)
    s.add_argument("--aksi", required=True)
    s.set_defaults(fn=cmd_setujui)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
