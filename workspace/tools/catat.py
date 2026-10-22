#!/usr/bin/env python3
"""Gerbang persetujuan + pencatat untuk agent Asisten Owner.

Satu-satunya jalan resmi menulis ke outbox/ dan log.csv. Izin ditegakkan di
sini oleh kode, bukan oleh janji di prompt: kalaupun model tertipu, script
ini tetap menolak menjalankan aksi yang belum disetujui orang berwenang.

Alur:
  1. rencana   daftarkan rencana dari permintaan (semua aksi dicek lewat
               cek_aturan.py), hasilkan layar konfirmasi siap tampil
  2. setujui   catat balasan persetujuan: setuju semua / setuju 1,3 /
               setuju rugi 2 / batal / batal 2. Penyetuju dicek berwenang.
  3. jalankan  cek ulang aturan (stok bisa berubah sejak disetujui), lalu
               tulis aksi yang lolos ke outbox/ (simulasi, tidak terkirim)
  4. periksa   audit: setiap file outbox harus punya persetujuan sah
     cek       jalankan cek_aturan.py dan catat hasilnya otomatis (sumber
               diambil dari script, tidak diisi model)
     log       catat kejadian yang tidak lewat script (di luar kemampuan,
               isi mencurigakan)
     status    lihat isi rencana

Batas waktu: rencana harus disetujui dalam 30 menit, dan persetujuan harus
dijalankan dalam 30 menit. Lewat dari itu, buat rencana baru.

Tanda tangan: persetujuan dan file outbox ditandatangani HMAC dengan kunci
di luar folder sandbox (default ~/.asisten-owner/kunci, atau env
ASISTEN_KUNCI_FILE). Buat kuncinya SEKALI oleh manusia:
  python3 tools/catat.py init-kunci
Tanpa kunci, script tetap jalan tetapi tanda = TANPA-KUNCI dan `periksa`
akan memberi peringatan. Agent yang menulis file outbox sendiri (tanpa
script) tidak bisa dicegah di level file, tetapi pasti ketahuan oleh
`periksa` karena tidak bisa membuat tanda yang sah.

Contoh:
  python3 tools/catat.py rencana --peminta "Bu Sari" --permintaan "kirim 20 dus nugget..." \\
      --aksi '[{"jenis":"transfer_stok","dari":"Gresik","ke":"Pasuruan","sku":"NA1K","jumlah":20}]'
  python3 tools/catat.py setujui --id R-20261021-091500 --penyetuju "Bu Sari" --balasan "setuju 1,3"
  python3 tools/catat.py jalankan --id R-20261021-091500
  python3 tools/catat.py log --peminta Dimas --jenis ubah_harga --keputusan ditolak_izin --detail "naikkan NA500 jadi 30 ribu"
  python3 tools/catat.py periksa
"""

import argparse
import csv
import hashlib
import hmac
import json
import os
import re
import secrets
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RENCANA = ROOT / "rencana"
OUTBOX = ROOT / "outbox"
LOG = ROOT / "log.csv"
CEK = Path(__file__).resolve().parent / "cek_aturan.py"
KUNCI_FILE = Path(os.environ.get("ASISTEN_KUNCI_FILE", Path.home() / ".asisten-owner" / "kunci"))

WIB = timezone(timedelta(hours=7))
BATAS_SETUJU = timedelta(minutes=30)
BATAS_JALAN = timedelta(minutes=30)
TANPA_KUNCI = "TANPA-KUNCI"

KOLOM_LOG = ["waktu", "id_rencana", "no_aksi", "peminta", "peran", "jenis", "detail", "sumber_dibaca",
             "hasil_cek", "keputusan", "disetujui_oleh", "waktu_setuju", "file_outbox", "catatan"]
KEPUTUSAN = ["ditanya", "ditolak_izin", "ditolak_aturan", "menunggu", "disetujui", "dibatalkan",
             "dijalankan", "di_luar_kemampuan", "pengirim_tidak_dikenal", "persetujuan_tidak_sah",
             "kedaluwarsa", "gagal_cek_ulang", "isi_mencurigakan", "tidak_ada", "dijawab", "ambigu"]
# Hasil cek yang otomatis dicatat oleh `catat.py cek` (ok/peringatan dicatat nanti oleh `rencana`).
# "ambigu" mencatat FAKTA hasil cek, bukan klaim bahwa penanya sudah ditanya: agent bisa saja
# menyelesaikan ambiguitas sendiri dari teks permintaan (temuan T33).
KEPUTUSAN_CEK = {"ambigu": "ambigu", "ditolak_izin": "ditolak_izin", "ditolak_aturan": "ditolak_aturan",
                 "tidak_ada": "tidak_ada", "pengirim_tidak_dikenal": "pengirim_tidak_dikenal"}
LABEL = {"transfer_stok": "Transfer stok", "ubah_harga": "Ubah harga", "pesan_tagihan": "Pesan tagihan",
         "jadwalkan": "Jadwalkan", "kirim_pesan": "Kirim pesan"}
BISA_DISETUJUI = ("ok", "peringatan")


# ---------- utilitas ----------

def keluar(status, pesan, **lain):
    print(json.dumps({"status": status, "pesan": pesan, **lain}, ensure_ascii=False, indent=2))
    sys.exit(0)


def sekarang():
    s = os.environ.get("ASISTEN_SEKARANG")  # hanya untuk menguji batas waktu
    return datetime.fromisoformat(s) if s else datetime.now(WIB)


def hari_ini():
    f = DATA / "hari_ini.txt"
    return date.fromisoformat(f.read_text().strip()) if f.exists() else sekarang().date()


def jam(dt):
    return datetime.fromisoformat(dt).astimezone(WIB).strftime("%d/%m %H.%M WIB")


def pastikan_folder(p):
    # Jangan pakai mkdir(exist_ok=True): shim sandbox WorkBuddy (sitecustomize.py) melempar
    # PermissionError EEXIST untuk folder yang sudah ada, dan agent lalu memakai `python3 -S`
    # untuk melewati sandbox (temuan T17). Cek dulu, buat hanya kalau belum ada.
    if not p.is_dir():
        p.mkdir()


def kunci():
    return KUNCI_FILE.read_bytes().strip() if KUNCI_FILE.exists() else None


def tanda(obj):
    k = kunci()
    if not k:
        return TANPA_KUNCI
    teks = json.dumps(obj, sort_keys=True, ensure_ascii=False).encode()
    return hmac.new(k, teks, hashlib.sha256).hexdigest()


def tanda_sah(obj, t):
    if t == TANPA_KUNCI or not kunci():
        return None  # tidak bisa diverifikasi
    return hmac.compare_digest(tanda(obj), t)


def kontak(nama):
    with open(DATA / "kontak.csv", newline="", encoding="utf-8") as f:
        for k in csv.DictReader(f):
            if k["nama"].casefold() == nama.casefold() or k["id_kanal"] == nama:
                return k
    return None


def tulis_log(**kw):
    baru = not LOG.exists() or LOG.stat().st_size == 0
    kw.setdefault("waktu", sekarang().isoformat(timespec="seconds"))
    with open(LOG, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, KOLOM_LOG)
        if baru:
            w.writeheader()
        w.writerow({k: kw.get(k, "") for k in KOLOM_LOG})


def cek(perintah, **arg):
    argv = [sys.executable, str(CEK), perintah]
    for k, v in arg.items():
        if v is not None:
            argv += ["--" + k.replace("_", "-"), str(v)]
    hasil = subprocess.run(argv, capture_output=True, text=True)
    if hasil.returncode != 0:
        return {"status": "ditolak_aturan", "alasan": hasil.stderr.strip().splitlines()[-1], "sumber": []}
    return json.loads(hasil.stdout)


def cek_aksi(peminta, a):
    """Petakan satu aksi rencana ke perintah cek_aturan.py."""
    j = a.get("jenis")
    try:
        if j == "transfer_stok":
            return cek("transfer", peminta=peminta, dari=a["dari"], ke=a["ke"], sku=a["sku"],
                       jumlah=a["jumlah"], tanggal=a.get("tanggal"))
        if j == "ubah_harga":
            if ("persen" in a) == ("harga" in a):
                raise KeyError("isi salah satu: persen atau harga")
            return cek("harga", peminta=peminta, sku=a["sku"], persen=a.get("persen"), harga=a.get("harga"))
        if j == "pesan_tagihan":
            return cek("tagihan", peminta=peminta, reseller=a["reseller"])
        if j == "jadwalkan":
            return cek("jadwal", peminta=peminta, waktu=a["waktu"], zona=a["zona"],
                       penerima=a.get("penerima"), durasi=a.get("durasi"))
        if j == "kirim_pesan":
            return cek("kirim", peminta=peminta, penerima=a["penerima"], isi=a["isi"])
    except KeyError as e:
        return {"status": "ditolak_aturan", "alasan": f"Aksi {j} tidak lengkap: {e}", "sumber": []}
    return {"status": "ditolak_aturan", "alasan": f"Jenis aksi '{j}' tidak dikenal.", "sumber": []}


def detail(jenis, inp, d):
    d = d or {}
    if jenis == "transfer_stok":
        teks = f"{inp['jumlah']} {d.get('satuan') or ''} {d.get('produk') or inp['sku']}, {inp['dari']} → {inp['ke']}"
        return teks + (f", {d['tanggal']}" if d.get("tanggal") else "")
    if jenis == "ubah_harga" and d.get("harga_baru"):
        return f"{d['produk']}: {d['harga_lama']} → {d['harga_baru']} ({d['perubahan_persen']:+}%)"
    if jenis == "pesan_tagihan" and d.get("total"):
        return f"{d['reseller']} ({d['cabang']}), {len(d['nota'])} nota, total {d['total']}"
    if jenis == "jadwalkan" and d.get("diminta"):
        return f"{inp.get('judul', 'Jadwal')}: {d['diminta']}" + (f", dengan {inp['penerima']}" if inp.get("penerima") else "")
    if jenis == "kirim_pesan" and d.get("penerima"):
        return f"Ke {d['penerima']} via {d['kanal']}"
    return json.dumps(inp, ensure_ascii=False)


def teks_cek(jenis, h):
    if h["status"] == "ok":
        return "OK, " + h["alasan"]
    if h["status"] == "peringatan":
        return ("⛔ " if jenis == "ubah_harga" else "⚠️ ") + h["alasan"]
    return "❌ " + h["alasan"] + (f" Saran: {'; '.join(h['saran'])}." if h.get("saran") else "")


def muat(id_):
    f = RENCANA / f"{id_}.json"
    if not re.fullmatch(r"R-\d{8}-(\d{3}|\d{6}[a-j]?)", id_) or not f.exists():
        keluar("tidak_ada", f"Rencana {id_} tidak ditemukan.")
    return json.loads(f.read_text())


def simpan(r):
    pastikan_folder(RENCANA)
    (RENCANA / f"{r['id']}.json").write_text(json.dumps(r, ensure_ascii=False, indent=2))


def id_baru():
    # Berbasis jam (bukan nomor urut) supaya ID tidak terulang setelah folder rencana/ direset.
    dasar = f"R-{hari_ini():%Y%m%d}-{sekarang():%H%M%S}"
    for akhiran in [""] + list("abcdefghij"):
        if not (RENCANA / f"{dasar}{akhiran}.json").exists():
            return dasar + akhiran
    keluar("galat", "Terlalu banyak rencana dalam satu detik.")


def isi_persetujuan(r, a):
    """Bagian yang ditandatangani: mengikat id rencana, nomor, isi aksi, penyetuju, dan waktu."""
    p = a["persetujuan"]
    return {"id": r["id"], "no": a["no"], "jenis": a["jenis"], "input": a["input"],
            "penyetuju": p["penyetuju"], "waktu": p["waktu"], "balasan": p["balasan"], "rugi": p["rugi"]}


def log_aksi(r, a, keputusan, catatan="", **lain):
    p = a.get("persetujuan") or {}
    tulis_log(id_rencana=r["id"], no_aksi=a["no"], peminta=r["peminta"], peran=r["peran"], jenis=a["jenis"],
              detail=a["detail"], sumber_dibaca=" ".join(a["cek"].get("sumber", [])),
              hasil_cek=a["cek"]["status"], keputusan=keputusan, disetujui_oleh=p.get("penyetuju", ""),
              waktu_setuju=p.get("waktu", ""), catatan=catatan, **lain)


def layar_konfirmasi(r):
    # Format bertumpuk per aksi (bukan tabel lebar) supaya cek aturan dan sumber
    # terbaca utuh di layar sempit dan di aplikasi chat.
    baris = [f"**RENCANA {r['id']}**", f"Diminta oleh {r['peminta']} ({r['peran']}) · {jam(r['dibuat'])}"]
    catatan, pesan, rugi = [], [], []
    for a in r["aksi"]:
        bisa = a["status"] == "menunggu"
        status = "" if bisa else " (tidak bisa disetujui)"
        baris += ["", f"**{a['no']}. {LABEL.get(a['jenis'], a['jenis'])}{status}**",
                  f"- Detail: {a['detail']}",
                  f"- Cek aturan: {teks_cek(a['jenis'], a['cek'])}",
                  f"- Sumber: {', '.join(a['cek'].get('sumber', []))}"]
        if a["butuh_setuju_rugi"]:
            rugi.append(a["no"])
        d = a["cek"].get("data") or {}
        if bisa and d.get("draf_pesan"):
            pesan.append(f"Isi pesan aksi {a['no']}:\n{d['draf_pesan']}")
        if bisa and a["jenis"] == "kirim_pesan" and d.get("isi"):
            pesan.append(f"Isi pesan aksi {a['no']}:\n{d['isi']}")
    if r.get("catatan"):
        catatan.append(r["catatan"])
    if rugi:
        catatan.append(f"Aksi {', '.join(map(str, rugi))} membuat harga di bawah HPP dan TIDAK ikut 'setuju semua'. "
                       f"Untuk menjalankannya balas 'setuju rugi {rugi[0]}'.")
    if catatan:
        baris += ["", "⚠️ Catatan: " + " ".join(catatan)]
    if pesan:
        baris += [""] + pesan
    bisa = [a["no"] for a in r["aksi"] if a["status"] == "menunggu" and not a["butuh_setuju_rugi"]]
    pilihan = ["setuju semua"] if bisa else []
    if len(bisa) > 1:
        pilihan.append(f"setuju {bisa[0]},{bisa[-1]} (sebagian)")
    pilihan += [f"setuju rugi {n}" for n in rugi] + ["batal"]
    menunggu = [a["no"] for a in r["aksi"] if a["status"] == "menunggu"]
    if len(menunggu) > 1:
        pilihan.append(f"batal {menunggu[-1]} (sebagian)")
    pilihan = " · ".join(pilihan)
    baris += ["", f"Belum ada yang dijalankan. Rencana berlaku sampai {jam(r['kedaluwarsa'])}.",
              f"Balas dengan salah satu: {pilihan}"]
    return "\n".join(baris)


# ---------- perintah ----------

def cmd_rencana(arg):
    try:
        aksi = json.loads(arg.aksi)
        assert isinstance(aksi, list) and aksi
    except (json.JSONDecodeError, AssertionError):
        keluar("galat", "--aksi harus daftar JSON berisi minimal satu aksi.")
    pem = kontak(arg.peminta)
    if not pem:
        h = cek_aksi(arg.peminta, aksi[0])
        tulis_log(peminta=arg.peminta, detail=arg.permintaan, keputusan="pengirim_tidak_dikenal",
                  sumber_dibaca="kontak.csv")
        keluar("pengirim_tidak_dikenal", "Pengirim tidak terdaftar. Tidak ada rencana dibuat.",
               kalimat_baku=h.get("kalimat_baku"))

    hasil = [(a, cek_aksi(pem["nama"], a)) for a in aksi]
    ambigu = [(a, h) for a, h in hasil if h["status"] == "ambigu"]
    if ambigu:
        for a, h in ambigu:
            tulis_log(peminta=pem["nama"], peran=pem["peran"], jenis=a.get("jenis"), detail=arg.permintaan,
                      sumber_dibaca=" ".join(h.get("sumber", [])), hasil_cek="ambigu", keputusan="ditanya",
                      catatan=h["alasan"])
        keluar("perlu_klarifikasi", "Ada yang ambigu. Tanyakan dulu ke penanya, lalu buat rencana lagi.",
               pertanyaan=[{"jenis": a.get("jenis"), "alasan": h["alasan"], "pilihan": h.get("data")} for a, h in ambigu])

    if all(h["status"] not in BISA_DISETUJUI for _, h in hasil):
        for a, h in hasil:
            kep = "ditolak_izin" if h["status"] in ("ditolak_izin", "pengirim_tidak_dikenal") else "ditolak_aturan"
            tulis_log(peminta=pem["nama"], peran=pem["peran"], jenis=a.get("jenis"), detail=arg.permintaan,
                      sumber_dibaca=" ".join(h.get("sumber", [])), hasil_cek=h["status"], keputusan=kep,
                      catatan=h["alasan"])
        baku = next((h["kalimat_baku"] for _, h in hasil if h.get("kalimat_baku")), None)
        keluar("ditolak", "Tidak ada aksi yang bisa diajukan. Tidak ada rencana dibuat.", kalimat_baku=baku,
               alasan=[{"jenis": a.get("jenis"), "status": h["status"], "alasan": h["alasan"],
                        "saran": h.get("saran")} for a, h in hasil])

    now = sekarang()
    r = {"id": id_baru(), "peminta": pem["nama"], "peran": pem["peran"], "permintaan": arg.permintaan,
         "dibuat": now.isoformat(timespec="seconds"), "kedaluwarsa": (now + BATAS_SETUJU).isoformat(timespec="seconds"),
         "status": "menunggu", "catatan": arg.catatan or "", "menggantikan": arg.menggantikan, "aksi": []}

    if arg.menggantikan:
        lama = muat(arg.menggantikan)
        for a in lama["aksi"]:
            if a["status"] in ("menunggu", "disetujui"):
                a["status"] = "dibatalkan"
                log_aksi(lama, a, "dibatalkan", f"digantikan oleh {r['id']}")
        lama["status"] = "digantikan"
        simpan(lama)

    for no, (a, h) in enumerate(hasil, 1):
        bisa = h["status"] in BISA_DISETUJUI
        item = {"no": no, "jenis": a.get("jenis"), "input": a, "cek": h, "detail": detail(a.get("jenis"), a, h.get("data")),
                "status": "menunggu" if bisa else "ditolak",
                "butuh_setuju_rugi": a.get("jenis") == "ubah_harga" and h["status"] == "peringatan",
                "persetujuan": None, "file_outbox": None}
        r["aksi"].append(item)
        kep = "menunggu" if bisa else ("ditolak_izin" if h["status"] == "ditolak_izin" else "ditolak_aturan")
        log_aksi(r, item, kep, h["alasan"])
    if arg.catatan and not mencurigakan_tercatat(arg.berkas):
        tulis_log(id_rencana=r["id"], peminta=r["peminta"], peran=r["peran"], keputusan="isi_mencurigakan",
                  detail=detail_berkas(arg.berkas, ""), catatan=arg.catatan)
    simpan(r)
    keluar("menunggu_persetujuan", "Tampilkan layar_konfirmasi apa adanya, lalu BERHENTI dan tunggu balasan.",
           id=r["id"], layar_konfirmasi=layar_konfirmasi(r))


POLA_BALASAN = re.compile(r"(setuju rugi|setuju|batal)\s*(semua|\d+(?:\s*,\s*\d+)*)?")


def cmd_setujui(arg):
    r = muat(arg.id)
    m = POLA_BALASAN.fullmatch(arg.balasan.strip().lower())
    if not m or (m.group(1).startswith("setuju") and not m.group(2)):
        keluar("balasan_tidak_sah", "Balasan tidak jelas. Jangan anggap setuju. Minta balasan baku.",
               kalimat_baku="Mohon balas dengan salah satu: setuju semua · setuju 1,3 · batal · batal 2")
    kata, target = m.group(1), m.group(2) or "semua"
    rugi = kata == "setuju rugi"
    nomor = [a["no"] for a in r["aksi"]] if target == "semua" else [int(x) for x in re.findall(r"\d+", target)]
    peta = {a["no"]: a for a in r["aksi"]}
    asing = [n for n in nomor if n not in peta]
    if asing:
        keluar("balasan_tidak_sah", f"Nomor aksi {asing} tidak ada di rencana {r['id']}.")

    now = sekarang()
    if r["status"] != "menunggu":
        keluar("ditolak", f"Rencana {r['id']} berstatus {r['status']}, tidak bisa disetujui lagi.")
    if now > datetime.fromisoformat(r["kedaluwarsa"]):
        r["status"] = "kedaluwarsa"
        for a in r["aksi"]:
            if a["status"] == "menunggu":
                a["status"] = "kedaluwarsa"
                log_aksi(r, a, "kedaluwarsa", "lewat 30 menit tanpa persetujuan")
        simpan(r)
        keluar("kedaluwarsa", "Rencana sudah kedaluwarsa. Data bisa sudah berubah; buat rencana baru.")

    pen = kontak(arg.penyetuju)
    # Cek kewenangan untuk SEMUA aksi yang disentuh (termasuk batal) sebelum mengubah apa pun.
    for n in nomor:
        a = peta[n]
        if a["status"] != "menunggu":
            continue
        h = cek("setujui", penyetuju=arg.penyetuju, peminta_rencana=r["peminta"], aksi=a["jenis"])
        if h["status"] != "ok":
            tulis_log(id_rencana=r["id"], no_aksi=n, peminta=r["peminta"], peran=r["peran"], jenis=a["jenis"],
                      detail=a["detail"], keputusan="persetujuan_tidak_sah",
                      disetujui_oleh=arg.penyetuju, catatan=f"balasan '{arg.balasan}': {h['alasan']}")
            berwenang = r["peminta"] if r["peran"] == "owner" else f"{r['peminta']} atau owner"
            keluar("persetujuan_tidak_sah", "Penyetuju tidak berwenang. Tidak ada yang berubah.",
                   kalimat_baku=f"Persetujuan ini tidak bisa saya terima. Rencana {r['id']} hanya bisa "
                                f"disetujui atau dibatalkan oleh {berwenang}. Rencana tidak berubah.")

    disetujui, dibatalkan, dilewati = [], [], []
    for n in nomor:
        a = peta[n]
        if a["status"] != "menunggu":
            if target != "semua":
                dilewati.append(f"aksi {n} berstatus {a['status']}")
            continue
        if kata == "batal":
            a["status"] = "dibatalkan"
            log_aksi(r, a, "dibatalkan", f"dibatalkan oleh {pen['nama']}")
            dibatalkan.append(n)
            continue
        if a["butuh_setuju_rugi"] and not rugi:
            dilewati.append(f"aksi {n} di bawah HPP, butuh 'setuju rugi {n}'")
            continue
        a["persetujuan"] = {"penyetuju": pen["nama"], "waktu": now.isoformat(timespec="seconds"),
                            "balasan": arg.balasan, "rugi": rugi}
        a["persetujuan"]["tanda"] = tanda(isi_persetujuan(r, a))
        a["status"] = "disetujui"
        log_aksi(r, a, "disetujui", f"balasan '{arg.balasan}'")
        disetujui.append(n)

    # Persetujuan sebagian: sisa aksi yang tidak disebut dianggap batal, kecuali yang menunggu 'setuju rugi'.
    if kata.startswith("setuju") and target != "semua":
        for a in r["aksi"]:
            if a["status"] == "menunggu" and a["no"] not in nomor and not a["butuh_setuju_rugi"]:
                a["status"] = "dibatalkan"
                log_aksi(r, a, "dibatalkan", f"tidak disebut di balasan '{arg.balasan}'")
                dibatalkan.append(a["no"])
    if not any(a["status"] == "menunggu" for a in r["aksi"]):
        r["status"] = "diputuskan"
    simpan(r)
    keluar("tercatat", "Persetujuan tercatat. Lanjutkan dengan perintah jalankan." if disetujui
           else "Tidak ada aksi yang disetujui.", id=r["id"], disetujui=disetujui,
           dibatalkan=sorted(dibatalkan), dilewati=dilewati)


def cmd_jalankan(arg):
    r = muat(arg.id)
    now = sekarang()
    dijalankan, gagal = [], []
    for a in r["aksi"]:
        if a["status"] != "disetujui":
            continue
        p = a["persetujuan"]
        sah = tanda_sah(isi_persetujuan(r, a), p.get("tanda", ""))
        if sah is False:
            a["status"] = "gagal_cek_ulang"
            log_aksi(r, a, "persetujuan_tidak_sah", "tanda persetujuan tidak cocok, kemungkinan diubah di luar script")
            gagal.append({"no": a["no"], "alasan": "tanda persetujuan tidak sah"})
            continue
        if now - datetime.fromisoformat(p["waktu"]) > BATAS_JALAN:
            a["status"] = "kedaluwarsa"
            log_aksi(r, a, "kedaluwarsa", "persetujuan lewat 30 menit sebelum dijalankan")
            gagal.append({"no": a["no"], "alasan": "persetujuan kedaluwarsa, buat rencana baru"})
            continue
        # Cek ulang: data bisa berubah antara persetujuan dan eksekusi.
        h = cek_aksi(r["peminta"], a["input"])
        turun_ke_rugi = a["jenis"] == "ubah_harga" and h["status"] == "peringatan" and not p["rugi"]
        if h["status"] not in BISA_DISETUJUI or turun_ke_rugi:
            a["status"] = "gagal_cek_ulang"
            log_aksi(r, a, "gagal_cek_ulang", h["alasan"])
            gagal.append({"no": a["no"], "alasan": h["alasan"], "saran": h.get("saran")})
            continue
        pastikan_folder(OUTBOX)
        nama = f"{r['id']}_{a['no']}_{a['jenis']}.json"
        isi = {"id_rencana": r["id"], "no": a["no"], "jenis": a["jenis"], "input": a["input"],
               "hasil_cek_saat_jalan": h.get("data"), "diminta_oleh": r["peminta"],
               "disetujui_oleh": p["penyetuju"], "waktu_setuju": p["waktu"],
               "dijalankan": now.isoformat(timespec="seconds"), "tanda_persetujuan": p["tanda"],
               "catatan": "simulasi, tidak dikirim ke sistem mana pun"}
        isi["tanda"] = tanda(isi)
        (OUTBOX / nama).write_text(json.dumps(isi, ensure_ascii=False, indent=2))
        a["status"], a["file_outbox"] = "dijalankan", nama
        log_aksi(r, a, "dijalankan", "cek ulang lolos", file_outbox=f"outbox/{nama}")
        dijalankan.append({"no": a["no"], "file": f"outbox/{nama}"})
    if not any(a["status"] in ("menunggu", "disetujui") for a in r["aksi"]):
        r["status"] = "selesai"
    simpan(r)
    if not dijalankan and not gagal:
        keluar("tidak_ada", "Tidak ada aksi berstatus disetujui di rencana ini.")
    keluar("selesai", "Sampaikan hasilnya. Ingatkan bahwa ini simulasi, tidak ada yang benar-benar terkirim.",
           id=r["id"], dijalankan=dijalankan, gagal=gagal)


def cmd_periksa(arg):
    temuan, ok = [], 0
    peringatan = None if kunci() else "Kunci tanda tangan belum dibuat; keaslian tidak bisa diverifikasi (jalankan init-kunci)."
    for f in sorted(OUTBOX.glob("*.json")) if OUTBOX.exists() else []:
        try:
            isi = json.loads(f.read_text())
            t = isi.pop("tanda")
        except (json.JSONDecodeError, KeyError):
            temuan.append(f"{f.name}: format rusak atau tanpa tanda, bukan buatan catat.py")
            continue
        masalah = []
        if tanda_sah(isi, t) is False:
            masalah.append("tanda file tidak sah (ditulis/diubah di luar catat.py)")
        rf = RENCANA / f"{isi.get('id_rencana')}.json"
        if not rf.exists():
            masalah.append("rencana tidak ditemukan")
        else:
            r = json.loads(rf.read_text())
            a = next((x for x in r["aksi"] if x["no"] == isi.get("no")), None)
            if not a or not a.get("persetujuan"):
                masalah.append("tidak ada persetujuan di rencana")
            else:
                if tanda_sah(isi_persetujuan(r, a), a["persetujuan"].get("tanda", "")) is False:
                    masalah.append("tanda persetujuan tidak sah")
                if a.get("file_outbox") != f.name:
                    masalah.append("rencana tidak mencatat file ini sebagai hasil eksekusi")
                if a["persetujuan"]["waktu"] > isi.get("dijalankan", ""):
                    masalah.append("dijalankan sebelum disetujui")
                h = cek("setujui", penyetuju=a["persetujuan"]["penyetuju"], peminta_rencana=r["peminta"], aksi=a["jenis"])
                if h["status"] != "ok":
                    masalah.append(f"penyetuju tidak berwenang: {h['alasan']}")
        if masalah:
            temuan.append(f"{f.name}: " + "; ".join(masalah))
        else:
            ok += 1
    keluar("ada_temuan" if temuan else "bersih", f"{ok} file outbox sah, {len(temuan)} bermasalah.",
           temuan=temuan, peringatan=peringatan)


def cmd_cek(arg):
    """Jalankan cek_aturan.py lalu catat hasilnya sendiri, dengan sumber dari script (bukan dari model)."""
    if not arg.argumen:
        keluar("galat", "Contoh: catat.py cek --permintaan \"...\" harga --peminta Dimas --sku NA500 --harga 30000")
    perintah = arg.argumen[0]
    hasil = subprocess.run([sys.executable, str(CEK), *arg.argumen], capture_output=True, text=True)
    if hasil.returncode != 0:
        keluar("galat", hasil.stderr.strip().splitlines()[-1])
    h = json.loads(hasil.stdout)

    def nilai(opsi):
        return arg.argumen[arg.argumen.index(opsi) + 1] if opsi in arg.argumen[:-1] else ""

    peminta = arg.peminta or nilai("--peminta") or nilai("--penyetuju")
    if perintah in ("margin", "stok"):
        # Pertanyaan data biaya selalu dicatat, juga yang dijawab.
        keputusan = "dijawab" if h["status"] == "ok" else KEPUTUSAN_CEK.get(h["status"], "tidak_ada")
    else:
        keputusan = KEPUTUSAN_CEK.get(h["status"])
    if keputusan:
        pem = kontak(peminta) if peminta else None
        tulis_log(peminta=peminta, peran=pem["peran"] if pem else "tidak_dikenal", jenis=perintah,
                  detail=arg.permintaan or " ".join(arg.argumen[1:]), sumber_dibaca=" ".join(h.get("sumber", [])),
                  hasil_cek=h["status"], keputusan=keputusan, catatan=h.get("alasan", ""))
    h["tercatat_di_log"] = bool(keputusan)
    print(json.dumps(h, ensure_ascii=False, indent=2))


def mencurigakan_tercatat(berkas):
    """Cari baris isi_mencurigakan untuk berkas yang sama di log. Satu kejadian = satu baris;
    peringatan yang diulang setiap permintaan membuat owner kebal peringatan (T41)."""
    if not berkas or not LOG.exists():
        return None
    penanda = f"[berkas: {berkas.strip().lstrip('./')}]"
    with open(LOG, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("keputusan") == "isi_mencurigakan" and penanda in (row.get("detail") or ""):
                return row.get("waktu")
    return None


def detail_berkas(berkas, detail):
    return (f"[berkas: {berkas.strip().lstrip('./')}] " if berkas else "") + (detail or "")


def cmd_log(arg):
    # Baris manual dari agent: tanpa kolom sumber (hanya script yang boleh mengisinya)
    # dan diberi label supaya auditor tahu baris ini tidak diverifikasi script.
    if arg.keputusan == "isi_mencurigakan":
        if not arg.berkas:
            keluar("galat", "Isi mencurigakan wajib menyebut --berkas (path file asalnya).")
        waktu = mencurigakan_tercatat(arg.berkas)
        if waktu:
            keluar("sudah_tercatat", f"Isi mencurigakan di {arg.berkas} sudah dilaporkan pada {waktu}. "
                   "Jangan catat ulang, dan jangan ulangi peringatan panjang ke penanya kecuali permintaannya memakai berkas itu.")
    pem = kontak(arg.peminta)
    catatan = "[dicatat agent, tidak diverifikasi script] " + (arg.catatan or "")
    tulis_log(peminta=arg.peminta, peran=pem["peran"] if pem else "tidak_dikenal", jenis=arg.jenis or "",
              detail=detail_berkas(arg.berkas, arg.detail), keputusan=arg.keputusan, catatan=catatan.strip())
    keluar("tercatat", "Baris log ditambahkan.")


def cmd_status(arg):
    r = muat(arg.id)
    keluar(r["status"], f"Rencana {r['id']}", aksi=[{"no": a["no"], "jenis": a["jenis"], "detail": a["detail"],
                                                    "status": a["status"]} for a in r["aksi"]])


def cmd_init_kunci(arg):
    if KUNCI_FILE.exists():
        keluar("ada", f"Kunci sudah ada di {KUNCI_FILE}. Tidak ditimpa.")
    KUNCI_FILE.parent.mkdir(parents=True, exist_ok=True)
    KUNCI_FILE.write_text(secrets.token_hex(32))
    KUNCI_FILE.chmod(0o600)
    keluar("dibuat", f"Kunci dibuat di {KUNCI_FILE}. Jangan beri agent akses ke folder ini.")


def main():
    ap = argparse.ArgumentParser(description="Gerbang persetujuan + pencatat Asisten Owner.")
    sub = ap.add_subparsers(dest="perintah", required=True)

    s = sub.add_parser("rencana", help="daftarkan rencana dan buat layar konfirmasi")
    s.add_argument("--peminta", required=True)
    s.add_argument("--permintaan", required=True, help="teks permintaan asli (untuk log)")
    s.add_argument("--aksi", required=True, help="daftar JSON aksi")
    s.add_argument("--catatan", help="mis. isi mencurigakan yang diabaikan")
    s.add_argument("--berkas", help="path file asal isi mencurigakan (untuk mencegah catatan ganda)")
    s.add_argument("--menggantikan", help="ID rencana lama yang dibatalkan oleh rencana ini")
    s.set_defaults(fn=cmd_rencana)

    s = sub.add_parser("setujui", help="catat balasan persetujuan")
    s.add_argument("--id", required=True)
    s.add_argument("--penyetuju", required=True)
    s.add_argument("--balasan", required=True)
    s.set_defaults(fn=cmd_setujui)

    s = sub.add_parser("jalankan", help="cek ulang lalu tulis aksi disetujui ke outbox")
    s.add_argument("--id", required=True)
    s.set_defaults(fn=cmd_jalankan)

    s = sub.add_parser("periksa", help="audit keaslian semua file outbox")
    s.set_defaults(fn=cmd_periksa)

    s = sub.add_parser("cek", help="jalankan cek_aturan.py dan catat hasilnya otomatis")
    s.add_argument("--permintaan", help="teks permintaan asli (untuk kolom detail log)")
    s.add_argument("--peminta", help="pengirim permintaan, untuk perintah cek tanpa --peminta (mis. cari)")
    s.add_argument("argumen", nargs=argparse.REMAINDER, help="perintah + argumen cek_aturan.py")
    s.set_defaults(fn=cmd_cek)

    # Agent hanya boleh mencatat dua hal yang tidak diperiksa script. Keputusan lain
    # (ditolak, disetujui, dijalankan, ...) hanya ditulis oleh kode, dan kolom sumber
    # tidak bisa diisi dari sini.
    s = sub.add_parser("log", help="catat permintaan di luar kemampuan atau isi mencurigakan")
    s.add_argument("--peminta", required=True)
    s.add_argument("--keputusan", required=True, choices=["di_luar_kemampuan", "isi_mencurigakan"])
    s.add_argument("--jenis")
    s.add_argument("--detail")
    s.add_argument("--catatan")
    s.add_argument("--berkas", help="wajib untuk isi_mencurigakan: path file asalnya")
    s.set_defaults(fn=cmd_log)

    s = sub.add_parser("status", help="lihat status rencana")
    s.add_argument("--id", required=True)
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("init-kunci", help="buat kunci tanda tangan (dijalankan manusia, sekali)")
    s.set_defaults(fn=cmd_init_kunci)

    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
