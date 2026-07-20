# 💬 ChatApplication - Full-Stack Real-Time Workspace

A full-stack, real-time collaboration and messaging platform built with **Spring Boot**, **WebSockets (STOMP/SockJS)**, and vanilla **HTML5/CSS3/JavaScript**.

## ✨ Key Features
* 🔐 **User Authentication:** Registration, validation, secure login, and password reset workflows.
* 💬 **Public Channels:** Multi-channel group communication over WebSockets (`#general`).
* 🔒 **Private 1-on-1 Messaging:** Dynamic room generation (`userA_userB`) for isolated private messaging.
* ⚡ **Live Typing Indicators:** Real-time typing state broadcasts with automated timeout resets.
* 📂 **File & Media Sharing:** Attach images and files directly within chat conversations.
* 💾 **Persistent Chat Logs:** Database history loading via Spring Data JPA REST APIs upon joining a channel.

## 🛠️ Tech Stack
* **Backend:** Java, Spring Boot 3, Spring Data JPA, WebSockets (STOMP / SockJS)
* **Frontend:** HTML5, CSS3 (Glassmorphism & Light Theme), JavaScript (ES6+)
* **Database:** In-memory H2 Database

## 🚀 How to Run Locally

### 1. Backend Setup
```bash
cd backend
./mvnw spring-boot:run
