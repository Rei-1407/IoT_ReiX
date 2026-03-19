import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { FaSearch, FaThermometerHalf, FaTint, FaSun } from "react-icons/fa";
import "./DataSensor.css";

const API = "http://localhost:5000/api";

function DataSensor() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [sensorType, setSensorType] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimer = React.useRef(null);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  // Tự tính số dòng theo chiều cao màn hình
  const getPageLimit = () => {
    const screenHeight = window.innerHeight;
    const rowHeight = 45; // Chiều cao mỗi dòng (px)
    const headerSpace = 200; // Header + filter + pagination + padding
    const available = screenHeight - headerSpace;
    return Math.max(5, Math.floor(available / rowHeight));
  };

  const [limit] = useState(getPageLimit());

  // Fetch data từ backend — mọi logic xử lý ở backend
  const fetchData = useCallback(
    async (page = 1) => {
      if (firstLoad) setLoading(true);
      try {
        const res = await axios.get(`${API}/sensors`, {
          params: {
            page,
            limit: limit,
            type: sensorType,
            sort: sortOrder,
            search: search,
          },
        });
        setData(res.data.data);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error("Fetch sensor data error:", err);
      }
      setLoading(false);
      setFirstLoad(false);
    },
    [sensorType, sortOrder, search],
  );

  // Fetch lại khi filter/sort/search thay đổi
  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // Xử lý tìm kiếm khi nhấn Enter hoặc click icon
  const handleSearch = () => {
    setSearch(searchInput);
  };

  // Tìm realtime: gõ tới đâu ra tới đó (debounce 400ms)
  const handleInputChange = (value) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Icon theo loại cảm biến
  const getSensorIcon = (sensorKey) => {
    switch (sensorKey) {
      case "temperature":
        return <FaThermometerHalf className="table-icon icon-temp" />;
      case "humidity":
        return <FaTint className="table-icon icon-hum" />;
      case "light":
        return <FaSun className="table-icon icon-lux" />;
      default:
        return null;
    }
  };

  // Tạo danh sách số trang: 1 2 3 ... 10
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
    <div className="datasensor-page">
      {/* HEADER + FILTERS */}
      <div className="page-header">
        <h2 className="page-title">🌡️ Dữ liệu cảm biến</h2>
        <div className="filters">
          {/* Dropdown lọc loại cảm biến */}
          <select
            className="filter-select"
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value)}
          >
            <option value="">Tất cả cảm biến</option>
            <option value="temperature">Nhiệt độ</option>
            <option value="humidity">Độ ẩm</option>
            <option value="light">Ánh sáng</option>
          </select>

          {/* Dropdown sắp xếp */}
          <select
            className="filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="desc">Mới nhất</option>
            <option value="asc">Cũ nhất</option>
          </select>

          {/* Ô tìm kiếm */}
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm..."
              value={searchInput}
              onChange={(e) => handleInputChange(e.target.value)}
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
                <th>Cảm biến</th>
                <th>Giá trị</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan="4" className="no-data">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id}>
                    <td className="td-id">#{row.id}</td>
                    <td className="td-sensor">
                      {getSensorIcon(row.sensor_key)}
                      <span>{row.sensor_name}</span>
                    </td>
                    <td className="td-value">
                      <span className="value-number">{row.value_num}</span>
                      <span className="value-unit">{row.unit}</span>
                    </td>
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

export default DataSensor;
