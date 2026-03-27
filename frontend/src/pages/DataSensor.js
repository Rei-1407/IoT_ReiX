import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  FaSearch,
  FaThermometerHalf,
  FaTint,
  FaSun,
  FaFileExport,
} from "react-icons/fa";
import "./DataSensor.css";

var API = "http://localhost:5000/api";

function DataSensor() {
  var [data, setData] = useState([]);
  var [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  var [sensorType, setSensorType] = useState("");
  var [sortOrder, setSortOrder] = useState("desc");
  var [limit, setLimit] = useState(10);
  var [search, setSearch] = useState("");
  var [searchInput, setSearchInput] = useState("");
  var [loading, setLoading] = useState(true);
  var [firstLoad, setFirstLoad] = useState(true);
  var searchTimer = React.useRef(null);

  var fetchData = useCallback(
    async function (page) {
      if (firstLoad) setLoading(true);
      try {
        var res = await axios.get(API + "/sensors", {
          params: {
            page: page || 1,
            limit: limit,
            type: sensorType,
            sort: sortOrder,
            search: search,
          },
        });
        setData(res.data.data);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error("Fetch error:", err);
      }
      setLoading(false);
      setFirstLoad(false);
    },
    [sensorType, sortOrder, search, limit, firstLoad],
  );

  useEffect(
    function () {
      fetchData(1);
    },
    [fetchData],
  );

  var handleInputChange = function (value) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(function () {
      setSearch(value);
    }, 400);
  };

  var getSensorIcon = function (key) {
    if (key === "temperature")
      return <FaThermometerHalf className="table-icon icon-temp" />;
    if (key === "humidity") return <FaTint className="table-icon icon-hum" />;
    if (key === "light") return <FaSun className="table-icon icon-lux" />;
    return null;
  };

  var getPageNumbers = function () {
    var p = pagination.page,
      tp = pagination.totalPages,
      pages = [];
    if (tp <= 7) {
      for (var i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      var s = Math.max(2, p - 1),
        e = Math.min(tp - 1, p + 1);
      if (p <= 3) {
        s = 2;
        e = 5;
      } else if (p >= tp - 2) {
        s = tp - 4;
        e = tp - 1;
      }
      if (s > 2) pages.push("...");
      for (var j = s; j <= e; j++) pages.push(j);
      if (e < tp - 1) pages.push("...");
      pages.push(tp);
    }
    return pages;
  };

  var handleExport = async function () {
    try {
      var res = await axios.get(API + "/sensors", {
        params: {
          page: 1,
          limit: 999999,
          type: sensorType,
          sort: sortOrder,
          search: search,
        },
      });
      var csv = "\uFEFF" + "ID,Cảm biến,Giá trị,Đơn vị,Thời gian\n";
      res.data.data.forEach(function (r) {
        csv +=
          r.id +
          "," +
          r.sensor_name +
          "," +
          r.value_num +
          "," +
          r.unit +
          ',"' +
          r.time_text +
          '"\n';
      });
      var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download =
        "sensor_data_" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  return (
    <div className="datasensor-page">
      <div className="page-header">
        <h2 className="page-title">🌡️ Dữ liệu cảm biến</h2>
        <div className="filters">
          <select
            className="filter-select"
            value={sensorType}
            onChange={function (e) {
              setSensorType(e.target.value);
            }}
          >
            <option value="">Tất cả cảm biến</option>
            <option value="temperature">Nhiệt độ</option>
            <option value="humidity">Độ ẩm</option>
            <option value="light">Ánh sáng</option>
          </select>

          <select
            className="filter-select"
            value={sortOrder}
            onChange={function (e) {
              setSortOrder(e.target.value);
            }}
          >
            <option value="desc">Mới nhất</option>
            <option value="asc">Cũ nhất</option>
          </select>

          <select
            className="filter-select"
            value={limit}
            onChange={function (e) {
              setLimit(Number(e.target.value));
            }}
          >
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
            <option value={30}>30 dòng</option>
            <option value={40}>40 dòng</option>
          </select>

          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm theo thời gian..."
              value={searchInput}
              onChange={function (e) {
                handleInputChange(e.target.value);
              }}
              onKeyDown={function (e) {
                if (e.key === "Enter") setSearch(searchInput);
              }}
            />
            <FaSearch
              className="search-icon"
              onClick={function () {
                setSearch(searchInput);
              }}
            />
          </div>
        </div>
      </div>

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
                data.map(function (row) {
                  return (
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
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="page-footer">
        <button className="export-btn" onClick={handleExport}>
          <FaFileExport /> Export Data
        </button>
        {pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              disabled={pagination.page === 1}
              onClick={function () {
                fetchData(pagination.page - 1);
              }}
            >
              ‹
            </button>
            {getPageNumbers().map(function (p, idx) {
              if (p === "...")
                return (
                  <span key={"d" + idx} className="page-dots">
                    ...
                  </span>
                );
              return (
                <button
                  key={p}
                  className={
                    "page-btn " + (pagination.page === p ? "page-active" : "")
                  }
                  onClick={function () {
                    fetchData(p);
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="page-btn"
              disabled={pagination.page === pagination.totalPages}
              onClick={function () {
                fetchData(pagination.page + 1);
              }}
            >
              ›
            </button>
            <span className="page-info">Tổng: {pagination.total} bản ghi</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataSensor;
