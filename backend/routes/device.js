const router = require("express").Router();
const db = require("../config/db");
const mqttClient = require("../config/mqtt");

module.exports = function (broadcast) {
  // GET /api/devices/state
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

  // POST /api/devices/control
  router.post("/control", async (req, res) => {
    try {
      const { device_key, value } = req.body;

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
      const now2 = new Date();
      const dd = String(now2.getDate()).padStart(2, "0");
      const mm = String(now2.getMonth() + 1).padStart(2, "0");
      const yyyy = now2.getFullYear();
      const hh = String(now2.getHours()).padStart(2, "0");
      const mi = String(now2.getMinutes()).padStart(2, "0");
      const ss = String(now2.getSeconds()).padStart(2, "0");
      const timeText =
        dd + "/" + mm + "/" + yyyy + " " + hh + ":" + mi + ":" + ss;

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

      // Publish lệnh điều khiển xuống ESP32
      const controlMessage = JSON.stringify({
        action: device_key,
        val: Number(value),
      });
      mqttClient.publish("control", controlMessage);

      // Timeout 10 giây — nếu ESP32 không phản hồi → INSERT thêm row FAILED
      setTimeout(async () => {
        try {
          const [check] = await db.execute(
            "SELECT status, device_id, action, expected_on, prev_on FROM device_history WHERE id = ?",
            [historyId],
          );
          if (check.length > 0 && check[0].status === "PENDING") {
            const failNow = Date.now();
            const failDate = new Date();
            const fdd = String(failDate.getDate()).padStart(2, "0");
            const fmm = String(failDate.getMonth() + 1).padStart(2, "0");
            const fyyyy = failDate.getFullYear();
            const fhh = String(failDate.getHours()).padStart(2, "0");
            const fmi = String(failDate.getMinutes()).padStart(2, "0");
            const fss = String(failDate.getSeconds()).padStart(2, "0");
            const failTimeText =
              fdd + "/" + fmm + "/" + fyyyy + " " + fhh + ":" + fmi + ":" + fss;

            // INSERT row mới với status FAILED (giữ nguyên row PENDING)
            await db.execute(
              `INSERT INTO device_history 
               (device_id, action, status, expected_on, prev_on, created_ts_ms, resolved_ts_ms, resolved_at, time_text)
               VALUES (?, ?, 'FAILED', ?, ?, ?, ?, NOW(), ?)`,
              [
                check[0].device_id,
                check[0].action,
                check[0].expected_on,
                check[0].prev_on,
                failNow,
                failNow,
                failTimeText,
              ],
            );

            // Push thông báo timeout tới frontend
            broadcast("control_timeout", {
              device_key: device_key,
              action: action,
              history_id: historyId,
              message: "Thiết bị không phản hồi sau 10 giây",
            });

            console.log(
              `⏰ Timeout 10s — device ${device_key} → INSERT FAILED row`,
            );
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

  return router;
};
