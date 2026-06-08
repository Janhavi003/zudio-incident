# Zudio Incident - Part A Audit Report

## Profiling Summary

The application was profiled before making any code changes. Response times and database query counts were collected to establish a performance baseline and identify potential bottlenecks.

| Endpoint                       | Response Time | Query Count | Key Observation                                               |
| ------------------------------ | ------------- | ----------- | ------------------------------------------------------------- |
| GET /api/products              | ~320 ms       | 1           | Product listing endpoint functioning normally                 |
| GET /api/products?search=shirt | ~280 ms       | 1           | Search endpoint susceptible to SQL injection                  |
| GET /api/orders/history        | ~14.2 s       | 201         | Significant performance degradation due to N+1 queries        |
| POST /api/cart/checkout        | ~890 ms       | 3           | Coupon validation logic appears vulnerable to duplicate usage |
| POST /api/auth/register        | ~45 ms        | 1           | User credentials stored without password hashing              |

---

## Initial Findings

During profiling and endpoint exploration, the following issues were identified for further investigation:

* Potential SQL Injection vulnerability in product search.
* Passwords appear to be stored in plaintext.
* Coupon redemption process may allow duplicate discount application.
* Product stock does not decrease after successful purchases.
* Order history endpoint exhibits excessive database queries and slow response times.
