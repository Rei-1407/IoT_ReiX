const router = require("express").Router();
const db = require("../config/db");

// Bỏ dấu tiếng Việt
function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// Tìm tất cả giá trị DB khớp với input
function getSearchExtras(search) {
  var input = removeAccents(search);
  var extras = [];

  // Action mapping
  var actionMap = [
    { keywords: ["bat", "bật"], value: "ON" },
    { keywords: ["tat", "tắt"], value: "OFF" },
  ];

  // Status mapping
  var statusMap = [
    {
      keywords: ["cho", "chờ", "pending", "dang cho", "đang chờ"],
      value: "PENDING",
    },
    {
      keywords: [
        "thanh cong",
        "thành công",
        "success",
        "hoan thanh",
        "hoàn thành",
      ],
      value: "SUCCESS",
    },
    {
      keywords: ["that bai", "thất bại", "failed", "loi", "lỗi"],
      value: "FAILED",
    },
  ];

  // Device mapping
  var deviceMap = [
    {
      keywords: ["bao chay", "báo cháy", "chay", "cháy", "fire"],
      value: "Báo cháy",
    },
    {
      keywords: ["den ngu", "đèn ngủ", "den", "đèn", "light"],
      value: "Đèn ngủ",
    },
    {
      keywords: ["quat gio", "quạt gió", "quat", "quạt", "fan"],
      value: "Quạt gió",
    },
    {
      keywords: ["dieu hoa", "điều hòa", "dieu", "điều", "ac"],
      value: "Điều hòa",
    },
  ];

  actionMap.forEach(function (item) {
    item.keywords.forEach(function (kw) {
      var kwClean = removeAccents(kw);
      if (kwClean.startsWith(input) || input.startsWith(kwClean)) {
        if (extras.indexOf("action:" + item.value) === -1) {
          extras.push("action:" + item.value);
        }
      }
    });
  });

  statusMap.forEach(function (item) {
    item.keywords.forEach(function (kw) {
      var kwClean = removeAccents(kw);
      if (kwClean.startsWith(input) || input.startsWith(kwClean)) {
        if (extras.indexOf("status:" + item.value) === -1) {
          extras.push("status:" + item.value);
        }
      }
    });
  });

  deviceMap.forEach(function (item) {
    item.keywords.forEach(function (kw) {
      var kwClean = removeAccents(kw);
      if (kwClean.startsWith(input) || input.startsWith(kwClean)) {
        if (extras.indexOf("device:" + item.value) === -1) {
          extras.push("device:" + item.value);
        }
      }
    });
  });

  return extras;
}

router.get("/", async (req, res) => {
  try {
    var page = parseInt(req.query.page) || 1;
    var limit = parseInt(req.query.limit) || 10;
    var offset = (page - 1) * limit;
    var search = req.query.search || "";
    var timeFrom = req.query.timeFrom || "";
    var timeTo = req.query.timeTo || "";
    var deviceType = req.query.device || "";
    var sortOrder = req.query.sort || "desc";

    var whereClause = "WHERE 1=1";
    var params = [];

    if (deviceType) {
      whereClause += " AND d.device_key = ?";
      params.push(deviceType);
    }

    if (search) {
      var s = "%" + search + "%";
      var conditions = [];
      var searchParams = [];

      // Tìm chung: ID, thời gian
      conditions.push("CAST(dh.id AS CHAR) LIKE ?");
      searchParams.push(s);
      conditions.push("dh.time_text LIKE ?");
      searchParams.push(s);
      conditions.push("d.device_name LIKE ?");
      searchParams.push(s);

      // Tìm mở rộng: không dấu, viết tắt, tiếng Việt
      var extras = getSearchExtras(search);
      extras.forEach(function (extra) {
        var parts = extra.split(":");
        var type = parts[0];
        var value = parts[1];

        if (type === "action") {
          conditions.push("dh.action = ?");
          searchParams.push(value);
        } else if (type === "status") {
          conditions.push("dh.status = ?");
          searchParams.push(value);
        } else if (type === "device") {
          conditions.push("d.device_name = ?");
          searchParams.push(value);
        }
      });

      whereClause += " AND (" + conditions.join(" OR ") + ")";
      params.push.apply(params, searchParams);
    }

    if (timeFrom) {
      whereClause += " AND dh.time_text >= ?";
      params.push(timeFrom);
    }
    if (timeTo) {
      whereClause += " AND dh.time_text <= ?";
      params.push(timeTo);
    }
    var timeFrom = req.query.timeFrom || "";
    var timeTo = req.query.timeTo || "";
    if (timeFrom) {
      whereClause += " AND dh.created_ts_ms >= ?";
      params.push(new Date(timeFrom).getTime());
    }
    if (timeTo) {
      whereClause += " AND dh.created_ts_ms <= ?";
      params.push(new Date(timeTo).getTime());
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
