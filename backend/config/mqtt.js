// ============================================
// config/mqtt.js — Kết nối MQTT Mosquitto
// Backend đóng vai trò:
//   - Subscribe topic "sensor" → nhận data cảm biến từ ESP32
//   - Subscribe topic "device" → nhận trạng thái thiết bị từ ESP32
//   - Subscribe topic "status" → nhận kết quả điều khiển từ ESP32
//   - Publish topic "control"  → gửi lệnh điều khiển xuống ESP32
// ============================================

const mqtt = require("mqtt");
require("dotenv").config();

const MQTT_OPTIONS = {
  port: parseInt(process.env.MQTT_PORT),
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: "backend-iot-reix-" + Date.now(),
  reconnectPeriod: 3000, // Tự reconnect sau 3 giây nếu mất kết nối
  connectTimeout: 10000, // Timeout 10 giây khi connect
};

const mqttClient = mqtt.connect(process.env.MQTT_HOST, MQTT_OPTIONS);

// ===== Sự kiện kết nối thành công =====
mqttClient.on("connect", () => {
  console.log(
    "✅ MQTT connected — broker:",
    process.env.MQTT_HOST,
    "port:",
    process.env.MQTT_PORT,
  );

  // Subscribe 3 topic nhận data từ ESP32
  mqttClient.subscribe(["sensor", "device", "status"], (err) => {
    if (err) {
      console.error("❌ MQTT subscribe failed:", err.message);
    } else {
      console.log("✅ MQTT subscribed: sensor, device, status");
    }
  });
});

// ===== Sự kiện mất kết nối =====
mqttClient.on("error", (err) => {
  console.error("❌ MQTT error:", err.message);
});

mqttClient.on("offline", () => {
  console.log("⚠️ MQTT offline — đang reconnect...");
});

module.exports = mqttClient;
