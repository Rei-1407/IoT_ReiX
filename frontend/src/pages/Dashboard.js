import React from "react";
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

var API = "http://localhost:5000/api";

var CustomLegend = function () {
  var items = [
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
      {items.map(function (item, idx) {
        return (
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
        );
      })}
    </div>
  );
};

function Dashboard(props) {
  var sensorData = props.sensorData;
  var chartData = props.chartData;
  var deviceState = props.deviceState;
  var isAutoMode = props.isAutoMode;
  var pendingDevices = props.pendingDevices;
  var setPendingDevices = props.setPendingDevices;
  var currentTime = props.currentTime;
  var timeoutError = props.timeoutError;
  var setTimeoutError = props.setTimeoutError;

  var sendControl = async function (deviceKey, value) {
    setPendingDevices(function (prev) {
      return Object.assign({}, prev, { [deviceKey]: true });
    });
    try {
      await axios.post(API + "/devices/control", {
        device_key: deviceKey,
        value: value,
      });
    } catch (err) {
      console.error("Control error:", err);
      setPendingDevices(function (prev) {
        var u = Object.assign({}, prev);
        delete u[deviceKey];
        return u;
      });
    }
    setTimeout(function () {
      setPendingDevices(function (prev) {
        var u = Object.assign({}, prev);
        delete u[deviceKey];
        return u;
      });
    }, 10000);
  };

  var toggleMode = async function () {
    var newMode = isAutoMode ? "manual" : "auto";
    try {
      await axios.post(API + "/devices/control", {
        device_key: "mode",
        value: newMode,
      });
    } catch (err) {
      console.error("Mode toggle error:", err);
    }
  };

  var toggleDevice = function (dk) {
    sendControl(dk, deviceState[dk].is_on ? 0 : 1);
  };
  var setFanLevel = function (l) {
    sendControl("fan", l);
  };
  var setAcMode = function (m) {
    var map = { OFF: 0, Sleep: 80, Dry: 150, Cool: 255 };
    sendControl("ac", map[m] || 0);
  };
  var getAcMode = function (l) {
    if (l === 0) return "OFF";
    if (l <= 80) return "Sleep";
    if (l <= 150) return "Dry";
    return "Cool";
  };

  return (
    <div className="dashboard-page">
      {timeoutError && (
        <div className="timeout-alert">
          <span className="timeout-icon">⚠️</span>
          <span>
            Thiết bị <strong>{timeoutError}</strong> không phản hồi sau 10 giây.
            Kiểm tra kết nối phần cứng!
          </span>
          <button
            className="timeout-close"
            onClick={function () {
              setTimeoutError(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

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

      <div className="dashboard-body">
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
                <Tooltip contentStyle={{ fontSize: 14, fontWeight: 600 }} />
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

        <div className="control-panel">
          <div className="control-header">
            <div className="control-header-left">
              <span className="control-title">CHẾ ĐỘ</span>
              <span className="mode-sub">
                {isAutoMode ? "Điều khiển tự động" : "Điều khiển thủ công"}
              </span>
            </div>
            <div className="mode-toggle" onClick={toggleMode}>
              <span
                className={
                  "mode-label " +
                  (!isAutoMode ? "mode-active-manual" : "mode-active-auto")
                }
              >
                {isAutoMode ? "AUTO" : "MANUAL"}
              </span>
              <div
                className={"toggle-switch " + (isAutoMode ? "toggle-on" : "")}
              >
                <div className="toggle-knob"></div>
              </div>
            </div>
          </div>

          <div
            className={
              "device-card " +
              (deviceState.fire.is_on ? "device-on device-fire-on" : "") +
              " " +
              (pendingDevices.fire ? "device-pending" : "")
            }
          >
            <div className="device-left">
              <FaFire
                className={
                  "device-icon " + (deviceState.fire.is_on ? "fire-active" : "")
                }
              />
              <span className="device-name">Báo cháy</span>
            </div>
            {pendingDevices.fire ? (
              <div className="loading-spinner"></div>
            ) : (
              <div
                className={
                  "toggle-switch-sm " +
                  (deviceState.fire.is_on ? "toggle-sm-on toggle-fire" : "")
                }
                onClick={function () {
                  if (!isAutoMode) toggleDevice("fire");
                }}
              >
                <div className="toggle-knob-sm"></div>
              </div>
            )}
          </div>

          <div
            className={
              "device-card " +
              (deviceState.light.is_on ? "device-on device-light-on" : "") +
              " " +
              (pendingDevices.light ? "device-pending" : "")
            }
          >
            <div className="device-left">
              <FaLightbulb
                className={
                  "device-icon " +
                  (deviceState.light.is_on ? "light-active" : "")
                }
              />
              <span className="device-name">Đèn ngủ</span>
            </div>
            {pendingDevices.light ? (
              <div className="loading-spinner"></div>
            ) : (
              <div
                className={
                  "toggle-switch-sm " +
                  (deviceState.light.is_on ? "toggle-sm-on toggle-light" : "")
                }
                onClick={function () {
                  if (!isAutoMode) toggleDevice("light");
                }}
              >
                <div className="toggle-knob-sm"></div>
              </div>
            )}
          </div>

          <div
            className={
              "device-card device-card-vertical " +
              (deviceState.fan.level > 0 ? "device-on device-fan-on" : "") +
              " " +
              (pendingDevices.fan ? "device-pending" : "")
            }
          >
            <div className="device-top-row">
              <FaFan
                className={
                  "device-icon " +
                  (deviceState.fan.level > 0
                    ? "fan-spin-" + deviceState.fan.level
                    : "")
                }
              />
              <span className="device-name">Quạt gió</span>
            </div>
            {pendingDevices.fan ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="level-buttons-full">
                {["OFF", "1", "2", "3"].map(function (label, idx) {
                  return (
                    <button
                      key={label}
                      className={
                        "level-btn " +
                        (deviceState.fan.level === idx ? "level-active" : "")
                      }
                      onClick={function () {
                        if (!isAutoMode) setFanLevel(idx);
                      }}
                      disabled={isAutoMode}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className={
              "device-card device-card-vertical " +
              (deviceState.ac.level > 0 ? "device-on device-ac-on" : "") +
              " " +
              (pendingDevices.ac ? "device-pending" : "")
            }
          >
            <div className="device-top-row">
              <FaSnowflake
                className={
                  "device-icon " +
                  (deviceState.ac.level > 0
                    ? "ac-mode-" + getAcMode(deviceState.ac.level).toLowerCase()
                    : "")
                }
              />
              <span className="device-name">Điều hòa</span>
            </div>
            {pendingDevices.ac ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="level-buttons-full">
                {["OFF", "Sleep", "Dry", "Cool"].map(function (mode) {
                  return (
                    <button
                      key={mode}
                      className={
                        "level-btn " +
                        (getAcMode(deviceState.ac.level) === mode
                          ? "level-active"
                          : "")
                      }
                      onClick={function () {
                        if (!isAutoMode) setAcMode(mode);
                      }}
                      disabled={isAutoMode}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
