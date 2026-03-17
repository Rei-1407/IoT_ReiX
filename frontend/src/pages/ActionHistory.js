import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FaSearch } from "react-icons/fa";
import "./ActionHistory.css";

const API = "http://localhost:5000/api";

function ActionHistory() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [deviceType, setDeviceType] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);

  const getPageLimit = () => {
    const screenHeight = window.innerHeight;
    const rowHeight = 45;
    const headerSpace = 200;
    const available = screenHeight - headerSpace;
    return Math.max(5, Math.floor(available / rowHeight));
  };

  const [limit] = useState(getPageLimit());

  const fetchData = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/history`, {
          params: {
            page,
            limit: limit,
            device: deviceType,
            sort: sortOrder,
            search: search,
          },
        });
        setData(res.data.data);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error("Fetch history error:", err);
      }
      setLoading(false);
    },
    [deviceType, sortOrder, search],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // Badge màu cho status
  const getStatusBadge = (status) => {
    const map = {
      PENDING: { label: "Chờ", className: "badge-pending" },
      SUCCESS: { label: "Thành công", className: "badge-success" },
      FAILED: { label: "Thất bại", className: "badge-failed" },
    };
    const info = map[status] || { label: status, className: "" };
    return (
      <span className={`status-badge ${info.className}`}>{info.label}</span>
    );
  };

  // Phân trang kiểu Google
  const getPageNumbers = () => {
    const { page, totalPages } = pagination;
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);
      if (page <= 3) {
        start = 2;
        end = maxVisible;
      } else if (page >= totalPages - 2) {
        start = totalPages - maxVisible + 1;
        end = totalPages - 1;
      }
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="history-page">
      {/* HEADER + FILTERS */}
      <div className="page-header">
        <h2 className="page-title">📋 LỊCH SỬ THIẾT BỊ</h2>
        <div className="filters">
          <select
            className="filter-select"
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
          >
            <option value="">Tất cả thiết bị</option>
            <option value="fire">Báo cháy</option>
            <option value="light">Đèn ngủ</option>
            <option value="fan">Quạt gió</option>
            <option value="ac">Điều hòa</option>
          </select>

          <select
            className="filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Mới nhất</option>
            <option value="asc">Cũ nhất</option>
          </select>

          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <FaSearch className="search-icon" onClick={handleSearch} />
          </div>
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="table-container">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner-lg"></div>
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Thiết bị</th>
                <th>Hành động</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    <td className="td-id">#{row.id}</td>
                    <td className="td-device">
                      <span className="device-name-text">
                        {row.device_name}
                      </span>
                    </td>
                    <td className="td-action">
                      <span
                        className={`action-text ${row.action === "ON" ? "action-on" : "action-off"}`}
                      >
                        {row.action === "ON" ? "Bật" : "Tắt"}
                      </span>
                    </td>
                    <td className="td-status">{getStatusBadge(row.status)}</td>
                    <td className="td-time">{row.time_text}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PHÂN TRANG */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={pagination.page === 1}
            onClick={() => fetchData(pagination.page - 1)}
          >
            ‹
          </button>

          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`dot-${idx}`} className="page-dots">
                ...
              </span>
            ) : (
              <button
                key={p}
                className={`page-btn ${pagination.page === p ? "page-active" : ""}`}
                onClick={() => fetchData(p)}
              >
                {p}
              </button>
            ),
          )}

          <button
            className="page-btn"
            disabled={pagination.page === pagination.totalPages}
            onClick={() => fetchData(pagination.page + 1)}
          >
            ›
          </button>

          <span className="page-info">Tổng: {pagination.total} bản ghi</span>
        </div>
      )}
    </div>
  );
}

export default ActionHistory;
