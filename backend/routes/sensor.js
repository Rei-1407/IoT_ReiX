const router = require("express").Router();
const db = require("../config/db");

function removeAccents(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getSensorExtras(search) {
  var input = removeAccents(search);
  var extras = [];
  var sensorMap = [
    {
      keywords: [
        "nhiet do",
        "nhiệt độ",
        "nhiet",
        "nhiệt",
        "temperature",
        "temp",
      ],
      value: "Nhiệt độ",
    },
    {
      keywords: ["do am", "độ ẩm", "am", "ẩm", "humidity", "hum"],
      value: "Độ ẩm",
    },
    {
      keywords: [
        "anh sang",
        "ánh sáng",
        "anh",
        "ánh",
        "sang",
        "sáng",
        "light",
        "lux",
      ],
      value: "Ánh sáng",
    },
  ];
  sensorMap.forEach(function (item) {
    item.keywords.forEach(function (kw) {
      var kwClean = removeAccents(kw);
      if (kwClean.startsWith(input) || input.startsWith(kwClean)) {
        if (extras.indexOf(item.value) === -1) extras.push(item.value);
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
    var sensorType = req.query.type || "";
    var sortOrder = req.query.sort || "desc";
    var timeFrom = req.query.timeFrom || "";
    var timeTo = req.query.timeTo || "";

    var whereClause = "WHERE 1=1";
    var params = [];

    if (sensorType) {
      whereClause += " AND s.sensor_key = ?";
      params.push(sensorType);
    }

    if (search) {
      var s = "%" + search + "%";
      var conditions = [];
      var searchParams = [];
      conditions.push("CAST(sr.id AS CHAR) LIKE ?");
      searchParams.push(s);
      conditions.push("s.sensor_name LIKE ?");
      searchParams.push(s);
      conditions.push("CAST(sr.value_num AS CHAR) LIKE ?");
      searchParams.push(s);
      conditions.push("sr.time_text LIKE ?");
      searchParams.push(s);
      var extras = getSensorExtras(search);
      extras.forEach(function (name) {
        conditions.push("s.sensor_name = ?");
        searchParams.push(name);
      });
      whereClause += " AND (" + conditions.join(" OR ") + ")";
      params.push.apply(params, searchParams);
    }

    if (timeFrom) {
      whereClause += " AND sr.ts_ms >= ?";
      params.push(new Date(timeFrom).getTime());
    }
    if (timeTo) {
      whereClause += " AND sr.ts_ms <= ?";
      params.push(new Date(timeTo).getTime());
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
