<div align="center">
  <img src="https://via.placeholder.com/150x150?text=AlgoConnect" alt="AlgoConnect Logo" width="120" />
  <h1>AlgoConnect</h1>
  <p><strong>A Modern CRM & Lead Management System for Algorithmic Trading & Brokerage Platforms</strong></p>

  <p>
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#environment-variables">Environment Variables</a>
  </p>
</div>

---

## 📝 Overview

**AlgoConnect** is a robust, full-stack Customer Relationship Management (CRM) platform designed specifically for managing leads, campaigns, and consent statuses within the algorithmic trading and financial brokerage industry. 

It streamlines the workflow for sales and support teams by providing real-time data enrichment, automated campaign triggers, and strict compliance controls (Do Not Contact lists, Channel-specific Opt-ins).

## ✨ Key Features

- **📊 Comprehensive Lead Management:** Track and manage leads with detailed contact information, sales stages, and engagement status.
- **🔄 Campaign Automation:** Create and schedule multi-channel campaigns (Email, SMS, WhatsApp) using customizable dynamic templates.
- **🛡️ Consent & Compliance (DNC):** Manage Do Not Contact (DNC) lists and specific channel opt-ins/opt-outs securely.
- **🌐 IP Management:** Keep track of IP assignments, active suspensions, and network allocations for infrastructure tracking.
- **🎨 Modern UI/UX:** A highly responsive, glassmorphic, and dynamic user interface built with React & TailwindCSS.
- **🔒 Secure Authentication:** JWT-based user authentication and role-based access control (RBAC).

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** TailwindCSS 4
- **Icons:** Lucide React
- **State/Routing:** React Router DOM
- **HTTP Client:** Axios
- **Rich Text:** React Quill

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js (TypeScript)
- **ORM:** Prisma Client
- **Database:** PostgreSQL
- **Authentication:** JSON Web Tokens (JWT) & bcrypt
- **File Uploads/Processing:** Multer, ExcelJS, SheetJS (xlsx)

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) database running locally or via cloud
- Package manager: `npm` or `yarn`

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/AlgoConnect.git
cd AlgoConnect
```

### 2. Backend Setup

```bash
cd server
npm install

# Push the database schema to your local Postgres instance
npx prisma db push
# Or generate the client
npx prisma generate

# Start the development server
npm run dev
```

### 3. Frontend Setup

Open a new terminal window:

```bash
cd frontend
npm install

# Start the Vite development server
npm run dev
```

The frontend will usually be accessible at `http://localhost:5173` and the backend API at `http://localhost:7700`.

---

## ⚙️ Environment Variables

To run this project, you will need to add the following environment variables.

### Backend (`server/.env`)

```env
# Server Port
PORT=7700

# Database Connection String
DATABASE_URL="postgresql://user:password@localhost:5432/algoconnect?schema=public"

# JWT Secret for Auth
JWT_SECRET="your_super_secret_key"
```

### Frontend (`frontend/.env`)

```env
# API Base URL
VITE_API_BASE_URL="http://localhost:7700/api"
```

> **Note:** Never commit `.env` files to version control. They are securely ignored via `.gitignore`.

---

## 📸 Screenshots

*(You can add screenshots of your application here)*

| Lead Management | Consent Management |
| :---: | :---: |
| <img src="https://via.placeholder.com/400x250?text=Lead+Dashboard" alt="Dashboard" /> | <img src="https://via.placeholder.com/400x250?text=Consent+UI" alt="Consent" /> |

---

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">
  <b>Built with ❤️ by the AlgoConnect Team</b>
</div>
