import React, { useState, useEffect } from "react";
import {
  FaGithub,
  FaEnvelope,
  FaPhone,
  FaUniversity,
  FaIdBadge,
} from "react-icons/fa";
import { SiFigma } from "react-icons/si";
import { HiDocumentText } from "react-icons/hi";
import { MdApi } from "react-icons/md";
import "./Profile.css";

function Profile() {
  var info = {
    name: "Giang Hoàng Long",
    title: "Unreal Engine Engineer",
    mssv: "B22DCPT145",
    school: "Học viện Công nghệ Bưu chính Viễn thông",
    email: "LongGH.B22PT145@stu.ptit.edu.vn",
    phone: "0975522495",
    bio: "Xin chào, mình là Giang Hoàng Long, một Unreal Engine Engineer với niềm đam mê sâu sắc trong lĩnh vực Game Development và Game Design. Hiện đang theo học tại Học viện Công nghệ Bưu chính Viễn thông (PTIT), mình tập trung nghiên cứu chuyên sâu về Unreal Engine 5.5 và ngôn ngữ C++.",
    bio2: "Với tư duy kết hợp giữa kỹ thuật và thẩm mỹ, mình luôn tìm kiếm các giải pháp tối ưu và sẵn sàng thử nghiệm các công nghệ mới trong phát triển game.",
  };

  var tags = ["Unreal Engine Research", "Game Design", "Game Development"];
  var techStack = [
    "C/C++",
    "Unreal Engine 5.5",
    "Github",
    "GitLab",
    "Blender",
    "Figma",
  ];

  // Tính tỉ lệ scale theo viewport
  var [scale, setScale] = useState(1);

  useEffect(function () {
    function calcScale() {
      var sx = (window.innerWidth - 260 - 40) / 1100;
      var sy = (window.innerHeight - 40) / 600;
      setScale(Math.min(sx, sy, 1.8));
    }
    calcScale();
    window.addEventListener("resize", calcScale);
    return function () {
      window.removeEventListener("resize", calcScale);
    };
  }, []);

  return (
    <div className="profile-page">
      <div className="profile-content" style={{ "--profile-scale": scale }}>
        <div className="profile-left">
          <div className="avatar-section">
            <div className="avatar-wrapper">
              <img src="/avatar.png" alt="Avatar" className="avatar-img" />
            </div>
            <h2 className="profile-name">{info.name}</h2>
            <p className="profile-title">{info.title}</p>
            <div className="profile-tags">
              <span className="tag">{tags[0]}</span>
              <span className="tag">{tags[1]}</span>
              <span className="tag">{tags[2]}</span>
            </div>
          </div>

          <div className="contact-section">
            <h4 className="section-label">THÔNG TIN LIÊN HỆ</h4>
            <div className="contact-list">
              <div className="contact-item">
                <FaIdBadge className="contact-icon" />
                <span>{info.mssv}</span>
              </div>
              <div className="contact-item">
                <FaUniversity className="contact-icon" />
                <span>{info.school}</span>
              </div>
              <div className="contact-item">
                <FaEnvelope className="contact-icon" />
                <span>{info.email}</span>
              </div>
              <div className="contact-item">
                <FaPhone className="contact-icon" />
                <span>{info.phone}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-right">
          <div className="bio-section">
            <h3 className="section-title">GIỚI THIỆU</h3>
            <p className="bio-text">{info.bio}</p>
            <p className="bio-text">{info.bio2}</p>
          </div>

          <div className="tech-section">
            <h3 className="section-title">CÔNG NGHỆ</h3>
            <div className="tech-tags">
              <span className="tech-tag">{techStack[0]}</span>
              <span className="tech-tag">{techStack[1]}</span>
              <span className="tech-tag">{techStack[2]}</span>
              <span className="tech-tag">{techStack[3]}</span>
              <span className="tech-tag">{techStack[4]}</span>
              <span className="tech-tag">{techStack[5]}</span>
            </div>
          </div>

          <div className="links-section">
            <h3 className="section-title">TÀI LIỆU VÀ BÁO CÁO</h3>
            <div className="links-grid">
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <div className="link-icon" style={{ color: "#a259ff" }}>
                  <SiFigma />
                </div>
                <div className="link-info">
                  <span className="link-title">Figma Design</span>
                  <span className="link-subtitle">UI/UX Prototype</span>
                </div>
              </a>

              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <div className="link-icon" style={{ color: "#ef4444" }}>
                  <HiDocumentText />
                </div>
                <div className="link-info">
                  <span className="link-title">Báo cáo</span>
                  <span className="link-subtitle">Báo cáo hệ thống</span>
                </div>
              </a>

              <a
                href="http://localhost:5000/api-docs"
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <div className="link-icon" style={{ color: "#22c55e" }}>
                  <MdApi />
                </div>
                <div className="link-info">
                  <span className="link-title">API docs</span>
                  <span className="link-subtitle">Swagger / Endpoint</span>
                </div>
              </a>

              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="link-card"
              >
                <div className="link-icon" style={{ color: "#333" }}>
                  <FaGithub />
                </div>
                <div className="link-info">
                  <span className="link-title">Github</span>
                  <span className="link-subtitle">Repository</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
