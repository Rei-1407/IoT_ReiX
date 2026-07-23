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
  FaBell,
  FaMobileAlt,
  FaWifi,
  FaMicrochip,
} from "react-icons/fa";
import "./Dashboard.css";

var NTFY_TOPIC = "reix-bao-chay-1407";
var FIRE_TEMP = 40;

var CustomLegend = function (props) {
  var activeChart = props.activeChart;
  var setActiveChart = props.setActiveChart;
  var items = [
    {
      key: "temp",
      icon: <FaThermometerHalf style={{ color: "#ef4444" }} />,
      label: "Nhiệt độ (°C)",
      color: "#ef4444",
    },
    {
      key: "hum",
      icon: <FaTint style={{ color: "#3b82f6" }} />,
      label: "Độ ẩm (%)",
      color: "#3b82f6",
    },
    {
      key: "lux",
      icon: <FaSun style={{ color: "#f59e0b" }} />,
      label: "Ánh sáng (Lux)",
      color: "#f59e0b",
    },
  ];
  return (
    <div className="custom-legend">
      {items.map(function (item, idx) {
        var isActive = activeChart === null || activeChart === item.key;
        return (
          <div
            key={idx}
            className="legend-item"
            style={{
              opacity: isActive ? 1 : 0.3,
              cursor: "pointer",
              transition: "opacity 0.3s",
            }}
            onClick={function () {
              setActiveChart(activeChart === item.key ? null : item.key);
            }}
          >
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

// Hàm tính class hiệu ứng cho nhiệt độ
var getTempLevel = function (temp) {
  if (temp >= 40) return "temp-extreme";
  if (temp >= 33) return "temp-hot";
  if (temp >= 28) return "temp-warm";
  if (temp >= 20) return "temp-normal";
  return "temp-cold";
};

// Hàm tính class hiệu ứng cho độ ẩm
var getHumLevel = function (hum) {
  if (hum >= 85) return "hum-extreme";
  if (hum >= 70) return "hum-high";
  if (hum >= 50) return "hum-normal";
  return "hum-dry";
};

// Hàm tính class hiệu ứng cho ánh sáng
var getLuxLevel = function (lux) {
  if (lux >= 500) return "lux-bright";
  if (lux >= 200) return "lux-normal";
  if (lux >= 50) return "lux-dim";
  return "lux-dark";
};

function Dashboard(props) {
  var sensorData = props.sensorData;
  var chartData = props.chartData;
  var currentTime = props.currentTime;
  var brokerConnected = props.brokerConnected;
  var esp32Online = props.esp32Online;
  var fireAlert = props.fireAlert;

  var [activeChart, setActiveChart] = React.useState(null);
  var [notifPerm, setNotifPerm] = React.useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  var askNotify = function () {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(function (perm) {
      setNotifPerm(perm);
    });
  };

  var tempLevel = getTempLevel(sensorData.temp);
  var humLevel = getHumLevel(sensorData.hum);
  var luxLevel = getLuxLevel(sensorData.lux);

  return (
    <div className="dashboard-page">
      {/* ===== HEADER: ten app + trang thai ket noi ===== */}
      <div className="monitor-header">
        <div className="monitor-title-block">
          <span className="monitor-title">🏠 ReiX Home Monitor</span>
          <span className="monitor-sub">
            {currentTime
              ? "Cập nhật lúc: " + currentTime
              : "Đang chờ dữ liệu..."}
          </span>
        </div>
        <div className="monitor-badges">
          <span
            className={
              "status-badge " + (brokerConnected ? "badge-on" : "badge-off")
            }
          >
            <FaWifi /> {brokerConnected ? "Máy chủ OK" : "Mất máy chủ"}
          </span>
          <span
            className={
              "status-badge " + (esp32Online ? "badge-on" : "badge-off")
            }
          >
            <FaMicrochip /> {esp32Online ? "Cảm biến Online" : "Cảm biến Offline"}
          </span>
        </div>
      </div>

      {/* ===== BANNER BAO CHAY ===== */}
      {fireAlert && (
        <div className="fire-banner">
          <FaFire className="fire-banner-icon" />
          <span>
            <strong>CẢNH BÁO CHÁY!</strong> Nhiệt độ đang{" "}
            {sensorData.temp.toFixed(1)}°C — vượt ngưỡng {FIRE_TEMP}°C. Kiểm
            tra ngay!
          </span>
        </div>
      )}

      {/* ===== 3 CARD CAM BIEN ===== */}
      <div className="sensor-cards sensor-cards-3">
        <div className={"sensor-card card-temp " + tempLevel}>
          <div className={"sensor-icon temp-icon " + tempLevel}>
            <FaThermometerHalf />
          </div>
          <div className="sensor-info">
            <span className="sensor-label">NHIỆT ĐỘ</span>
            <span className="sensor-value">
              {sensorData.temp.toFixed(2)} °C
            </span>
          </div>
        </div>

        <div className={"sensor-card card-hum " + humLevel}>
          <div className={"sensor-icon hum-icon " + humLevel}>
            <FaTint />
            {sensorData.hum >= 70 && (
              <div className="hum-drops">
                <span className="drop drop-1"></span>
                <span className="drop drop-2"></span>
                <span className="drop drop-3"></span>
              </div>
            )}
          </div>
          <div className="sensor-info">
            <span className="sensor-label">ĐỘ ẨM</span>
            <span className="sensor-value">{sensorData.hum.toFixed(2)} %</span>
          </div>
        </div>

        <div className={"sensor-card card-lux " + luxLevel}>
          <div className={"sensor-icon lux-icon " + luxLevel}>
            <FaSun />
            {sensorData.lux >= 200 && <div className="lux-rays"></div>}
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
        {/* ===== BIEU DO REALTIME ===== */}
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
                <Legend
                  content={
                    <CustomLegend
                      activeChart={activeChart}
                      setActiveChart={setActiveChart}
                    />
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temp"
                  name="Nhiệt độ (°C)"
                  stroke="#ef4444"
                  strokeWidth={activeChart === "temp" ? 3 : 2}
                  strokeOpacity={
                    activeChart === null || activeChart === "temp" ? 1 : 0.15
                  }
                  dot={{
                    r: activeChart === "temp" ? 4 : 3,
                    strokeOpacity:
                      activeChart === null || activeChart === "temp" ? 1 : 0.15,
                    fillOpacity:
                      activeChart === null || activeChart === "temp" ? 1 : 0.15,
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="hum"
                  name="Độ ẩm (%)"
                  stroke="#3b82f6"
                  strokeWidth={activeChart === "hum" ? 3 : 2}
                  strokeOpacity={
                    activeChart === null || activeChart === "hum" ? 1 : 0.15
                  }
                  dot={{
                    r: activeChart === "hum" ? 4 : 3,
                    strokeOpacity:
                      activeChart === null || activeChart === "hum" ? 1 : 0.15,
                    fillOpacity:
                      activeChart === null || activeChart === "hum" ? 1 : 0.15,
                  }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="lux"
                  name="Ánh sáng (Lux)"
                  stroke="#f59e0b"
                  strokeWidth={activeChart === "lux" ? 3 : 2}
                  strokeOpacity={
                    activeChart === null || activeChart === "lux" ? 1 : 0.15
                  }
                  dot={{
                    r: activeChart === "lux" ? 4 : 3,
                    strokeOpacity:
                      activeChart === null || activeChart === "lux" ? 1 : 0.15,
                    fillOpacity:
                      activeChart === null || activeChart === "lux" ? 1 : 0.15,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ===== PANEL CANH BAO + CAI APP ===== */}
        <div className="control-panel alert-panel">
          <div className="panel-block">
            <span className="panel-title">
              <FaBell /> THÔNG BÁO TRÊN MÁY NÀY
            </span>
            {notifPerm === "granted" ? (
              <p className="panel-ok">
                ✅ Đã bật — máy này sẽ nhận thông báo khi nhiệt độ vượt{" "}
                {FIRE_TEMP}°C (cần đang mở app/web).
              </p>
            ) : notifPerm === "unsupported" ? (
              <p className="panel-text">
                Trình duyệt này không hỗ trợ thông báo. Trên iPhone: thêm app
                vào Màn hình chính trước rồi mở từ đó.
              </p>
            ) : (
              <button className="notify-btn" onClick={askNotify}>
                🔔 Bật cảnh báo cháy trên thiết bị này
              </button>
            )}
          </div>

          <div className="panel-block">
            <span className="panel-title">
              <FaFire /> BÁO CHÁY TỪ XA (NTFY)
            </span>
            <p className="panel-text">
              Nhận báo cháy kể cả khi <strong>không mở</strong> web/app:
            </p>
            <ol className="panel-steps">
              <li>
                Cài app <strong>ntfy</strong> (App Store / Google Play)
              </li>
              <li>
                Subscribe topic: <code className="ntfy-topic">{NTFY_TOPIC}</code>
              </li>
            </ol>
            <a
              className="ntfy-link"
              href={"https://ntfy.sh/" + NTFY_TOPIC}
              target="_blank"
              rel="noreferrer"
            >
              Hoặc mở kênh cảnh báo trên web →
            </a>
          </div>

          <div className="panel-block">
            <span className="panel-title">
              <FaMobileAlt /> CÀI THÀNH APP
            </span>
            <p className="panel-text">
              <strong>Android/PC:</strong> menu Chrome → "Cài đặt ứng dụng".
              <br />
              <strong>iPhone:</strong> Safari → nút Chia sẻ → "Thêm vào MH
              chính".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
