const router = require("express").Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 10;
    var offset = (page - 1) * limit;
    var search = req.query.search || "";
    var deviceType = req.query.device || "";
    var actionFilter = req.query.action || "";
    var statusFilter = req.query.status || "";
    var sortOrder = req.query.sort || "desc";

    var whereClause = "WHERE 1=1";
    var params = [];

    if (deviceType) {
      whereClause += " AND d.device_key = ?";
      params.push(deviceType);
    }

    if (actionFilter) {
      whereClause += " AND dh.action = ?";
      params.push(actionFilter);
    }

    if (statusFilter) {
      whereClause += " AND dh.status = ?";
      params.push(statusFilter);
    }

    // Tìm kiếm chỉ theo thời gian
    if (search) {
      whereClause += " AND dh.time_text LIKE ?";
      params.push("%" + search + "%");
    }

    var [countResult] = await db.execute(
      "SELECT COUNT(*) as total FROM device_history dh JOIN devices d ON dh.device_id = d.id " +
        whereClause,
      params,
    );
    var total = countResult[0].total;

    var [rows] = await db.execute(
      "SELECT dh.id, d.device_name, d.device_key, dh.action, dh.status, dh.time_text, dh.created_at " +
        "FROM device_history dh JOIN devices d ON dh.device_id = d.id " +
        whereClause +
        " ORDER BY dh.created_ts_ms " +
        (sortOrder === "asc" ? "ASC" : "DESC") +
        ", dh.id " +
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
    console.error("❌ GET /api/history error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
