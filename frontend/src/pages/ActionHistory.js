import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  FaSearch,
  FaFileExport,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import "./ActionHistory.css";

var API = "http://localhost:5000/api";

function ActionHistory() {
  var [data, setData] = useState([]);
  var [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  var [deviceType, setDeviceType] = useState("");
  var [sortOrder, setSortOrder] = useState("desc");
  var [search, setSearch] = useState("");
  var [searchInput, setSearchInput] = useState("");
  var [loading, setLoading] = useState(true);
  var [firstLoad, setFirstLoad] = useState(true);
  var searchTimer = React.useRef(null);
  var [showTimeFilter, setShowTimeFilter] = useState(false);
  var [timeFrom, setTimeFrom] = useState("");
  var [timeTo, setTimeTo] = useState("");
  var [appliedTimeFrom, setAppliedTimeFrom] = useState("");
  var [appliedTimeTo, setAppliedTimeTo] = useState("");

  var getPageLimit = function () {
    return Math.max(5, Math.floor((window.innerHeight - 220) / 45));
  };
  var [limit] = useState(getPageLimit());

  var fetchData = useCallback(
    async function (page) {
      if (firstLoad) setLoading(true);
      try {
        var res = await axios.get(API + "/history", {
          params: {
            page: page || 1,
            limit: limit,
            device: deviceType,
            sort: sortOrder,
            search: search,
            timeFrom: appliedTimeFrom,
            timeTo: appliedTimeTo,
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
    [
      deviceType,
      sortOrder,
      search,
      limit,
      appliedTimeFrom,
      appliedTimeTo,
      firstLoad,
    ],
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

  var getStatusBadge = function (status) {
    var m = {
      PENDING: { l: "Chờ", c: "badge-pending" },
      SUCCESS: { l: "Thành công", c: "badge-success" },
      FAILED: { l: "Thất bại", c: "badge-failed" },
    };
    var info = m[status] || { l: status, c: "" };
    return <span className={"status-badge " + info.c}>{info.l}</span>;
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
      var res = await axios.get(API + "/history", {
        params: {
          page: 1,
          limit: 999999,
          device: deviceType,
          sort: sortOrder,
          search: search,
          timeFrom: appliedTimeFrom,
          timeTo: appliedTimeTo,
        },
      });
      var csv = "\uFEFF" + "ID,Thiết bị,Hành động,Trạng thái,Thời gian\n";
      res.data.data.forEach(function (r) {
        var act = r.action === "ON" ? "Bật" : "Tắt";
        var st =
          r.status === "SUCCESS"
            ? "Thành công"
            : r.status === "FAILED"
              ? "Thất bại"
              : "Chờ";
        csv +=
          r.id +
          "," +
          r.device_name +
          "," +
          act +
          "," +
          st +
          ',"' +
          r.time_text +
          '"\n';
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      );
      a.download =
        "action_history_" + new Date().toISOString().slice(0, 10) + ".csv";
      a.click();
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <h2 className="page-title">📋 LỊCH SỬ THIẾT BỊ</h2>
        <div className="filters">
          <select
            className="filter-select"
            value={deviceType}
            onChange={function (e) {
              setDeviceType(e.target.value);
            }}
          >
            <option value="">Tất cả thiết bị</option>
            <option value="fire">Báo cháy</option>
            <option value="light">Đèn ngủ</option>
            <option value="fan">Quạt gió</option>
            <option value="ac">Điều hòa</option>
          </select>

          <div className="sort-time-wrapper">
            <button
              className="filter-btn"
              onClick={function () {
                setShowTimeFilter(!showTimeFilter);
              }}
            >
              {sortOrder === "desc" ? "Mới nhất" : "Cũ nhất"}{" "}
              {showTimeFilter ? <FaChevronUp /> : <FaChevronDown />}
            </button>
            {showTimeFilter && (
              <div className="time-filter-dropdown">
                <div className="tf-row">
                  <label>Sắp xếp:</label>
                  <select
                    className="tf-select"
                    value={sortOrder}
                    onChange={function (e) {
                      setSortOrder(e.target.value);
                    }}
                  >
                    <option value="desc">Mới nhất</option>
                    <option value="asc">Cũ nhất</option>
                  </select>
                </div>
                <div className="tf-row">
                  <label>Từ:</label>
                  <input
                    type="datetime-local"
                    className="tf-input"
                    value={timeFrom}
                    onChange={function (e) {
                      setTimeFrom(e.target.value);
                    }}
                  />
                </div>
                <div className="tf-row">
                  <label>Đến:</label>
                  <input
                    type="datetime-local"
                    className="tf-input"
                    value={timeTo}
                    onChange={function (e) {
                      setTimeTo(e.target.value);
                    }}
                  />
                </div>
                <div className="tf-actions">
                  <button
                    className="tf-btn tf-apply"
                    onClick={function () {
                      setAppliedTimeFrom(timeFrom);
                      setAppliedTimeTo(timeTo);
                      setShowTimeFilter(false);
                    }}
                  >
                    Áp dụng
                  </button>
                  <button
                    className="tf-btn tf-clear"
                    onClick={function () {
                      setTimeFrom("");
                      setTimeTo("");
                      setAppliedTimeFrom("");
                      setAppliedTimeTo("");
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm..."
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
                data.map(function (row) {
                  return (
                    <tr key={row.id}>
                      <td className="td-id">#{row.id}</td>
                      <td className="td-device">
                        <span className="device-name-text">
                          {row.device_name}
                        </span>
                      </td>
                      <td className="td-action">
                        <span
                          className={
                            "action-text " +
                            (row.action === "ON" ? "action-on" : "action-off")
                          }
                        >
                          {row.action === "ON" ? "Bật" : "Tắt"}
                        </span>
                      </td>
                      <td className="td-status">
                        {getStatusBadge(row.status)}
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

export default ActionHistory;
