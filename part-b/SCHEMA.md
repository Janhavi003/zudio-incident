# PostgreSQL Schema Redesign

## Goals

The redesigned schema addresses the issues discovered in Part A:

* Missing constraints allowed invalid data.
* Order history performance suffered because foreign-key columns were not indexed.
* Inventory consistency relied entirely on application code.
* User roles were unrestricted.
* Order history queries were not optimized.
* Database integrity rules were not enforced at the schema level.

---

# Categories Table

```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

# Users Table

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password TEXT NOT NULL,

    phone VARCHAR(20),

    role VARCHAR(20) NOT NULL DEFAULT 'customer'
        CHECK (role IN ('customer', 'admin')),

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_users_email
ON users(email);
```

### Why This Change?

* `password NOT NULL` ensures incomplete user accounts cannot be created.
* `role CHECK (...)` prevents invalid role values.
* Supports the authentication improvements introduced after Part A Bug #1 (Plaintext Password Storage).

---

# Products Table

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    price NUMERIC(10,2) NOT NULL
        CHECK (price >= 0),

    stock INTEGER NOT NULL DEFAULT 0
        CHECK (stock >= 0),

    category_id INTEGER NOT NULL
        REFERENCES categories(id)
        ON DELETE RESTRICT,

    image_url TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_products_category_id
ON products(category_id);
```

### Why This Change?

* `stock >= 0` prevents negative inventory.
* Directly addresses the overselling risk identified in Part A Bug #4 (Stock Decrement).
* Foreign key guarantees every product belongs to a valid category.

---

# Orders Table

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    total_amount NUMERIC(10,2) NOT NULL
        CHECK (total_amount >= 0),

    discount NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (discount >= 0),

    shipping_address TEXT NOT NULL,

    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'shipped',
                'delivered',
                'cancelled'
            )
        ),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_orders_user_id
ON orders(user_id);

CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

### Why This Change?

* `user_id NOT NULL` prevents orphaned orders.
* Composite index `(user_id, created_at DESC)` directly optimizes order-history lookups.
* Addresses the profiling results from Part A Bug #5 (N+1 Query Performance Issue).

---

# Order Items Table

```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id INTEGER NOT NULL
        REFERENCES products(id)
        ON DELETE RESTRICT,

    unit_price_at_purchase NUMERIC(10,2) NOT NULL
        CHECK (unit_price_at_purchase >= 0),

    quantity INTEGER NOT NULL
        CHECK (quantity > 0),

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_order_items_order_id
ON order_items(order_id);

CREATE INDEX idx_order_items_product_id
ON order_items(product_id);
```

### Why This Change?

* `quantity > 0` prevents invalid purchases.
* `ON DELETE CASCADE` ensures order items are removed when an order is deleted.
* Historical pricing is preserved using `unit_price_at_purchase`.
* Foreign-key indexes improve order-history performance.

---

# Coupons Table

```sql
CREATE TABLE coupons (
    id SERIAL PRIMARY KEY,

    code VARCHAR(50) NOT NULL UNIQUE,

    discount_amount NUMERIC(10,2) NOT NULL
        CHECK (discount_amount >= 0),

    used BOOLEAN NOT NULL DEFAULT FALSE,

    expires_at TIMESTAMP NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_coupons_code
ON coupons(code);
```

### Why This Change?

* Coupon codes remain unique and indexed.
* Supports atomic coupon redemption introduced to fix Part A Bug #3 (Double Discount Application).

---

# Foreign Key Relationships

```text
categories
    │
    └── products.category_id

users
    │
    └── orders.user_id

orders
    │
    └── order_items.order_id

products
    │
    └── order_items.product_id
```

---

# Commentary: Connection to Part A Findings

## Part A Bug #1 - Plaintext Password Storage

The schema enforces `password NOT NULL`, while application logic stores bcrypt hashes instead of plaintext passwords.

## Part A Bug #3 - Double Discount Application

Coupon codes are indexed and designed for atomic updates using database transactions.

## Part A Bug #4 - Stock Decrement Failure

`CHECK (stock >= 0)` prevents inventory from becoming negative even if application logic fails.

## Part A Bug #5 - N+1 Query Performance Issue

Indexes were added to every foreign-key column used in joins and filtering.

The composite index:

```sql
CREATE INDEX idx_orders_user_created
ON orders(user_id, created_at DESC);
```

specifically optimizes the order-history access pattern identified during profiling.

## Additional Integrity Improvements

* All required columns use `NOT NULL`.
* Business rules are enforced through `CHECK` constraints.
* Foreign-key relationships guarantee referential integrity.
* Explicit `ON DELETE` behavior prevents accidental data corruption.

---

# Normalization Level

The redesigned schema follows Third Normal Form (3NF):

1. Each table represents a single entity.
2. Non-key attributes depend only on the primary key.
3. Relationships are represented using foreign keys.
4. Duplicate product information is removed.
5. Historical prices are preserved separately as `unit_price_at_purchase`.
