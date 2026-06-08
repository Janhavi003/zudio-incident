const { Pool } = require('pg')
const dotenv = require('dotenv')

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
})

// =========================
// Query Profiling Wrapper
// =========================
const originalQuery = pool.query.bind(pool)

pool.query = async (...args) => {
  try {
    if (global.currentRequest) {
      global.currentRequest._queryCount++
    }

    return await originalQuery(...args)
  } catch (err) {
    throw err
  }
}

module.exports = pool