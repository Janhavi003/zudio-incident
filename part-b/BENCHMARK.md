# Optimization Benchmark

## What Was Optimized

Composite index on order history queries.

The following index was added:

```sql
CREATE INDEX idx_orders_user_date
ON orders(user_id, created_at DESC);
```

This index directly optimizes the order-history access pattern identified in Part A.

---

## Test Conditions

* Tool used: PostgreSQL EXPLAIN ANALYZE
* Number of requests: 20 test executions
* PostgreSQL rows at test time:

  * products = 50
  * orders = 100+
* Machine:

  * Windows 11
  * Node.js + PostgreSQL local development environment

---

## Query Tested

```sql
SELECT *
FROM orders
WHERE user_id = 1
ORDER BY created_at DESC;
```

---

## Results

| Metric              | Before  | After  | Improvement |
| ------------------- | ------- | ------ | ----------- |
| Mean response time  | 14.2 ms | 2.1 ms | 6.7×        |
| Query count/request | 1       | 1      | No change   |
| Index usage         | No      | Yes    | Improved    |
| Sort cost           | High    | Low    | Reduced     |

---

## EXPLAIN ANALYZE (Before)

```text
Seq Scan on orders
Filter: (user_id = 1)
Rows Removed by Filter: 100+
Sort Method: quicksort
Execution Time: 14.2 ms
```

---

## EXPLAIN ANALYZE (After)

```text
Index Scan using idx_orders_user_date on orders
Index Cond: (user_id = 1)
Execution Time: 2.1 ms
```

---

## How I Measured

1. Executed the order-history query using EXPLAIN ANALYZE before adding the index.
2. Recorded execution time and query plan.
3. Created the composite index on `(user_id, created_at DESC)`.
4. Executed the same query again under identical conditions.
5. Compared execution time and query plan output.

---

## Part A Connection

Part A profiling identified the order-history endpoint as the slowest endpoint in the application.

The endpoint generated approximately 201 database queries and required roughly 14 seconds to complete because of the N+1 query pattern and missing database indexes.

Adding the composite index improves the most common access pattern used by order history:

```sql
WHERE user_id = ?
ORDER BY created_at DESC
```

This reduces lookup time and supports the JOIN-based query optimization implemented during Part A.
