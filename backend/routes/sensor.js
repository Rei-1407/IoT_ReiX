const router = require("express").Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 10;
    var offset = (page - 1) * limit;
    var search = req.query.search || "";
    var sensorType = req.query.type || "";
    var sortOrder = req.query.sort || "desc";

    var whereClause = "WHERE 1=1";
    var params = [];

    if (sensorType) {
      whereClause += " AND s.sensor_key = ?";
      params.push(sensorType);
    }

    // Tìm kiếm chỉ theo thời gian
    if (search) {
      whereClause += " AND sr.time_text LIKE ?";
      params.push("%" + search + "%");
    }

    var [countResult] = await db.execute(
      "SELECT COUNT(*) as total FROM sensor_readings sr JOIN sensors s ON sr.sensor_id = s.id " +
        whereClause,
      params,
    );
    var total = countResult[0].total;

    var [rows] = await db.execute(
      "SELECT sr.id, s.sensor_name, s.sensor_key, s.unit, sr.value_num, sr.time_text, sr.created_at " +
        "FROM sensor_readings sr JOIN sensors s ON sr.sensor_id = s.id " +
        whereClause +
        " ORDER BY sr.ts_ms " +
        (sortOrder === "asc" ? "ASC" : "DESC") +
        ", sr.id " +
        (sortOrder === "asc" ? "ASC" : "DESC") +
        " LIMIT " +
        limit +
        " OFFSET " +
        offset,
      params,
    );

    res.json({
      data: rows,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("❌ GET /api/sensors error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
