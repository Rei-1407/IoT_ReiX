import React from "react";
import Sidebar from "./Sidebar";
import "../App.css";

// Layout bọc tất cả các trang
// Sidebar bên trái, content bên phải
function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}

export default Layout;
