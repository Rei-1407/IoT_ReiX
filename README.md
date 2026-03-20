# 🏠 IoT ReiX — Smart Home System
 
Hệ thống IoT SmartHome giám sát và điều khiển thiết bị thông minh trong nhà ở.
 
## 📋 Thông tin
 
| Tiêu chí | Chi tiết |
|----------|----------|
| **Sinh viên** | Giang Hoàng Long |
| **MSSV** | B22DCPT145 |
| **Trường** | Học viện Công nghệ Bưu chính Viễn thông (PTIT) |
| **Môn học** | IoT (Internet of Things) - Ứng dụng |
 
## 🏗️ Kiến trúc hệ thống
 
```
ESP32 ──(MQTT)──► Mosquitto Broker ──► Backend (Node.js)
                                            │
                                            ├── MySQL Database
                                            │
                                            └── WebSocket ──► React Frontend
```
 
## 🛠️ Tech Stack
 
| Thành phần | Công nghệ |
|-----------|-----------|
| **Hardware** | ESP32, SHT31, BH1750, LED |
| **MQTT Broker** | Mosquitto (Port 1407) |
| **Backend** | Node.js, Express, mysql2, mqtt, ws |
| **Frontend** | React.js, Recharts, Axios |
| **Database** | MySQL |
| **API Docs** | Swagger UI |
 
## 📁 Cấu trúc dự án
 
```
IoT_ReiX/
├── IoT/                  # Code ESP32 (Arduino)
│   └── IoT.ino
├── backend/              # Backend Node.js
│   ├── config/
│   │   ├── db.js         # Kết nối MySQL
│   │   └── mqtt.js       # Kết nối MQTT
│   ├── routes/
│   │   ├── sensor.js     # API dữ liệu cảm biến
│   │   ├── device.js     # API điều khiển thiết bị
│   │   └── history.js    # API lịch sử hoạt động
│   ├── server.js         # Entry point
│   └── .env              # Biến môi trường
├── frontend/             # Frontend React
│   └── src/
│       ├── components/   # Sidebar, Layout
│       └── pages/        # Dashboard, DataSensor, ActionHistory, Profile
└── database.sql          # SQL Schema
```
 
## 🚀 Cách chạy
 
### 1. Database
- Mở MySQL Workbench
- Chạy file `database.sql`
 
### 2. Backend
```bash
cd backend
npm install
npm run dev
```
Server chạy tại: `http://localhost:5000`
API docs tại: `http://localhost:5000/api-docs`
 
### 3. Frontend
```bash
cd frontend
npm install
npm start
```
Web chạy tại: `http://localhost:3000`
 
### 4. MQTT Broker
```bash
mosquitto -c mosquitto.conf -v
```
 
### 5. Hardware
- Mở Arduino IDE
- Upload file `IoT/IoT.ino` lên ESP32
 
## 🌟 Tính năng
 
- ✅ Dashboard giám sát realtime (cập nhật mỗi 2 giây)
- ✅ Biểu đồ 3 đường: Nhiệt độ, Độ ẩm, Ánh sáng
- ✅ Điều khiển 4 thiết bị: Báo cháy, Đèn ngủ, Quạt gió (4 mức), Điều hòa (4 mode)
- ✅ Chế độ Auto / Manual
- ✅ 3 trạng thái nút: OFF → LOADING → ON
- ✅ Timeout 10 giây khi mất kết nối
- ✅ Reload web giữ nguyên trạng thái thiết bị
- ✅ Trang Data Sensor: tìm kiếm, lọc, sắp xếp, phân trang (xử lý ở Backend)
- ✅ Trang Action History: tìm kiếm, lọc, phân trang (xử lý ở Backend)
- ✅ Trang Profile: thông tin cá nhân, link tài liệu
- ✅ API Documentation (Swagger)
 
## 🔗 Links
 
| Tài liệu | Link |
|-----------|------|
| **Figma** | https://www.figma.com/design/BPzfNFCGqc96vAY7A6f4gq/IoT---SmartHome---GHL?node-id=31-504&t=RyoJqWOVg5OmH1l6-1 |
| **API Docs** | http://localhost:5000/api-docs |
| **GitHub** | https://github.com/Rei-1407/IoT_ReiX |
| **Báo cáo** | https://drive.google.com/file/d/1IfH4jPFTF3VJgNCdiNQo_t3S1-BFlHS4/view?usp=sharing |
