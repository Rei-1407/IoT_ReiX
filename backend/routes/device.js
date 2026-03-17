const router = require("express").Router();
const db = require("../config/db");
const mqttClient = require("../config/mqtt");

// GET /api/devices/state — Lấy trạng thái hiện tại của tất cả thiết bị
// Dùng khi: reload web → frontend gọi API này → hiển thị đúng trạng thái
router.get("/state", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT d.id, d.device_key, d.device_name, 
              ds.is_on, ds.level, ds.updated_at
       FROM devices d
       JOIN device_state ds ON d.id = ds.device_id
       ORDER BY d.id`,
    );
    res.json({ data: rows });
  } catch (err) {
    console.error("❌ GET /api/devices/state error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/devices/control — Gửi lệnh điều khiển thiết bị
// Frontend gọi → Backend lưu history(PENDING) → publish MQTT → ESP32 thực thi
router.post("/control", async (req, res) => {
  try {
    const { device_key, value } = req.body;
    // device_key: "fire", "light", "fan", "ac"
    // value: 0/1 cho fire/light, 0-3 cho fan, 0-255 cho ac

    if (!device_key) {
      return res.status(400).json({ error: "device_key is required" });
    }
    // Xử lý chuyển chế độ Auto/Manual
    if (device_key === "mode") {
      const controlMessage = JSON.stringify({
        action: "mode",
        val: value,
      });
      mqttClient.publish("control", controlMessage);
      return res.json({ message: "Mode changed", mode: value });
    }
    // Tìm device trong DB
    const [devices] = await db.execute(
      "SELECT id FROM devices WHERE device_key = ?",
      [device_key],
    );
    if (devices.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }
    const deviceId = devices[0].id;

    // Lấy trạng thái hiện tại (prev_on)
    const [states] = await db.execute(
      "SELECT is_on, level FROM device_state WHERE device_id = ?",
      [deviceId],
    );
    const prevOn = states[0]?.is_on || 0;

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

    const expectedOn = Number(value) > 0 ? 1 : 0;
    const action = expectedOn ? "ON" : "OFF";

    // Insert history với status = PENDING
    const [insertResult] = await db.execute(
      `INSERT INTO device_history 
       (device_id, action, status, expected_on, prev_on, created_ts_ms, time_text)
       VALUES (?, ?, 'PENDING', ?, ?, ?, ?)`,
      [deviceId, action, expectedOn, prevOn, now, timeText],
    );
    const historyId = insertResult.insertId;

    // Publish lệnh điều khiển xuống ESP32 qua MQTT
    const controlMessage = JSON.stringify({
      action: device_key,
      val: Number(value),
    });
    mqttClient.publish("control", controlMessage);

    // Đặt timeout 10 giây — nếu ESP32 không phản hồi → FAILED
    setTimeout(async () => {
      try {
        const [check] = await db.execute(
          "SELECT status FROM device_history WHERE id = ?",
          [historyId],
        );
        if (check.length > 0 && check[0].status === "PENDING") {
          // Vẫn PENDING sau 10s → đánh FAILED
          await db.execute(
            `UPDATE device_history 
             SET status = 'FAILED', resolved_ts_ms = ?, resolved_at = NOW()
             WHERE id = ?`,
            [Date.now(), historyId],
          );

          // Push thông báo timeout tới frontend
          const WebSocket = require("ws");
          // Broadcast qua global (sẽ refactor sau nếu cần)
          console.log(`⏰ Timeout 10s — device_history #${historyId} → FAILED`);
        }
      } catch (err) {
        console.error("❌ Timeout handler error:", err.message);
      }
    }, 10000);

    res.json({
      message: "Control command sent",
      history_id: historyId,
      device_key,
      action,
      value: Number(value),
    });
  } catch (err) {
    console.error("❌ POST /api/devices/control error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
