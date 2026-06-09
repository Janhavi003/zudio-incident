# Zudio Incident - Part B Architecture Redesign

## Current Architecture (Before Redesign)

```text
Internet Users
      │
      ▼

❌ No CDN
❌ No Load Balancer
❌ No Cache Layer

      │
      ▼

┌──────────────────────────────────────────────────┐
│        Single Node.js Express Server             │
│                                                  │
│  - Routes                                        │
│  - Controllers                                   │
│  - Business Logic                                │
│  - Database Queries                              │
│                                                  │
│  ⚠️ Single Point of Failure                      │
│     One crash causes complete outage             │
│                                                  │
│  ⚠️ Part A Bug #5                                │
│     N+1 query pattern in order history           │
│     Profiling: ~14.2s / ~201 queries             │
│                                                  │
│  ⚠️ Part A Bug #2                                │
│     Product search vulnerable to SQL injection   │
│                                                  │
│  ⚠️ No caching layer                             │
│     Every product request hits PostgreSQL        │
│                                                  │
│  ⚠️ No horizontal scaling                        │
│     All traffic handled by one process           │
└──────────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│          Single PostgreSQL Instance              │
│                                                  │
│  - Product Data                                  │
│  - Orders                                        │
│  - Users                                         │
│  - Coupons                                       │
│                                                  │
│  ⚠️ Reads and writes use same database           │
│     Checkout and product browsing compete        │
│     for the same resources                       │
│                                                  │
│  ⚠️ Part A Profiling Finding                     │
│     Order history generated excessive DB calls   │
│                                                  │
│  ⚠️ Missing foreign-key indexes                  │
│     Caused slow order-history lookups            │
│                                                  │
│  ⚠️ No read replicas                             │
│     All traffic goes to one database server      │
└──────────────────────────────────────────────────┘
```

## Weaknesses Identified from Part A

### 1. Single Point of Failure

The application runs on a single Node.js server. If the process crashes, the entire platform becomes unavailable.

### 2. No Caching Layer

Part A profiling showed product requests directly hitting PostgreSQL on every request. Frequently accessed data is repeatedly fetched from the database.

### 3. N+1 Query Problem

Part A Bug #5 revealed that order history performed hundreds of database queries for a single request, causing response times of approximately 14 seconds.

### 4. Shared Read and Write Database

Product browsing, checkout operations, stock updates, and order history all use the same PostgreSQL instance, creating resource contention under load.

### 5. Missing Database Indexes

Order history queries were slowed by missing indexes on foreign-key columns and access patterns.

### 6. No Horizontal Scalability

The application cannot efficiently support large traffic spikes because all requests are processed by a single application server.

---

# Proposed Architecture for 1 Lakh Users

```text
Internet Users
       │
       ▼
┌──────────────────────────────────┐
│              CDN                 │
│  Product Images + Static Assets  │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│         Load Balancer            │
│      Traffic Distribution        │
└──────────────────────────────────┘
       │
 ┌─────┼─────┐
 ▼     ▼     ▼

┌──────────┐  ┌──────────┐  ┌──────────┐
│ Node.js  │  │ Node.js  │  │ Node.js  │
│ Instance │  │ Instance │  │ Instance │
│    #1    │  │    #2    │  │    #3    │
└──────────┘  └──────────┘  └──────────┘
       │
       ▼
┌──────────────────────────────────┐
│          Redis Cluster           │
│ Product Cache + Coupon Locking   │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│      PostgreSQL Primary DB       │
│   Writes + Transactions Only     │
└──────────────────────────────────┘
       │
 ┌─────┴─────┐
 ▼           ▼

┌─────────────────────┐
│ PostgreSQL Replica  │
│ Product Reads       │
│ Order History       │
└─────────────────────┘

┌─────────────────────┐
│ PostgreSQL Replica  │
│ Analytics Queries   │
│ Reporting           │
└─────────────────────┘
```

## Architecture Decisions and Justification

### CDN

A CDN is added to serve product images and static assets closer to users. In the current architecture, all requests are routed through the application server, which increases unnecessary load and bandwidth usage.

### Load Balancer

A load balancer distributes traffic across multiple Node.js instances and removes the single point of failure identified in Part A. If one application server crashes, requests are automatically routed to healthy instances without causing a full outage.

### Multiple Node.js Instances

Part A showed that all traffic is handled by a single Express application. Running multiple stateless Node.js instances enables horizontal scaling and allows the platform to handle significantly higher traffic volumes during sales and peak shopping periods.

### Redis Cluster

Added because Part A profiling showed GET /api/products hitting PostgreSQL on every request. Caching product data in Redis with a short TTL reduces database load dramatically and allows frequently requested product lists to be served directly from memory.

Redis is also used for distributed coupon locking. This complements the coupon race-condition fix from Part A Bug #3 and prevents concurrent coupon redemption attempts across multiple application servers.

### PostgreSQL Primary Database

The primary database handles all write operations including checkout, stock updates, order creation, and coupon updates. Part A Bug #4 demonstrated that inventory consistency depends on transactional writes, so all critical write operations remain on the primary database.

### PostgreSQL Read Replicas

Part A Bug #5 identified order history as a read-heavy workload that generated excessive database activity. Routing product browsing and order-history requests to read replicas isolates read traffic from write traffic and prevents checkout operations from competing with large read workloads.

### Read/Write Separation

The redesigned architecture separates reads and writes into dedicated database paths. This prevents heavy read traffic from impacting transactional operations such as checkout, inventory updates, and coupon processing.

---

## Expected Improvements

| Area                  | Before                  | After                       |
| --------------------- | ----------------------- | --------------------------- |
| Application Servers   | 1                       | 3+                          |
| Load Balancer         | None                    | Present                     |
| Cache Layer           | None                    | Redis Cluster               |
| Product Reads         | PostgreSQL Only         | Redis + Read Replica        |
| Order History Reads   | Primary Database        | Read Replica                |
| Database Writes       | Primary Database        | Primary Database            |
| Fault Tolerance       | Single Point of Failure | Multi-Instance Architecture |
| Scalability           | Vertical Only           | Horizontal Scaling          |
| Static Asset Delivery | Application Server      | CDN                         |
