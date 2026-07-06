# AlgoConnect API Documentation

Yeh document Frontend aur Backend team ke integration ke liye banaya gaya hai.

## Base URL
`http://localhost:7700/api`

---

## 1. Authentication

### 1.1 Login
- **Endpoint:** `POST /auth/login`
- **Description:** Authenticate a user and return a JWT token.
- **Request Body (JSON):**
  ```json
  {
    "email": "admin@algoconnect.com",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

---

## 2. Leads Management

### 2.1 Get All Leads
- **Endpoint:** `GET /leads`
- **Description:** Get a paginated list of leads.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "message": "List of leads",
    "data": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890",
        "status": "NEW"
      }
    ]
  }
  ```

### 2.2 Import Leads
- **Endpoint:** `POST /leads/import`
- **Description:** Import multiple leads.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (JSON):**
  ```json
  {
    "leads": [
      { "name": "Alice", "phone": "1111111111" },
      { "name": "Bob", "email": "bob@example.com" }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Leads imported successfully"
  }
  ```

---
*Note: Yeh collection initial phase ke liye hai, jese-jese features add honge, ise update kiya jayega.*
