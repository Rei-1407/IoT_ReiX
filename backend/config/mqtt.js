// ============================================
// config/mqtt.js — Kết nối MQTT Mosquitto
// Backend đóng vai trò:
//   - Subscribe topic "sensor" → nhận data cảm biến từ ESP32
//   - Subscribe topic "device" → nhận trạng thái thiết bị từ ESP32
//   - Subscribe topic "status" → nhận kết quả điều khiển từ ESP32
//   - Subscribe topic "restore" → nhận yêu cầu khôi phục trạng thái từ ESP32
//   - Publish topic "control"  → gửi lệnh điều khiển xuống ESP32
// ============================================

const mqtt = require("mqtt");
require("dotenv").config();

const MQTT_OPTIONS = {
  port: parseInt(process.env.MQTT_PORT),
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: "backend-iot-reix-" + Date.now(),
  reconnectPeriod: 3000,
  connectTimeout: 10000,
};

const mqttClient = mqtt.connect(process.env.MQTT_HOST, MQTT_OPTIONS);

mqttClient.on("connect", () => {
  console.log(
    "✅ MQTT connected — broker:",
    process.env.MQTT_HOST,
    "port:",
    process.env.MQTT_PORT,
  );

  mqttClient.subscribe(["sensor", "device", "status", "restore"], (err) => {
    if (err) {
      console.error("❌ MQTT subscribe failed:", err.message);
    } else {
      console.log("✅ MQTT subscribed: sensor, device, status, restore");
    }
  });
});

mqttClient.on("error", (err) => {
  console.error("❌ MQTT error:", err.message);
});

mqttClient.on("offline", () => {
  console.log("⚠️ MQTT offline — đang reconnect...");
});

module.exports = mqttClient;
