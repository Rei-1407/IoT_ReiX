// ============================================
// server.js — Entry point cho Backend
// Kết nối: MySQL + MQTT + WebSocket + REST API
// ============================================

const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");
require("dotenv").config();

// ===== Khởi tạo Express =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== Khởi tạo HTTP Server + WebSocket Server =====
// Dùng chung 1 HTTP server cho cả REST API và WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ===== Kết nối MySQL =====
const db = require("./config/db");

// ===== Kết nối MQTT =====
const mqttClient = require("./config/mqtt");

// ============================================
// WEBSOCKET — Quản lý client connections
// Mỗi khi frontend mở trang, nó connect WebSocket
// Backend push data realtime qua đây
// ============================================
const wsClients = new Set();

wss.on("connection", (ws) => {
  wsClients.add(ws);
  console.log(`🔌 WebSocket client connected (total: ${wsClients.size})`);

  ws.on("close", () => {
    wsClients.delete(ws);
    console.log(`🔌 WebSocket client disconnected (total: ${wsClients.size})`);
  });
});

// Hàm broadcast: gửi data tới TẤT CẢ frontend đang kết nối
function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  wsClients.forEach((client) => {
    if (client.readyState === 1) {
      // 1 = OPEN
      client.send(message);
    }
  });
}

// ============================================
// MQTT MESSAGE HANDLER
// Nhận data từ ESP32 → Lưu DB → Push WebSocket
// ============================================
mqttClient.on("message", async (topic, payload) => {
  try {
    const message = JSON.parse(payload.toString());
    // Cập nhật thời gian nhận message cuối cùng
    lastMqttMessage = Date.now();
    if (!esp32Online) {
      esp32Online = true;
      broadcast("esp32_status", { online: true });
    }
    const now = Date.now();
    const timeText = new Date().toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    });

    // ===== TOPIC: sensor =====
    // ESP32 gửi: { temp: 22.92, hum: 58.57, lux: 355.83 }
    // Backend tách thành 3 row trong sensor_readings
    if (topic === "sensor") {
      const sensorMap = {
        temp: { id: 1, key: "temperature" },
        hum: { id: 2, key: "humidity" },
        lux: { id: 3, key: "light" },
      };

      const readings = [];

      for (const [field, info] of Object.entries(sensorMap)) {
        if (message[field] !== undefined) {
          await db.execute(
            "INSERT INTO sensor_readings (sensor_id, ts_ms, value_num, time_text) VALUES (?, ?, ?, ?)",
            [info.id, now, message[field], timeText],
          );
          readings.push({
            sensor_id: info.id,
            sensor_key: info.key,
            value: message[field],
            time_text: timeText,
          });
        }
      }

      // Push realtime tới frontend
      broadcast("sensor_data", {
        temp: message.temp,
        hum: message.hum,
        lux: message.lux,
        time_text: timeText,
        readings,
      });
    }

    // ===== TOPIC: device =====
    // ESP32 gửi: { auto: true, fire: 0, ac: 0, light: 0, fan: 0 }
    // Backend cập nhật bảng device_state
    if (topic === "device") {
      const deviceMap = {
        fire: { id: 1 },
        light: { id: 2 },
        fan: { id: 3 },
        ac: { id: 4 },
      };

      for (const [key, info] of Object.entries(deviceMap)) {
        if (message[key] !== undefined) {
          const value = Number(message[key]);
          const isOn = value > 0 ? 1 : 0;

          await db.execute(
            "UPDATE device_state SET is_on = ?, level = ?, updated_at = NOW() WHERE device_id = ?",
            [isOn, value, info.id],
          );
        }
      }

      // Push trạng thái mới tới frontend
      broadcast("device_state", {
        auto: message.auto,
        fire: message.fire,
        light: message.light,
        fan: message.fan,
        ac: message.ac,
      });
    }

    // ===== TOPIC: status =====
    // ESP32 gửi: { action: "fan", expected: 2, actual: 2, result: "success" }
    // Backend cập nhật device_history: PENDING → SUCCESS/FAILED
    if (topic === "status") {
      const result = message.result === "success" ? "SUCCESS" : "FAILED";

      // Tìm record PENDING gần nhất của device này và cập nhật
      await db.execute(
        `UPDATE device_history 
         SET status = ?, resolved_ts_ms = ?, resolved_at = NOW() 
         WHERE device_id = (SELECT id FROM devices WHERE device_key = ?)
           AND status = 'PENDING' 
         ORDER BY created_ts_ms DESC 
         LIMIT 1`,
        [result, now, message.action],
      );

      // Push kết quả tới frontend
      broadcast("control_result", {
        action: message.action,
        expected: message.expected,
        actual: message.actual,
        result: result,
      });
    }
  } catch (err) {
    console.error("❌ MQTT message handler error:", err.message);
  }
});

// ============================================
// ESP32 ONLINE/OFFLINE DETECTION
// Nếu > 6 giây không nhận MQTT message → offline
// ============================================
let lastMqttMessage = Date.now();
let esp32Online = false;

// Cập nhật mỗi khi nhận MQTT message (đã có trong handler ở trên)
// Ta cần thêm vào đầu handler

// Check mỗi 3 giây
setInterval(() => {
  const now = Date.now();
  const wasOnline = esp32Online;
  esp32Online = now - lastMqttMessage < 6000;

  // Chỉ broadcast khi trạng thái thay đổi
  if (wasOnline !== esp32Online) {
    broadcast("esp32_status", { online: esp32Online });
  }
}, 3000);

// ============================================
// REST API ROUTES (sẽ tạo chi tiết ở bước sau)
// ============================================
const sensorRoutes = require("./routes/sensor");
const deviceRoutes = require("./routes/device");
const historyRoutes = require("./routes/history");

app.use("/api/sensors", sensorRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/history", historyRoutes);

// ===== Health check + ESP32 status =====
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    esp32_online: esp32Online,
  });
});

// ============================================
// SWAGGER API DOCS
// Truy cập tại: http://localhost:5000/api-docs
// ============================================
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "IoT ReiX SmartHome API",
      version: "1.0.0",
      description:
        "API Documentation cho hệ thống IoT SmartHome — Quản lý cảm biến và điều khiển thiết bị qua MQTT + WebSocket",
      contact: {
        name: "Giang Hoàng Long",
        email: "LongGH.B22PT145@stu.ptit.edu.vn",
      },
    },
    servers: [
      { url: "http://localhost:5000", description: "Local Development" },
    ],
    components: {
      schemas: {
        SensorReading: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            sensor_name: { type: "string", example: "Nhiệt độ" },
            sensor_key: { type: "string", example: "temperature" },
            unit: { type: "string", example: "°C" },
            value_num: { type: "number", example: 22.92 },
            time_text: { type: "string", example: "16:37:22 01/02/2026" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        DeviceState: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            device_key: { type: "string", example: "fan" },
            device_name: { type: "string", example: "Quạt gió" },
            is_on: { type: "integer", example: 1 },
            level: { type: "integer", example: 2 },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        DeviceHistory: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            device_name: { type: "string", example: "Quạt gió" },
            device_key: { type: "string", example: "fan" },
            action: { type: "string", enum: ["ON", "OFF"], example: "ON" },
            status: {
              type: "string",
              enum: ["PENDING", "SUCCESS", "FAILED"],
              example: "SUCCESS",
            },
            time_text: { type: "string", example: "16:37:22 01/02/2026" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 10 },
            total: { type: "integer", example: 150 },
            totalPages: { type: "integer", example: 15 },
          },
        },
        ControlRequest: {
          type: "object",
          required: ["device_key", "value"],
          properties: {
            device_key: {
              type: "string",
              enum: ["fire", "light", "fan", "ac"],
              example: "fan",
            },
            value: {
              type: "integer",
              description: "fire/light: 0-1, fan: 0-3, ac: 0-255",
              example: 2,
            },
          },
        },
      },
    },
    paths: {
      "/api/sensors": {
        get: {
          tags: ["Sensor Data"],
          summary: "Lấy dữ liệu cảm biến (có phân trang, lọc, tìm kiếm)",
          description:
            "Backend xử lý toàn bộ: phân trang, lọc theo loại, tìm kiếm theo thời gian, sắp xếp. Frontend chỉ truyền query params.",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
              description: "Số trang",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
              description: "Số record mỗi trang",
            },
            {
              name: "type",
              in: "query",
              schema: {
                type: "string",
                enum: ["temperature", "humidity", "light"],
              },
              description: "Lọc theo loại cảm biến",
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Tìm theo thời gian (VD: 16:37, 01/02)",
            },
            {
              name: "sort",
              in: "query",
              schema: {
                type: "string",
                enum: ["asc", "desc"],
                default: "desc",
              },
              description: "Sắp xếp theo thời gian",
            },
          ],
          responses: {
            200: {
              description: "Danh sách sensor readings + thông tin phân trang",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/SensorReading" },
                      },
                      pagination: { $ref: "#/components/schemas/Pagination" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/devices/state": {
        get: {
          tags: ["Device Control"],
          summary: "Lấy trạng thái hiện tại của tất cả thiết bị",
          description:
            "Dùng khi reload web — Frontend gọi API này để hiển thị đúng trạng thái, không reset về OFF.",
          responses: {
            200: {
              description: "Trạng thái 4 thiết bị",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DeviceState" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/devices/control": {
        post: {
          tags: ["Device Control"],
          summary: "Gửi lệnh điều khiển thiết bị",
          description:
            "Frontend gửi request → Backend lưu history(PENDING) → publish MQTT → ESP32 thực thi → phản hồi qua WebSocket. Timeout 10s nếu không phản hồi → FAILED.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ControlRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Lệnh đã gửi thành công, đang chờ ESP32 phản hồi",
            },
            400: { description: "Thiếu device_key" },
            404: { description: "Không tìm thấy thiết bị" },
          },
        },
      },
      "/api/history": {
        get: {
          tags: ["Action History"],
          summary:
            "Lấy lịch sử điều khiển thiết bị (có phân trang, lọc, tìm kiếm)",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
              description: "Số trang",
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
              description: "Số record mỗi trang",
            },
            {
              name: "device",
              in: "query",
              schema: { type: "string", enum: ["fire", "light", "fan", "ac"] },
              description: "Lọc theo thiết bị",
            },
            {
              name: "search",
              in: "query",
              schema: { type: "string" },
              description: "Tìm theo thời gian",
            },
            {
              name: "sort",
              in: "query",
              schema: {
                type: "string",
                enum: ["asc", "desc"],
                default: "desc",
              },
              description: "Sắp xếp",
            },
          ],
          responses: {
            200: {
              description: "Lịch sử điều khiển + phân trang",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/DeviceHistory" },
                      },
                      pagination: { $ref: "#/components/schemas/Pagination" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "Kiểm tra server còn sống không",
          responses: { 200: { description: "Server OK" } },
        },
      },
    },
  },
  apis: [], // Không cần scan file vì đã define trực tiếp ở trên
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "IoT ReiX — API Documentation",
  }),
);

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}`);
  console.log(`📖 API docs will be at http://localhost:${PORT}/api-docs`);
});
