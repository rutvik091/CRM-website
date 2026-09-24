# My Investment Manager

A modern web-based CRM and investment management system designed to manage clients, investments, insurance policies, reminders, and business activities from a centralized dashboard.

## 🚀 Overview

**My Investment Manager** is a CRM platform built to simplify day-to-day management of investment and insurance clients.

The application provides a centralized interface for managing client information, tracking policies and investments, monitoring important dates, and organizing follow-up activities.

## ✨ Features

* 📊 Dashboard with business overview
* 👥 Client management
* 💼 Investment and portfolio tracking
* 🛡️ Insurance policy management
* 📅 Policy and investment reminders
* 🔔 Follow-up and notification management
* 📈 Financial data visualization
* 🔎 Search and filtering
* 👤 User and role-based management
* 📱 Responsive interface
* 🎨 Modern and clean UI
* ⚡ Fast Vite-powered frontend

## 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Recharts

### Development

* Node.js
* npm
* Git
* GitHub

## 📁 Project Structure

```text
CRM-website/
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   └── ...
│
├── data/
├── public/
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 💻 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/rutvik091/CRM-website.git
```

### 2. Open the project

```bash
cd CRM-website
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

The application will then be available through the local development URL shown in the terminal.

## 🏗️ Production Build

To create a production build:

```bash
npx vite build
```

The production files will be generated inside:

```text
dist/
```

## 🌐 Deployment

The frontend is configured for deployment using **GitHub Pages** through GitHub Actions.

The deployment workflow is located at:

```text
.github/workflows/deploy.yml
```

Whenever changes are pushed to the `main` branch, the deployment workflow can build and publish the frontend.

## 🔐 Security

Do not commit sensitive information to this repository.

Never upload:

* API keys
* Passwords
* Authentication tokens
* Private credentials
* Database credentials
* `.env` files containing secrets
* Real customer or financial information

For local environment variables, use a local `.env` file and keep it excluded from Git.

Example:

```env
YOUR_API_KEY=your_api_key_here
```

> Never replace the placeholder with a real secret before committing the file.

## 📌 Important

This repository contains the frontend application and deployment configuration.

If a backend server or external database is required, it should be deployed separately using an appropriate backend hosting/service infrastructure.

## 📄 License

This project is currently provided for development and demonstration purposes.

## 👨‍💻 Author

**Rutvik**

GitHub:
https://github.com/rutvik091

---

⭐ If you find this project useful, consider giving the repository a star.
