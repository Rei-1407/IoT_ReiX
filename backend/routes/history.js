const router = require("express").Router();
const db = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const deviceType = req.query.device || "";
    const sortOrder = req.query.sort || "desc";

    let whereClause = "WHERE 1=1";
    const params = [];

    if (deviceType) {
      whereClause += " AND d.device_key = ?";
      params.push(deviceType);
    }

    // Tìm kiếm theo: ID, tên thiết bị, hành động, trạng thái, thời gian
    if (search) {
      // Map tiếng Việt sang giá trị DB
      let actionSearch = search;
      const lower = search.toLowerCase();
      if (
        "bật".includes(lower) ||
        lower.includes("bật") ||
        lower.includes("bat")
      ) {
        actionSearch = "ON";
      } else if (
        "tắt".includes(lower) ||
        lower.includes("tắt") ||
        lower.includes("tat")
      ) {
        actionSearch = "OFF";
      }

      let statusSearch = search;
      if (lower.includes("chờ") || lower.includes("cho"))
        statusSearch = "PENDING";
      else if (lower.includes("thành công") || lower.includes("thanh cong"))
        statusSearch = "SUCCESS";
      else if (lower.includes("thất bại") || lower.includes("that bai"))
        statusSearch = "FAILED";

      whereClause += ` AND (
        CAST(dh.id AS CHAR) LIKE ?
        OR d.device_name LIKE ?
        OR dh.action LIKE ?
        OR dh.action LIKE ?
        OR dh.status LIKE ?
        OR dh.status LIKE ?
        OR dh.time_text LIKE ?
      )`;
      const s = `%${search}%`;
      params.push(s, s, s, `%${actionSearch}%`, s, `%${statusSearch}%`, s);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total
       FROM device_history dh
       JOIN devices d ON dh.device_id = d.id
       ${whereClause}`,
      params,
    );
    const total = countResult[0].total;

    const [rows] = await db.execute(
      `SELECT dh.id, d.device_name, d.device_key,
              dh.action, dh.status, dh.time_text, dh.created_at
       FROM device_history dh
       JOIN devices d ON dh.device_id = d.id
       ${whereClause}
       ORDER BY dh.created_ts_ms ${sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("❌ GET /api/history error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
