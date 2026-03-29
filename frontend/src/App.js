import React, { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DataSensor from "./pages/DataSensor";
import ActionHistory from "./pages/ActionHistory";
import Profile from "./pages/Profile";
import "./App.css";

function App() {
  var [sensorData, setSensorData] = useState({ temp: 0, hum: 0, lux: 0 });
  var [chartData, setChartData] = useState([]);
  var [deviceState, setDeviceState] = useState({
    fire: { is_on: 0, level: 0 },
    light: { is_on: 0, level: 0 },
    fan: { is_on: 0, level: 0 },
    ac: { is_on: 0, level: 0 },
  });
  var [isAutoMode, setIsAutoMode] = useState(true);
  var [currentTime, setCurrentTime] = useState("");
  var [pendingDevices, setPendingDevices] = useState({});
  var [timeoutError, setTimeoutError] = useState(null);
  var wsRef = useRef(null);

  // Load device state khi mở web (reload giữ nguyên)
  useEffect(function () {
    fetch("http://localhost:5000/api/devices/state")
      .then(function (res) {
        return res.json();
      })
      .then(function (res) {
        var states = {};
        res.data.forEach(function (d) {
          states[d.device_key] = { is_on: d.is_on, level: d.level };
        });
        setDeviceState(function (prev) {
          return Object.assign({}, prev, states);
        });
      })
      .catch(function (err) {
        console.error("Fetch device state error:", err);
      });
  }, []);

  // WebSocket — chạy 1 lần duy nhất, không bao giờ unmount
  useEffect(function () {
    var reconnectTimer;
    var isCleanedUp = false;

    function connectWS() {
      if (isCleanedUp) return;
      var ws = new WebSocket("ws://localhost:5000");
      wsRef.current = ws;

      ws.onmessage = function (event) {
        try {
          var parsed = JSON.parse(event.data);
          var evtName = parsed.event;
          var data = parsed.data;

          if (evtName === "sensor_data") {
            setSensorData({ temp: data.temp, hum: data.hum, lux: data.lux });
            setCurrentTime(data.time_text);

            setChartData(function (prev) {
              var newPoint = {
                time: data.time_text.split(" ")[0],
                temp: data.temp,
                hum: data.hum,
                lux: data.lux,
              };
              var updated = prev.concat([newPoint]);
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
            setPendingDevices(function (prev) {
              var updated = Object.assign({}, prev);
              delete updated[data.action];
              return updated;
            });
          }

          if (evtName === "control_timeout") {
            var deviceNames = {
              fire: "Báo cháy",
              light: "Đèn ngủ",
              fan: "Quạt gió",
              ac: "Điều hòa",
            };
            var displayName = deviceNames[data.device_key] || data.device_key;
            setPendingDevices(function (prev) {
              var updated = Object.assign({}, prev);
              delete updated[data.device_key];
              return updated;
            });
            setTimeoutError(displayName);
            setTimeout(function () {
              setTimeoutError(null);
            }, 5000);
          }
        } catch (e) {
          console.error("WebSocket parse error:", e);
        }
      };

      ws.onclose = function () {
        if (!isCleanedUp) {
          reconnectTimer = setTimeout(connectWS, 3000);
        }
      };
    }

    connectWS();
    return function () {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                sensorData={sensorData}
                chartData={chartData}
                deviceState={deviceState}
                isAutoMode={isAutoMode}
                pendingDevices={pendingDevices}
                setPendingDevices={setPendingDevices}
                currentTime={currentTime}
                timeoutError={timeoutError}
                setTimeoutError={setTimeoutError}
              />
            }
          />
          <Route path="/data-sensor" element={<DataSensor />} />
          <Route path="/action-history" element={<ActionHistory />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
