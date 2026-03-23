# 🏠 IoT ReiX — Smart Home System

Hệ thống IoT SmartHome giám sát và điều khiển thiết bị thông minh trong nhà ở.

## 📋 Thông tin

| Tiêu chí       | Chi tiết                                       |
| -------------- | ---------------------------------------------- |
| **Sinh viên**  | Giang Hoàng Long                               |
| **MSSV**       | B22DCPT145                                     |
| **Trường**     | Học viện Công nghệ Bưu chính Viễn thông (PTIT) |
| **Môn học**    | Phát triển ứng dụng Internet of Things         |
| **Giảng viên** | Nguyễn Quốc Uy                                 |
| **Nhóm lớp**   | 01                                             |

## 🏗️ Kiến trúc hệ thống

```
ESP32 (SHT31 + BH1750 + 6 LED)
    │
    │  MQTT (port 1407)
    ▼
Mosquitto Broker
    │
    ▼
Backend (Node.js + Express, port 5000)
    │
    ├── MySQL Database (iot_reix)
    │     ├── sensors / sensor_readings
    │     └── devices / device_state / device_history
    │
    ├── REST API + Swagger (/api-docs)
    │
    └── WebSocket (realtime push)
          │
          ▼
    Frontend (React.js, port 3000)
          ├── Dashboard (sensor cards + chart + control panel)
          ├── Data Sensor (bảng + tìm kiếm + phân trang)
          ├── Action History (bảng + tìm kiếm + phân trang)
          └── Profile (thông tin SV + links)
```

## 🛠️ Tech Stack

| Thành phần      | Công nghệ                                                   |
| --------------- | ----------------------------------------------------------- |
| **Hardware**    | ESP32 DevKit V1, SHT31 (I2C 0x44), BH1750 (I2C 0x23), 6 LED |
| **MQTT Broker** | Mosquitto (port 1407, auth: gianghoanglong)                 |
| **Backend**     | Node.js, Express, mysql2/promise, mqtt, ws, swagger-jsdoc   |
| **Frontend**    | React.js, Recharts, Axios, React Router, react-icons        |
| **Database**    | MySQL 8.0 (database: iot_reix, 5 bảng)                      |
| **API Docs**    | Swagger UI (localhost:5000/api-docs)                        |
| **Realtime**    | WebSocket (ws library)                                      |

## 📁 Cấu trúc dự án

```
IoT_ReiX/
├── IoT/                          # Code ESP32 (Arduino)
│   └── IoT.ino                   # WiFi + MQTT + I2C sensors + LED control
├── backend/                      # Backend Node.js
│   ├── config/
│   │   ├── db.js                 # MySQL pool connection
│   │   └── mqtt.js               # MQTT client (subscribe: sensor, device, status)
│   ├── routes/
│   │   ├── sensor.js             # GET /api/sensors (phân trang, lọc, tìm kiếm tiếng Việt)
│   │   ├── device.js             # GET /api/devices/state, POST /api/devices/control
│   │   └── history.js            # GET /api/history (phân trang, lọc, tìm kiếm tiếng Việt)
│   ├── server.js                 # Entry point (Express + WebSocket + MQTT + Swagger)
│   ├── .env                      # DB_HOST, DB_USER, DB_PASS, MQTT config
│   └── package.json
├── frontend/                     # Frontend React
│   ├── public/
│   │   ├── index.html            # Title: "IoT ReiX — SmartHome"
│   │   ├── Logo.png              # Favicon
│   │   └── avatar.png            # Ảnh đại diện trang Profile
│   └── src/
│       ├── components/
│       │   ├── Sidebar.js        # Nav, Online/Offline, đồng hồ realtime
│       │   ├── Sidebar.css
│       │   └── Layout.js         # Layout wrapper (Sidebar + content)
│       ├── pages/
│       │   ├── Dashboard.js/css  # 3 card sensor, biểu đồ Recharts, panel điều khiển
│       │   ├── DataSensor.js/css # Bảng cảm biến + filter + search + phân trang + export CSV
│       │   ├── ActionHistory.js/css # Bảng lịch sử + filter + search + phân trang + export CSV
│       │   └── Profile.js/css    # Thông tin SV + link Figma/Báo cáo/API docs/GitHub
│       ├── App.js                # State lifted: WebSocket 1 lần, truyền props cho Dashboard
│       ├── App.css               # Background gradient animation
│       └── index.css
├── database.sql                  # SQL tạo DB + 5 bảng + seed data
└── README.md
```

## 🔌 MQTT Topics

| Topic     | Publisher | Subscriber | Dữ liệu                                                   |
| --------- | --------- | ---------- | --------------------------------------------------------- |
| `sensor`  | ESP32     | Backend    | `{temp, hum, lux}` — mỗi 2 giây                           |
| `device`  | ESP32     | Backend    | `{auto, fire, ac, light, fan}` — trạng thái hiện tại      |
| `status`  | ESP32     | Backend    | `{action, expected, actual, result}` — confirm điều khiển |
| `control` | Backend   | ESP32      | `{action, val}` — lệnh điều khiển                         |

## 📊 Database (MySQL — iot_reix)

5 bảng: `sensors` (3 loại cảm biến), `sensor_readings` (dữ liệu theo thời gian), `devices` (4 thiết bị), `device_state` (trạng thái hiện tại, 1:1), `device_history` (lịch sử điều khiển với PENDING/SUCCESS/FAILED).

## 🚀 Cách chạy

### 1. Database

```bash
# Mở MySQL Workbench hoặc terminal
mysql -u root -p < database.sql
```

### 2. MQTT Broker

```bash
mosquitto -c mosquitto.conf -v
# Port: 1407, User: gianghoanglong, Pass: 14072004
```

### 3. Backend

```bash
cd backend
npm install
node server.js
```

- Server: `http://localhost:5000`
- API docs: `http://localhost:5000/api-docs`

### 4. Frontend

```bash
cd frontend
npm install
npm start
```

- Web: `http://localhost:3000`

### 5. Hardware

- Mở Arduino IDE
- Upload file `IoT/IoT.ino` lên ESP32
- WiFi SSID: `Rei`, Password: `12345678`
- ESP32 kết nối MQTT qua IP laptop hotspot: `192.168.137.1`

## 🌟 Tính năng

- ✅ Giám sát realtime 3 cảm biến (biểu đồ + card), cập nhật mỗi 2 giây
- ✅ Điều khiển 4 thiết bị có CONFIRM từ hardware (OFF → LOADING → ON)
- ✅ Chế độ Auto (ESP32 tự điều khiển theo ngưỡng) / Manual (user điều khiển)
- ✅ Timeout 10 giây: không phản hồi → hiện banner lỗi đỏ
- ✅ Reload web giữ nguyên trạng thái (nhờ bảng device_state)
- ✅ Detect ESP32 Online/Offline tự động (> 6s không MQTT → Offline)
- ✅ Tìm kiếm backend hỗ trợ tiếng Việt không dấu (nhiet → Nhiệt độ, bat → Bật)
- ✅ Phân trang backend (SQL LIMIT/OFFSET), dynamic limit theo chiều cao màn hình
- ✅ Filter thời gian (datetime-local picker, chỉ apply khi bấm "Áp dụng")
- ✅ Export CSV (cả 2 trang Data Sensor và Action History)
- ✅ Device animation: fire-glow, light-glow, fan-rotate (3 tốc độ), ac-vibrate (3 mức)
- ✅ Background gradient animation
- ✅ Swagger API Documentation
- ✅ Profile page với link Figma, Báo cáo, API docs, GitHub

## 🔧 API Endpoints

| Method | Endpoint               | Mô tả                                                            |
| ------ | ---------------------- | ---------------------------------------------------------------- |
| GET    | `/api/sensors`         | Dữ liệu cảm biến (phân trang, lọc, tìm kiếm, filter thời gian)   |
| GET    | `/api/devices/state`   | Trạng thái hiện tại 4 thiết bị                                   |
| POST   | `/api/devices/control` | Gửi lệnh điều khiển (`{device_key, value}`)                      |
| GET    | `/api/history`         | Lịch sử điều khiển (phân trang, lọc, tìm kiếm, filter thời gian) |
| GET    | `/api/health`          | Health check + ESP32 online status                               |

## 🤖 ESP32 Auto Mode — Ngưỡng điều khiển

| Thiết bị | Điều kiện                                       | Hành động          |
| -------- | ----------------------------------------------- | ------------------ |
| Báo cháy | temp > 50°C                                     | Bật                |
| Quạt gió | temp ≥ 25 / 28 / 31°C                           | Mức 1 / 2 / 3      |
| Điều hòa | temp > 28 → 80, hum > 80 → 150, temp > 32 → 255 | Sleep / Dry / Cool |
| Đèn ngủ  | lux < 100                                       | Bật                |

## 🔗 Links

| Tài liệu     | Link                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Figma**    | [IoT SmartHome Design](https://www.figma.com/design/BPzfNFCGqc96vAY7A6f4gq/IoT---SmartHome---GHL?node-id=31-504&t=lShU1mpzhQuiFHgP-1) |
| **Báo cáo**  | [Google Drive](https://drive.google.com/file/d/1IfH4jPFTF3VJgNCdiNQo_t3S1-BFlHS4/view?usp=sharing)                                    |
| **API Docs** | [Swagger UI](http://localhost:5000/api-docs)                                                                                          |
| **GitHub**   | [Rei-1407/IoT_ReiX](https://github.com/Rei-1407/IoT_ReiX)                                                                             |
