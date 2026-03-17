// ============================================
// config/db.js — Kết nối MySQL dùng pool
// Pool = giữ sẵn nhiều connection, tái sử dụng
// Tránh tạo connection mới mỗi lần query (chậm)
// ============================================

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Pool config
  waitForConnections: true, // Chờ nếu hết connection
  connectionLimit: 10, // Tối đa 10 connection cùng lúc
  queueLimit: 0, // Không giới hạn hàng đợi
});

// Test connection khi khởi động
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ MySQL connected — database:", process.env.DB_NAME);
    conn.release(); // Trả connection về pool
  })
  .catch((err) => {
    console.error("❌ MySQL connection failed:", err.message);
  });

module.exports = pool;
