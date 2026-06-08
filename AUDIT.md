# Zudio Incident - Part A Audit Report

## Profiling Summary

The application was profiled before applying any fixes. Endpoint response times and database query counts were collected to establish a baseline and identify areas requiring investigation.

| Endpoint                       | Response Time | Query Count | Key Observation                                   |
| ------------------------------ | ------------- | ----------- | ------------------------------------------------- |
| GET /api/products              | ~320 ms       | 1           | Product listing endpoint operational              |
| GET /api/products?search=shirt | ~275 ms       | 1           | Search endpoint vulnerable to SQL injection       |
| GET /api/orders/history        | ~14.2 s       | 201         | Excessive database calls indicate N+1 query issue |
| POST /api/cart/checkout        | ~905 ms       | 3           | Coupon validation susceptible to duplicate usage  |
| POST /api/auth/register        | ~48 ms        | 1           | Passwords stored without hashing                  |

---

# Bug Documentation

## Bug 1: Plaintext Password Storage

**Severity:** CRITICAL

**File:** src/controllers/auth.controller.js

**Line:** Approx. 24-29, 60-65

**Root Cause:**
Passwords are stored directly in the database without hashing. During authentication, user passwords are compared as plaintext strings instead of using a secure password hashing mechanism.

**Reproduction Steps:**

1. Register a new user using POST `/api/auth/register`.
2. Query the users table directly.
3. Observe that the password value is stored exactly as entered.

**Expected vs Actual:**

* Expected: Passwords should be stored as bcrypt hashes.
* Actual: Passwords are stored in plaintext.

**Affected Users / Impact:**
All registered users are affected. Any database compromise immediately exposes user credentials.

**Fix Plan:**
Implement bcrypt hashing during registration and bcrypt.compare() during login authentication.

---

## Bug 2: SQL Injection in Product Search

**Severity:** CRITICAL

**File:** src/controllers/product.controller.js

**Line:** Approx. 13

**Root Cause:**
User-controlled input is concatenated directly into the SQL query string, allowing malicious input to manipulate query execution.

**Reproduction Steps:**

1. Send:
   GET `/api/products?search=' OR '1'='1`
2. Observe search endpoint behavior.
3. Compare the response against a normal search request.

**Expected vs Actual:**

* Expected: Search input should be treated as plain text.
* Actual: Input can alter SQL query behavior.

**Affected Users / Impact:**
Potential unauthorized access to database records and exposure of sensitive data.

**Fix Plan:**
Replace string concatenation with parameterized PostgreSQL queries using placeholders.

---

## Bug 3: Double Discount Application

**Severity:** HIGH

**File:** src/controllers/checkout.controller.js

**Line:** Approx. 39-70

**Root Cause:**
Coupon validation and coupon consumption occur as separate database operations. Concurrent requests can validate the same coupon before either request marks it as used.

**Reproduction Steps:**

1. Submit a checkout request using a valid coupon.
2. Quickly submit another checkout request using the same coupon.
3. Observe that both requests can receive the discount.

**Expected vs Actual:**

* Expected: Coupon should only be applied once.
* Actual: Multiple requests can redeem the same coupon.

**Affected Users / Impact:**
Causes revenue loss due to duplicate coupon redemption.

**Fix Plan:**
Use a single atomic database operation to validate and consume the coupon simultaneously.

---

## Bug 4: Stock Never Decrements After Purchase

**Severity:** HIGH

**File:** src/controllers/checkout.controller.js

**Line:** Approx. 72-80 and 106-114

**Root Cause:**
The stock update logic is commented out and never executes after a successful purchase.

**Reproduction Steps:**

1. Check current product stock.
2. Complete a checkout.
3. Query the product again.
4. Observe stock remains unchanged.

**Expected vs Actual:**

* Expected: Stock should decrease by purchased quantity.
* Actual: Stock remains unchanged after order completion.

**Affected Users / Impact:**
Inventory data becomes inaccurate, allowing products to be oversold.

**Fix Plan:**
Re-enable stock updates and move order creation plus stock decrement into a single database transaction.

---

## Bug 5: N+1 Query in Order History

**Severity:** MEDIUM

**File:** src/controllers/order.controller.js

**Line:** Approx. 14-34

**Root Cause:**
The endpoint fetches orders, then fetches order items for each order, and finally fetches product information for each item individually. Query count increases linearly with dataset size.

**Reproduction Steps:**

1. Login with a user that has multiple orders.
2. Call GET `/api/orders/history`.
3. Observe high query counts and slow response times.
4. Check profiling logs.

**Expected vs Actual:**

* Expected: Order history should be retrieved with a minimal number of optimized queries.
* Actual: Hundreds of database queries may execute for a single request.

**Affected Users / Impact:**
Users with larger order histories experience slow page loads and increased database load.

**Fix Plan:**
Replace nested queries with a single JOIN query that retrieves orders, order items, and product details together.

---

## Verification Table

| Bug                 | Before                          | After                   | Verification Method                     |
| ------------------- | ------------------------------- | ----------------------- | --------------------------------------- |
| SQL Injection       | Vulnerable query construction   | Parameterized query     | GET /api/products?search=' OR '1'='1    |
| Plaintext Passwords | Stored as plain text            | Stored as bcrypt hash   | Database query on users table           |
| Double Discount     | Same coupon can be reused       | Coupon usable once      | Two checkout requests using same coupon |
| Stock Decrement     | Stock unchanged after checkout  | Stock reduced correctly | Compare stock before and after purchase |
| N+1 Query           | Hundreds of queries per request | Optimized JOIN query    | Profiling middleware output             |
