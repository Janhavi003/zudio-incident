# Zudio API Contracts

---

# [POST] /api/auth/register

**Auth required:** No
**Content-Type:** application/json

## Request

```json
{
  "name": "Janhavi",
  "email": "janhavi@example.com",
  "password": "Password123",
  "phone": "9876543210"
}
```

Required:

* name (string)
* email (valid email)
* password (min 8 chars)

Optional:

* phone (string)

## Success Response — 201

```json
{
  "message": "Registration successful",
  "token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Janhavi",
    "email": "janhavi@example.com"
  }
}
```

## Error Responses

| HTTP Status | Error Code       | When This Occurs         |
| ----------- | ---------------- | ------------------------ |
| 400         | MISSING_FIELDS   | Required fields missing  |
| 409         | EMAIL_EXISTS     | Email already registered |
| 422         | VALIDATION_ERROR | Invalid email/password   |
| 500         | INTERNAL_ERROR   | Unexpected error         |

### Error Response Shape

```json
{
  "error": "EMAIL_EXISTS",
  "message": "Email already registered",
  "details": {}
}
```

---

# [POST] /api/auth/login

**Auth required:** No
**Content-Type:** application/json

## Request

```json
{
  "email": "janhavi@example.com",
  "password": "Password123"
}
```

## Success Response — 200

```json
{
  "message": "Login successful",
  "token": "jwt-token"
}
```

## Error Responses

| HTTP Status | Error Code          | When This Occurs     |
| ----------- | ------------------- | -------------------- |
| 400         | MISSING_FIELDS      | Missing credentials  |
| 401         | INVALID_CREDENTIALS | Wrong email/password |
| 422         | VALIDATION_ERROR    | Invalid request      |
| 500         | INTERNAL_ERROR      | Unexpected error     |

---

# [GET] /api/products

**Auth required:** No

## Request

Query Parameters:

```text
search (optional)
category (optional)
limit (optional)
offset (optional)
```

## Success Response — 200

```json
{
  "products": [
    {
      "id": 1,
      "name": "Black T-Shirt",
      "price": 499
    }
  ],
  "count": 1
}
```

## Error Responses

| HTTP Status | Error Code         | When This Occurs   |
| ----------- | ------------------ | ------------------ |
| 400         | INVALID_QUERY      | Invalid parameters |
| 404         | PRODUCTS_NOT_FOUND | No products found  |
| 422         | VALIDATION_ERROR   | Invalid pagination |
| 500         | INTERNAL_ERROR     | Unexpected error   |

---

# [GET] /api/products/:id

**Auth required:** No

## Request

Path Parameter:

```text
id (integer)
```

## Success Response — 200

```json
{
  "id": 1,
  "name": "Black T-Shirt",
  "price": 499,
  "stock": 20
}
```

## Error Responses

| HTTP Status | Error Code        | When This Occurs   |
| ----------- | ----------------- | ------------------ |
| 400         | INVALID_ID        | Invalid product ID |
| 404         | PRODUCT_NOT_FOUND | Product missing    |
| 422         | VALIDATION_ERROR  | Bad input          |
| 500         | INTERNAL_ERROR    | Unexpected error   |

---

# [POST] /api/cart/checkout

**Auth required:** Yes (Bearer JWT)

**Content-Type:** application/json

## Request

```json
{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "couponCode": "WELCOME100",
  "shippingAddress": "Mumbai"
}
```

## Success Response — 201

```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 101
  }
}
```

## Error Responses

| HTTP Status | Error Code         | When This Occurs    |
| ----------- | ------------------ | ------------------- |
| 400         | INVALID_COUPON     | Coupon expired/used |
| 400         | INSUFFICIENT_STOCK | Stock unavailable   |
| 401         | UNAUTHORIZED       | Missing token       |
| 422         | VALIDATION_ERROR   | Invalid payload     |
| 500         | INTERNAL_ERROR     | Unexpected error    |

---

# [GET] /api/orders/history

**Auth required:** Yes (Bearer JWT)

## Request

No request body.

## Success Response — 200

```json
{
  "orders": [
    {
      "id": 1,
      "status": "delivered",
      "items": []
    }
  ]
}
```

## Error Responses

| HTTP Status | Error Code       | When This Occurs |
| ----------- | ---------------- | ---------------- |
| 401         | UNAUTHORIZED     | Invalid token    |
| 404         | NO_ORDERS        | No orders found  |
| 422         | VALIDATION_ERROR | Invalid request  |
| 500         | INTERNAL_ERROR   | Unexpected error |

---

# [PATCH] /api/orders/:id/status

**Auth required:** Yes (Admin JWT)

**Content-Type:** application/json

## Request

```json
{
  "status": "shipped"
}
```

Allowed values:

```text
pending
confirmed
shipped
delivered
cancelled
```

## Success Response — 200

```json
{
  "message": "Order status updated"
}
```

## Error Responses

| HTTP Status | Error Code      | When This Occurs   |
| ----------- | --------------- | ------------------ |
| 400         | INVALID_STATUS  | Unsupported status |
| 401         | UNAUTHORIZED    | Missing token      |
| 403         | FORBIDDEN       | User not admin     |
| 404         | ORDER_NOT_FOUND | Invalid order      |
| 500         | INTERNAL_ERROR  | Unexpected error   |

---

# [GET] /api/health

**Auth required:** No

## Request

No request body.

## Success Response — 200

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T10:00:00Z"
}
```

## Error Responses

| HTTP Status | Error Code          | When This Occurs     |
| ----------- | ------------------- | -------------------- |
| 500         | DATABASE_DOWN       | Database unavailable |
| 500         | SERVICE_UNAVAILABLE | Service unhealthy    |
| 500         | INTERNAL_ERROR      | Unexpected error     |

### Error Response Shape

```json
{
  "error": "MACHINE_READABLE_CODE",
  "message": "Human readable message",
  "details": {}
}
```
