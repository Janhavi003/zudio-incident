-- Migration: 003_order_history_index.sql
-- Purpose:
-- Optimize order history queries by adding a composite index
-- on (user_id, created_at DESC).
--
-- Part B Optimization:
-- Addresses Part A Bug #5 (N+1 Query Performance Issue)
-- and improves the common access pattern:
--
-- SELECT *
-- FROM orders
-- WHERE user_id = ?
-- ORDER BY created_at DESC;
--
-- Expected Benefits:
-- - Faster order history retrieval
-- - Reduced sort cost
-- - Improved query planning
-- - Better scalability for large order tables

CREATE INDEX IF NOT EXISTS idx_orders_user_date
ON orders(user_id, created_at DESC);

-- Verify index creation
-- \d orders

-- Example benchmark query
-- EXPLAIN ANALYZE
-- SELECT *
-- FROM orders
-- WHERE user_id = 1
-- ORDER BY created_at DESC;