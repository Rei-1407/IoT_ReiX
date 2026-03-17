const router = require("express").Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const sensorType = req.query.type || "";
    const sortOrder = req.query.sort || "desc";

    let whereClause = "WHERE 1=1";
    const params = [];

    if (sensorType) {
      whereClause += " AND s.sensor_key = ?";
      params.push(sensorType);
    }

    // Tìm kiếm theo: ID, tên cảm biến, giá trị, thời gian
    if (search) {
      whereClause += ` AND (
        CAST(sr.id AS CHAR) LIKE ?
        OR s.sensor_name LIKE ?
        OR CAST(sr.value_num AS CHAR) LIKE ?
        OR sr.time_text LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM sensor_readings sr 
       JOIN sensors s ON sr.sensor_id = s.id 
       ${whereClause}`,
      params,
    );
    const total = countResult[0].total;

    const [rows] = await db.execute(
      `SELECT sr.id, s.sensor_name, s.sensor_key, s.unit, 
              sr.value_num, sr.time_text, sr.created_at
       FROM sensor_readings sr
       JOIN sensors s ON sr.sensor_id = s.id
       ${whereClause}
       ORDER BY sr.ts_ms ${sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("❌ GET /api/sensors error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
