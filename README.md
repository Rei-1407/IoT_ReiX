# 🏠 ReiX Home Monitor

Theo dõi **nhiệt độ — độ ẩm — ánh sáng** trong nhà realtime, kèm **cảnh báo cháy** đẩy về điện thoại. Không cần backend, không cần database — web tĩnh đọc thẳng dữ liệu từ MQTT broker.

> Đây là bản rút gọn cho nhu cầu sử dụng thực tế (branch `home-monitor`).
> Bản đầy đủ cho môn học (backend + MySQL + điều khiển thiết bị) nằm ở branch `main`.

## 🏗️ Kiến trúc

```
ESP32 (SHT31 + BH1750 + 3 LED hiệu ứng)
    │
    ├── MQTT/TLS (8883) ──► HiveMQ Cloud ◄── WebSocket (8884) ── Web tĩnh (GitHub Pages, PWA)
    │                       (retained + LWT)                      3 card + biểu đồ realtime
    │
    └── HTTPS ──► ntfy.sh ──► 🔥 Báo cháy đẩy về điện thoại (kể cả khi không mở app)
```

- **Không có server nào của mình phải chạy cả** — chỉ cần ESP32 cắm điện + WiFi.
- Web mở lên thấy ngay giá trị mới nhất nhờ MQTT retained message.
- ESP32 rớt mạng → broker tự phát Last Will → web hiện "Cảm biến Offline".

## 📁 Cấu trúc

```
IoT_ReiX/
├── IoT/
│   ├── IoT.ino               # Firmware ESP32
│   ├── secrets.h             # WiFi + MQTT + ntfy (KHÔNG commit — tự tạo)
│   └── secrets.h.example     # File mẫu, copy thành secrets.h rồi điền
├── frontend/                 # React → build ra web tĩnh (PWA)
│   ├── public/
│   │   ├── mqtt.min.js       # MQTT.js bundle (kết nối broker từ trình duyệt)
│   │   ├── manifest.json     # PWA manifest (cài như app)
│   │   └── sw.js             # Service worker (offline + notification)
│   └── src/
│       ├── App.js            # Kết nối MQTT WebSocket, state
│       └── pages/Dashboard.* # 1 trang duy nhất: 3 card + chart + panel cảnh báo
└── .github/workflows/deploy.yml  # Tự động build + deploy GitHub Pages
```

## 💡 7 LED hiệu ứng trên ESP32 (giữ nguyên chân từ bản cũ)

| LED | GPIO | Ý nghĩa |
| --- | ---- | ------- |
| 🔴 Đỏ | 23 | Nhiệt độ (PWM): 20°C bắt đầu sáng → 45°C sáng max. **Quá 40°C: nhấp nháy báo cháy** |
| 🔵 Xanh dương | 19 | Độ ẩm (PWM): 40% bắt đầu sáng → 90% sáng max |
| 🟡 Vàng | 18 | Ánh sáng (PWM): trời càng tối đèn càng sáng (≥ 300 lux thì tắt) |
| 💡 Thang nhiệt 1/2/3 | 15, 2, 4 | Mức nhiệt: ≥25°C sáng 1 đèn, ≥28°C sáng 2, ≥31°C sáng 3 |
| 🚨 Cảnh báo | 5 | Chớp nhanh khi báo cháy; chớp chậm khi đang mất kết nối WiFi/MQTT |

Nối LED qua điện trở ~220Ω xuống GND.

## 🔥 Cảnh báo cháy (ngưỡng 40°C)

1. **Trên web/app đang mở**: banner đỏ + notification hệ thống (bấm nút 🔔 trên dashboard để cấp quyền).
2. **Khi không mở app**: ESP32 tự bắn cảnh báo lên **ntfy.sh** — cài app ntfy (Android/iOS), subscribe topic (xem trên dashboard) là nhận được. Nhắc lại mỗi 5 phút nếu còn cháy, hết cháy khi nhiệt hạ dưới 35°C.

## 🚀 Cách chạy

### ESP32

1. Copy `IoT/secrets.h.example` → `IoT/secrets.h`, điền WiFi + tài khoản HiveMQ + topic ntfy
2. Mở `IoT/IoT.ino` bằng Arduino IDE, chọn board ESP32 Dev Module, Upload
3. Xong — ESP32 tự kết nối WiFi (2 mạng, tự fallback) và publish mỗi 2 giây

### Web

Tự động: push lên branch `home-monitor` là GitHub Actions build + deploy GitHub Pages.

Chạy local để dev:

```bash
cd frontend
npm install
npm start
```

### Cài web thành app (PWA)

- **Android/PC (Chrome/Edge)**: mở web → menu → "Cài đặt ứng dụng"
- **iPhone (Safari)**: mở web → Chia sẻ → "Thêm vào Màn hình chính"

## 🔐 Bảo mật

- `secrets.h` (WiFi, mật khẩu MQTT của ESP32) **không được commit** — đã gitignore.
- Web tĩnh dùng user HiveMQ **chỉ-đọc** (`webviewer`, Subscribe only) nên có công khai trong source cũng không ai ghi đè được dữ liệu.

## 🔌 MQTT Topics

| Topic | Publisher | Dữ liệu |
| ----- | --------- | ------- |
| `reix/sensor` | ESP32 | `{temp, hum, lux, fire}` — mỗi 2 giây, retained |
| `reix/status` | ESP32 / LWT | `{online: true/false}` — retained |

## 👤 Tác giả

Giang Hoàng Long (Rei) — PTIT · [GitHub](https://github.com/Rei-1407/IoT_ReiX)
