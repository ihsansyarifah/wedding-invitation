from pathlib import Path
import re

INDEX = Path("index.html")
text = INDEX.read_text(encoding="utf-8")

replacements = {
    "Website Undangan Pernikahan Wahyu dan Riski Secara Online": "Website Undangan Pernikahan Ihsan dan Syarifah Secara Online",
    "Wahyu &amp; Riski": "Ihsan &amp; Syarifah",
    "Wahyu & Riski": "Ihsan & Syarifah",
    "Rabu, 15 Maret 2023": "Minggu, 20 Desember 2026",
    "2024-01-01 09:30:00": "2026-12-20 08:00:00",
    "Nama Wahyu Siapa": "Ihsan Fauzi Noor, S.T.",
    "Putra ke-1": "Putra ke-2",
    "Bapak lorem ipsum": "Bapak Budiono",
    "Ibu lorem ipsum": "Ibu Komsiah",
    "Nama Riski Siapa": "Syarifah Umaimah, S.T.",
    "Putri ke-2": "Putri ke-1",
    "Pukul 10.00 WIB - Selesai": "Pukul 08.00 WIB",
    "Pukul 13.00 WIB - Selesai": "Pukul 11.00 - 14.00 WIB",
    "https://goo.gl/maps/ALZR6FJZU3kxVwN86": "https://maps.app.goo.gl/ZE22JnR6oJbwiCnZA",
    "RT 10 RW 02, Desa Pajerukan, Kec. Kalibagor, Kab. Banyumas, Jawa Tengah 53191.": "Masjid Cibadak Daarul Matiin, Kecamatan Cibadak, Kabupaten Sukabumi.",
    "Riski Siapa?": "Ihsan Fauzi Noor",
    "Bank Central Asia": "Bank Mandiri",
    "1234567891234": "1760002827994",
    "0812345678": "0896 2041 1169",
    "Wahyu Siapa?": "Ihsan Fauzi Noor",
}
for old, new in replacements.items():
    text = text.replace(old, new)

text = re.sub(r'<meta name="og:image:alt" content="[^"]*">',
              '<meta name="og:image:alt" content="Website Undangan Pernikahan Ihsan dan Syarifah Secara Online">', text)
text = re.sub(r'<meta name="apple-mobile-web-app-title" content="[^"]*">',
              '<meta name="apple-mobile-web-app-title" content="Website Undangan Pernikahan Ihsan dan Syarifah Secara Online">', text)
text = re.sub(r'<meta property="og:site_name" content="[^"]*">',
              '<meta property="og:site_name" content="Website Undangan Pernikahan Ihsan dan Syarifah Secara Online">', text)

# Remove fictional Love Story.
text = re.sub(
    r'\s*<!-- Love Story -->.*?(?=\s*<!-- Wave Separator -->)',
    '\n                <!-- Love Story removed until real story data is provided -->\n',
    text, flags=re.S
)

# Remove template QRIS card.
text = re.sub(
    r'\s*<div class="bg-theme-auto rounded-4 shadow p-3 mx-4 mt-4 text-start" data-aos="fade-up" data-aos-duration="2500">\s*'
    r'<i class="fa-solid fa-qrcode fa-lg"></i>.*?</div>\s*'
    r'(?=\s*<div class="bg-theme-auto rounded-4 shadow p-3 mx-4 mt-4 text-start" data-aos="fade-up" data-aos-duration="2500">)',
    '\n', text, flags=re.S
)

# Replace Gift card.
gift_pattern = (
    r'<div class="bg-theme-auto rounded-4 shadow p-3 mx-4 mt-4 text-start" '
    r'data-aos="fade-up" data-aos-duration="2500">\s*'
    r'<i class="fa-solid fa-gift fa-lg"></i>.*?</div>\s*</div>'
)
gift_replacement = """<div class="bg-theme-auto rounded-4 shadow p-3 mx-4 mt-4 text-start" data-aos="fade-up" data-aos-duration="2500">
                            <i class="fa-solid fa-gift fa-lg"></i>
                            <p class="d-inline">Gift</p>
                            <div class="d-flex justify-content-between align-items-center mt-2">
                                <p class="m-0 p-0" style="font-size: 0.95rem;"><i class="fa-regular fa-user fa-sm me-1"></i>Ihsan Fauzi Noor</p>
                                <button class="btn btn-outline-auto btn-sm shadow-sm rounded-4 py-0" style="font-size: 0.75rem;" data-bs-toggle="collapse" data-bs-target="#collapseGift"><i class="fa-solid fa-circle-info fa-sm me-1"></i>Info</button>
                            </div>
                            <div class="collapse" id="collapseGift">
                                <hr class="my-2 py-1">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <p class="m-0 p-0" style="font-size: 0.85rem;"><i class="fa-solid fa-wallet me-1"></i>GoPay: 0896 2041 1169</p>
                                    <button class="btn btn-outline-auto btn-sm shadow-sm rounded-4 py-0" style="font-size: 0.75rem;" data-copy="089620411169" onclick="undangan.util.copy(this)"><i class="fa-solid fa-copy"></i></button>
                                </div>
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <p class="m-0 p-0" style="font-size: 0.85rem;"><i class="fa-solid fa-wallet me-1"></i>DANA: 0896 2041 1169</p>
                                    <button class="btn btn-outline-auto btn-sm shadow-sm rounded-4 py-0" style="font-size: 0.75rem;" data-copy="089620411169" onclick="undangan.util.copy(this)"><i class="fa-solid fa-copy"></i></button>
                                </div>
                                <div class="d-flex justify-content-between align-items-center">
                                    <p class="my-0 p-0 text-truncate me-2" style="font-size: 0.85rem;"><i class="fa-solid fa-location-dot me-1"></i>4Q7G+HHQ, Cibadak, Kec. Cibadak, Kabupaten Sukabumi, Jawa Barat 43351</p>
                                    <button class="btn btn-outline-auto btn-sm shadow-sm rounded-4 py-0" style="font-size: 0.75rem;" data-copy="4Q7G+HHQ, Cibadak, Kec. Cibadak, Kabupaten Sukabumi, Jawa Barat 43351" onclick="undangan.util.copy(this)"><i class="fa-solid fa-copy"></i></button>
                                </div>
                                <div class="text-center mt-2">
                                    <a href="https://maps.app.goo.gl/QKBMKZReS21ZSrjD7" target="_blank" class="btn btn-outline-auto btn-sm rounded-pill shadow px-3"><i class="fa-solid fa-map-location-dot me-2"></i>Lokasi Kirim Kado</a>
                                </div>
                            </div>
                        </div>"""
text, gift_count = re.subn(gift_pattern, gift_replacement, text, count=1, flags=re.S)

# Add akad QR code.
marker = '<small class="d-block my-1">Masjid Cibadak Daarul Matiin, Kecamatan Cibadak, Kabupaten Sukabumi.</small>'
qr_block = marker + """
                            <div class="mt-3">
                                <img src="./assets/images/lokasi-akad-qrcode.png" alt="QR Code Lokasi Akad" class="img-fluid rounded-3 shadow-sm mx-auto d-block" style="width: 180px; max-width: 70%;">
                                <small class="d-block mt-2">Scan untuk membuka lokasi akad di Google Maps</small>
                            </div>"""
text = text.replace(marker, qr_block)

INDEX.write_text(text, encoding="utf-8")
print("index.html berhasil diperbarui.")
if gift_count != 1:
    print("PERINGATAN: Gift card tidak berhasil diganti tepat satu kali.")
