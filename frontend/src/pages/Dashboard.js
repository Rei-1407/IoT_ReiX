import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  FaThermometerHalf,
  FaTint,
  FaSun,
  FaFire,
  FaLightbulb,
  FaFan,
  FaSnowflake,
} from "react-icons/fa";
import axios from "axios";
import "./Dashboard.css";

const API = "http://localhost:5000/api";

// Custom Legend với icon cho biểu đồ
const CustomLegend = () => {
  const items = [
    {
      icon: <FaThermometerHalf style={{ color: "#ef4444" }} />,
      label: "Nhiệt độ (°C)",
      color: "#ef4444",
    },
    {
      icon: <FaTint style={{ color: "#3b82f6" }} />,
      label: "Độ ẩm (%)",
      color: "#3b82f6",
    },
    {
      icon: <FaSun style={{ color: "#f59e0b" }} />,
      label: "Ánh sáng (Lux)",
      color: "#f59e0b",
    },
  ];

  return (
    <div className="custom-legend">
      {items.map((item, idx) => (
        <div key={idx} className="legend-item">
          <span className="legend-icon">{item.icon}</span>
          <span
            className="legend-line"
            style={{ background: item.color }}
          ></span>
          <span className="legend-text" style={{ color: item.color }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

function Dashboard() {
  // ===== STATE =====
  const [sensorData, setSensorData] = useState({ temp: 0, hum: 0, lux: 0 });
  const [chartData, setChartData] = useState([]);
  const [deviceState, setDeviceState] = useState({
    fire: { is_on: 0, level: 0 },
    light: { is_on: 0, level: 0 },
    fan: { is_on: 0, level: 0 },
    ac: { is_on: 0, level: 0 },
  });
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [pendingDevices, setPendingDevices] = useState({});
  const [currentTime, setCurrentTime] = useState("");
  const wsRef = useRef(null);

  // ===== LOAD TRẠNG THÁI KHI MỞ TRANG (reload giữ nguyên) =====
  useEffect(() => {
    const fetchDeviceState = async () => {
      try {
        const res = await axios.get(`${API}/devices/state`);
        const states = {};
        res.data.data.forEach((d) => {
          states[d.device_key] = { is_on: d.is_on, level: d.level };
        });
        setDeviceState((prev) => ({ ...prev, ...states }));
      } catch (err) {
        console.error("Fetch device state error:", err);
      }
    };
    fetchDeviceState();
  }, []);

  // ===== WEBSOCKET — Nhận data realtime từ backend =====
  useEffect(() => {
    let reconnectTimer;

    const connectWS = () => {
      const ws = new WebSocket("ws://localhost:5000");
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const { event: evtName, data } = JSON.parse(event.data);

        if (evtName === "sensor_data") {
          setSensorData({ temp: data.temp, hum: data.hum, lux: data.lux });
          setCurrentTime(data.time_text);

          setChartData((prev) => {
            const newPoint = {
              time: data.time_text.split(" ")[0],
              temp: data.temp,
              hum: data.hum,
              lux: data.lux,
            };
            const updated = [...prev, newPoint];
            return updated.length > 20 ? updated.slice(-20) : updated;
          });
        }

        if (evtName === "device_state") {
          setIsAutoMode(data.auto);
          setDeviceState({
            fire: { is_on: data.fire > 0 ? 1 : 0, level: data.fire },
            light: { is_on: data.light > 0 ? 1 : 0, level: data.light },
            fan: { is_on: data.fan > 0 ? 1 : 0, level: data.fan },
            ac: { is_on: data.ac > 0 ? 1 : 0, level: data.ac },
          });
        }

        if (evtName === "control_result") {
          setPendingDevices((prev) => {
            const updated = { ...prev };
            delete updated[data.action];
            return updated;
          });
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // ===== GỬI LỆNH ĐIỀU KHIỂN =====
  const sendControl = async (deviceKey, value) => {
    setPendingDevices((prev) => ({ ...prev, [deviceKey]: true }));

    try {
      await axios.post(`${API}/devices/control`, {
        device_key: deviceKey,
        value: value,
      });
    } catch (err) {
      console.error("Control error:", err);
      setPendingDevices((prev) => {
        const updated = { ...prev };
        delete updated[deviceKey];
        return updated;
      });
    }

    setTimeout(() => {
      setPendingDevices((prev) => {
        const updated = { ...prev };
        delete updated[deviceKey];
        return updated;
      });
    }, 10000);
  };

  const toggleMode = async () => {
    const newMode = isAutoMode ? "manual" : "auto";
    try {
      await axios.post(`${API}/devices/control`, {
        device_key: "mode",
        value: newMode,
      });
    } catch (err) {
      console.error("Mode toggle error:", err);
    }
  };

  const toggleDevice = (deviceKey) => {
    const current = deviceState[deviceKey];
    const newValue = current.is_on ? 0 : 1;
    sendControl(deviceKey, newValue);
  };

  const setFanLevel = (level) => {
    sendControl("fan", level);
  };

  const setAcMode = (mode) => {
    const acMap = { OFF: 0, Sleep: 80, Dry: 150, Cool: 255 };
    sendControl("ac", acMap[mode] || 0);
  };

  const getAcMode = (level) => {
    if (level === 0) return "OFF";
    if (level <= 80) return "Sleep";
    if (level <= 150) return "Dry";
    return "Cool";
  };

  return (
    <div className="dashboard-page">
      {/* ===== 3 CARD CẢM BIẾN ===== */}
      <div className="sensor-cards">
        <div className="sensor-card card-temp">
          <div className="sensor-icon">
            <FaThermometerHalf />
          </div>
          <div className="sensor-info">
            <span className="sensor-label">NHIỆT ĐỘ</span>
            <span className="sensor-value">
              {sensorData.temp.toFixed(2)} °C
            </span>
          </div>
        </div>

        <div className="sensor-card card-hum">
          <div className="sensor-icon">
            <FaTint />
          </div>
          <div className="sensor-info">
            <span className="sensor-label">ĐỘ ẨM</span>
            <span className="sensor-value">{sensorData.hum.toFixed(2)} %</span>
          </div>
        </div>

        <div className="sensor-card card-lux">
          <div className="sensor-icon">
            <FaSun />
          </div>
          <div className="sensor-info">
            <span className="sensor-label">ÁNH SÁNG</span>
            <span className="sensor-value">
              {sensorData.lux.toFixed(2)} Lux
            </span>
          </div>
        </div>
      </div>

      {/* ===== BIỂU ĐỒ + PANEL ĐIỀU KHIỂN ===== */}
      <div className="dashboard-body">
        {/* BIỂU ĐỒ REALTIME */}
        <div className="chart-container">
          <div className="chart-header">
            <span className="chart-title">📈 GIÁM SÁT REALTIME</span>
            <span className="chart-time">{currentTime}</span>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(0,0,0,0.06)"
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 13, fontWeight: 600 }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 13, fontWeight: 600 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 13, fontWeight: 600 }}
                />
                <Tooltip contentStyle={{ fontSize: 16, fontWeight: 600 }} />
                <Legend content={<CustomLegend />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temp"
                  name="Nhiệt độ (°C)"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="hum"
                  name="Độ ẩm (%)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="lux"
                  name="Ánh sáng (Lux)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PANEL ĐIỀU KHIỂN */}
        <div className="control-panel">
          <div className="control-header">
            <span className="control-title">CHẾ ĐỘ</span>
            <div className="mode-toggle" onClick={toggleMode}>
              <span
                className={`mode-label ${!isAutoMode ? "mode-active" : ""}`}
              >
                MANUAL
              </span>
              <div className={`toggle-switch ${isAutoMode ? "toggle-on" : ""}`}>
                <div className="toggle-knob"></div>
              </div>
            </div>
            <span className="mode-sub">Điều khiển thủ công</span>
          </div>

          {/* Báo cháy */}
          <div
            className={`device-card ${deviceState.fire.is_on ? "device-on device-fire-on" : ""} ${pendingDevices.fire ? "device-pending" : ""}`}
          >
            <div className="device-left">
              <FaFire className="device-icon" />
              <span className="device-name">Báo cháy</span>
            </div>
            {pendingDevices.fire ? (
              <div className="loading-spinner"></div>
            ) : (
              <div
                className={`toggle-switch-sm ${deviceState.fire.is_on ? "toggle-sm-on toggle-fire" : ""}`}
                onClick={() => !isAutoMode && toggleDevice("fire")}
              >
                <div className="toggle-knob-sm"></div>
              </div>
            )}
          </div>

          {/* Đèn ngủ */}
          <div
            className={`device-card ${deviceState.light.is_on ? "device-on device-light-on" : ""} ${pendingDevices.light ? "device-pending" : ""}`}
          >
            <div className="device-left">
              <FaLightbulb className="device-icon" />
              <span className="device-name">Đèn ngủ</span>
            </div>
            {pendingDevices.light ? (
              <div className="loading-spinner"></div>
            ) : (
              <div
                className={`toggle-switch-sm ${deviceState.light.is_on ? "toggle-sm-on toggle-light" : ""}`}
                onClick={() => !isAutoMode && toggleDevice("light")}
              >
                <div className="toggle-knob-sm"></div>
              </div>
            )}
          </div>

          {/* Quạt gió */}
          <div
            className={`device-card ${deviceState.fan.level > 0 ? "device-on device-fan-on" : ""} ${pendingDevices.fan ? "device-pending" : ""}`}
          >
            <div className="device-left">
              <FaFan
                className={`device-icon ${deviceState.fan.level > 0 ? "fan-spinning" : ""}`}
              />
              <span className="device-name">Quạt gió</span>
            </div>
            {pendingDevices.fan ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="level-buttons">
                {["OFF", "1", "2", "ON"].map((label, idx) => {
                  const level = label === "ON" ? 3 : idx;
                  return (
                    <button
                      key={label}
                      className={`level-btn ${deviceState.fan.level === level ? "level-active" : ""}`}
                      onClick={() => !isAutoMode && setFanLevel(level)}
                      disabled={isAutoMode}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Điều hòa */}
          <div
            className={`device-card ${deviceState.ac.level > 0 ? "device-on device-ac-on" : ""} ${pendingDevices.ac ? "device-pending" : ""}`}
          >
            <div className="device-left">
              <FaSnowflake className="device-icon" />
              <span className="device-name">Điều hòa</span>
            </div>
            {pendingDevices.ac ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="level-buttons">
                {["OFF", "Sleep", "Dry", "Cool"].map((mode) => (
                  <button
                    key={mode}
                    className={`level-btn ${getAcMode(deviceState.ac.level) === mode ? "level-active" : ""}`}
                    onClick={() => !isAutoMode && setAcMode(mode)}
                    disabled={isAutoMode}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
