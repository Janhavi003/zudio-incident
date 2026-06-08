# Zudio Incident - Part A Audit Report

## Profiling Summary

The application was profiled before any fixes were applied. Response times and database query counts were collected to establish a baseline.

| Endpoint | Response Time | Query Count | Key Observation |
|-----------|--------------|-------------|----------------|
| GET /api/products | ~320 ms | 1 | Product listing endpoint operational |
| GET /api/products?search=shirt | ~275 ms | 1 | Search endpoint vulnerable to SQL injection |
| GET /api/orders/history | ~14.2 s | 201 | Excessive queries due to N+1 query pattern |
| POST /api/cart/checkout | ~905 ms | 3 | Coupon validation allows duplicate usage |
| POST /api/auth/register | ~48 ms | 1 | Passwords stored in plaintext |

---

# Bug Documentation

## Bug 1: Plaintext Password Storage

**Severity:** CRITICAL  
**File:** src/controllers/auth.controller.js  
**Line:** ~24-29, ~60-65

**Root Cause:**  
Passwords are stored directly in the database without hashing. During login, passwords are compared as plaintext.

**Reproduction Steps:**  
1. Register a user using POST `/api/auth/register`.  
2. Query the `users` table.  
3. Observe that the password is stored as plaintext.

**Affected Users / Impact:**  
All users; database exposure would compromise all credentials.

**Fix Plan:**  
Use bcrypt to hash passwords on registration and bcrypt.compare() on login.

---

## Bug 2: SQL Injection in Product Search

**Severity:** CRITICAL  
**File:** src/controllers/product.controller.js  
**Line:** ~13

**Root Cause:**  
User input is directly concatenated into SQL query strings, enabling SQL injection.

**Reproduction Steps:**  
1. GET `/api/products?search=' OR '1'='1`  
2. Observe that all products are returned or DB can be manipulated.

**Affected Users / Impact:**  
Any user; attackers can access or manipulate the database.

**Fix Plan:**  
Replace raw string concatenation with parameterized queries using `$1` placeholders.

---

## Bug 3: Double Discount Application

**Severity:** HIGH  
**File:** src/controllers/checkout.controller.js  
**Line:** ~39-70

**Root Cause:**  
Coupon validation and consumption are separate operations. Concurrent requests may apply the same coupon multiple times.

**Reproduction Steps:**  
1. Submit checkout with a valid coupon.  
2. Repeat checkout quickly with the same coupon.  
3. Observe that both orders receive the discount.

**Affected Users / Impact:**  
Revenue loss; multiple users or requests can exploit the same coupon.

**Fix Plan:**  
Use an atomic PostgreSQL `UPDATE ... WHERE used = false RETURNING *` for validation + consumption.

---

## Bug 4: Stock Never Decrements After Purchase

**Severity:** HIGH  
**File:** src/controllers/checkout.controller.js  
**Line:** ~72-80, ~106-114

**Root Cause:**  
Stock update logic is commented out; purchases do not reduce inventory.

**Reproduction Steps:**  
1. Check product stock.  
2. Complete a checkout.  
3. Query product stock again.  
4. Observe stock remains unchanged.

**Affected Users / Impact:**  
Inventory can go negative; overselling can occur.

**Fix Plan:**  
Include stock update inside the same transaction as order insert. Use `UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1`.

---

## Bug 5: N+1 Query in Order History

**Severity:** MEDIUM  
**File:** src/controllers/order.controller.js  
**Line:** ~14-34

**Root Cause:**  
Orders, order items, and product details were fetched with multiple nested queries, causing query count to scale linearly with data size.

**Reproduction Steps:**  
1. Login as a user with multiple orders.  
2. GET `/api/orders/history`.  
3. Observe hundreds of queries executed, slow response.

**Affected Users / Impact:**  
Users with many orders experience slow load times; server load increases.

**Fix Plan:**  
Replace nested queries with a single JOIN query combining orders, order items, and product info.

---

## Verification Table

| Bug | Before | After | Verification Method |
|-----|--------|-------|---------------------|
| SQL Injection | Returns all products | Returns 0 results (literal string) | GET /api/products?search=shirt' OR '1'='1 |
| Plaintext Passwords | Password column: "mypassword" | Password column: "$2b$12$..." | SELECT password FROM users WHERE id=1 |
| Double Discount | Coupon applied multiple times | Second attempt rejected (400) | POST /api/cart/checkout × 2 same coupon |
| Stock Decrement | Stock unchanged after purchase | Stock reduced correctly | GET /api/products before and after checkout |
| N+1 Order History | 14,200ms / 201 queries | ~180ms / 2 queries | Profiling middleware output |