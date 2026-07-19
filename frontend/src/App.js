import React, { useState, useEffect, useRef } from "react";
import Dashboard from "./pages/Dashboard";
import "./App.css";

// ============================================
// KET NOI TRUC TIEP HIVEMQ CLOUD — KHONG CAN BACKEND
// User "webviewer" chi co quyen DOC (Subscribe only),
// nen de cong khai trong code cung khong sao.
// ============================================
var MQTT_URL =
  "wss://9de2b37f4ea043aaace96c3b4823539f.s1.eu.hivemq.cloud:8884/mqtt";
var MQTT_USER = "webviewer";
var MQTT_PASS = "12345678";
var TOPIC_SENSOR = "reix/sensor";
var TOPIC_STATUS = "reix/status";
var FIRE_TEMP = 50;

function App() {
  var [sensorData, setSensorData] = useState({ temp: 0, hum: 0, lux: 0 });
  var [chartData, setChartData] = useState([]);
  var [currentTime, setCurrentTime] = useState("");
  var [brokerConnected, setBrokerConnected] = useState(false);
  var [esp32Online, setEsp32Online] = useState(false);
  var [fireAlert, setFireAlert] = useState(false);
  var lastMsgRef = useRef(0);
  var lastNotifyRef = useRef(0);

  // Hien notification he thong khi chay (cooldown 60s de khong spam)
  function notifyFire(temp) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (Date.now() - lastNotifyRef.current < 60000) return;
    lastNotifyRef.current = Date.now();

    var title = "🔥 CẢNH BÁO CHÁY!";
    var options = {
      body:
        "Nhiệt độ trong nhà đang " +
        temp +
        "°C — vượt ngưỡng " +
        FIRE_TEMP +
        "°C. Kiểm tra ngay!",
      icon: "logo192.png",
      tag: "fire-alert",
    };

    // Uu tien hien qua service worker (bat buoc tren Android)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(function (reg) {
          return reg.showNotification(title, options);
        })
        .catch(function () {
          try {
            new Notification(title, options);
          } catch (e) {}
        });
    } else {
      try {
        new Notification(title, options);
      } catch (e) {}
    }
  }

  useEffect(function () {
    if (!window.mqtt) {
      console.error("Không tải được thư viện MQTT (mqtt.min.js)");
      return;
    }

    var client = window.mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });

    client.on("connect", function () {
      setBrokerConnected(true);
      client.subscribe([TOPIC_SENSOR, TOPIC_STATUS]);
    });

    client.on("close", function () {
      setBrokerConnected(false);
    });

    client.on("error", function (err) {
      console.error("MQTT error:", err && err.message);
    });

    client.on("message", function (topic, payload, packet) {
      try {
        var data = JSON.parse(payload.toString());

        // ESP32 bao online/offline (retained + Last Will)
        if (topic === TOPIC_STATUS) {
          setEsp32Online(!!data.online);
          return;
        }

        if (topic === TOPIC_SENSOR) {
          // retained = gia tri cu broker giu lai tu truoc, khong phai data song
          var isLive = !packet.retain;
          var now = new Date();
          var timeText = now.toLocaleTimeString("vi-VN", { hour12: false });

          setSensorData({
            temp: data.temp || 0,
            hum: data.hum || 0,
            lux: data.lux || 0,
          });
          setCurrentTime(now.toLocaleDateString("vi-VN") + " " + timeText);

          setChartData(function (prev) {
            var updated = prev.concat([
              { time: timeText, temp: data.temp, hum: data.hum, lux: data.lux },
            ]);
            return updated.length > 30 ? updated.slice(-30) : updated;
          });

          var onFire = data.fire === true || data.temp >= FIRE_TEMP;
          setFireAlert(onFire);

          if (isLive) {
            lastMsgRef.current = Date.now();
            setEsp32Online(true);
            if (onFire) notifyFire(data.temp);
          }
        }
      } catch (e) {
        console.error("MQTT parse error:", e);
      }
    });

    // > 8 giay khong co du lieu song -> coi nhu ESP32 mat tin hieu
    var timer = setInterval(function () {
      if (lastMsgRef.current && Date.now() - lastMsgRef.current > 8000) {
        setEsp32Online(false);
      }
    }, 2000);

    return function () {
      clearInterval(timer);
      client.end(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      <div className="main-content">
        <Dashboard
          sensorData={sensorData}
          chartData={chartData}
          currentTime={currentTime}
          brokerConnected={brokerConnected}
          esp32Online={esp32Online}
          fireAlert={fireAlert}
        />
      </div>
    </div>
  );
}

export default App;
