import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { AiFillHome } from "react-icons/ai";
import { FiBarChart2 } from "react-icons/fi";
import { MdHistory } from "react-icons/md";
import { RiProfileLine } from "react-icons/ri";
import "./Sidebar.css";

function Sidebar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(false);

  // Đồng hồ realtime — cập nhật mỗi giây
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // WebSocket — nhận trạng thái online/offline từ backend
  useEffect(() => {
    let ws;
    let reconnectTimer;
    let isCleanedUp = false;

    // Lấy trạng thái ESP32 ban đầu khi reload
    fetch("http://localhost:5000/api/health")
      .then((res) => res.json())
      .then((data) => setIsOnline(data.esp32_online || false))
      .catch(() => setIsOnline(false));

    const connectWS = () => {
      if (isCleanedUp) return;
      ws = new WebSocket("ws://localhost:5000");

      ws.onmessage = (event) => {
        try {
          const { event: evtName, data } = JSON.parse(event.data);
          // Nhận trạng thái ESP32 online/offline từ backend
          if (evtName === "esp32_status") {
            setIsOnline(data.online);
          }
          // Nếu nhận được sensor_data → ESP32 chắc chắn online
          if (evtName === "sensor_data") {
            setIsOnline(true);
          }
        } catch (e) {
          console.error("Sidebar WebSocket parse error:", e);
        }
      };

      ws.onclose = () => {
        setIsOnline(false);
        if (!isCleanedUp) {
          reconnectTimer = setTimeout(connectWS, 3000);
        }
      };

      ws.onerror = () => {
        setIsOnline(false);
      };
    };

    connectWS();

    return () => {
      isCleanedUp = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, []);

  const timeString = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // 4 menu items tương ứng 4 trang
  const menuItems = [
    { path: "/dashboard", icon: <AiFillHome />, label: "Dashboard" },
    { path: "/data-sensor", icon: <FiBarChart2 />, label: "Dữ liệu cảm biến" },
    {
      path: "/action-history",
      icon: <MdHistory />,
      label: "Lịch sử hoạt động",
    },
    { path: "/profile", icon: <RiProfileLine />, label: "Thông tin" },
  ];

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="logo-text">SmartHome</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-item ${isActive ? "nav-item-active" : ""}`
            }
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Status Panel — góc dưới sidebar */}
      <div className="sidebar-status">
        <div className={`status-badge ${isOnline ? "online" : "offline"}`}>
          {isOnline ? "Online" : "Offline"}
        </div>
        <div className="status-time">{timeString}</div>
        <div className="status-info">
          <div className="status-row">
            <span>Thiết bị</span>
            <span>Esp 32</span>
          </div>
          <div className="status-row">
            <span>Topic</span>
            <span>Theo dõi thông số nhà ở</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
