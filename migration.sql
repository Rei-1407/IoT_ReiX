USE iot_reix;

-- Them sensor toc do gio
ALTER TABLE sensors MODIFY sensor_key ENUM('temperature','humidity','light','windspeed') NOT NULL;

INSERT IGNORE INTO sensors (sensor_key, sensor_name, unit) VALUES
  ('windspeed', 'Tốc độ gió', 'm/s');

-- Them device canh bao
INSERT IGNORE INTO devices (device_key, device_name) VALUES
  ('warning', 'Cảnh báo');

-- Them device_state cho warning
INSERT IGNORE INTO device_state (device_id, is_on, level)
  SELECT id, 0, 0 FROM devices WHERE device_key = 'warning';
