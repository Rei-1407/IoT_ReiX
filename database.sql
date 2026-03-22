

CREATE DATABASE IF NOT EXISTS iot_reix;
USE iot_reix;

-- ============================================================
-- 1. BẢNG SENSORS (3 loại cảm biến)
-- ============================================================
CREATE TABLE IF NOT EXISTS sensors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_key ENUM('temperature','humidity','light') NOT NULL UNIQUE,
  sensor_name VARCHAR(50) NOT NULL,
  unit VARCHAR(16) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO sensors (sensor_key, sensor_name, unit) VALUES
  ('temperature', 'Nhiệt độ', '°C'),
  ('humidity', 'Độ ẩm', '%'),
  ('light', 'Ánh sáng', 'Lux');

-- ============================================================
-- 2. BẢNG SENSOR_READINGS (dữ liệu cảm biến theo thời gian)
-- ============================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sensor_id BIGINT NOT NULL,
  ts_ms BIGINT NOT NULL,
  value_num DECIMAL(10,2) NOT NULL,
  time_text VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE,
  INDEX idx_sensor_ts (sensor_id, ts_ms)
);

-- ============================================================
-- 3. BẢNG DEVICES (4 thiết bị)
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_key VARCHAR(32) NOT NULL UNIQUE,
  device_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO devices (device_key, device_name) VALUES
  ('fire', 'Báo cháy'),
  ('light', 'Đèn ngủ'),
  ('fan', 'Quạt gió'),
  ('ac', 'Điều hòa');

-- ============================================================
-- 4. BẢNG DEVICE_STATE (trạng thái hiện tại, quan hệ 1:1)
-- ============================================================
CREATE TABLE IF NOT EXISTS device_state (
  device_id BIGINT PRIMARY KEY,
  is_on TINYINT(1) DEFAULT 0,
  level INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

INSERT IGNORE INTO device_state (device_id, is_on, level)
SELECT id, 0, 0 FROM devices;

-- ============================================================
-- 5. BẢNG DEVICE_HISTORY (lịch sử điều khiển)
-- ============================================================
CREATE TABLE IF NOT EXISTS device_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id BIGINT NOT NULL,
  action ENUM('ON','OFF') NOT NULL,
  status ENUM('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
  expected_on TINYINT(1) DEFAULT NULL,
  prev_on TINYINT(1) DEFAULT NULL,
  created_ts_ms BIGINT DEFAULT NULL,
  resolved_ts_ms BIGINT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  time_text VARCHAR(64) DEFAULT NULL,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
  INDEX idx_device_created (device_id, created_ts_ms)
);