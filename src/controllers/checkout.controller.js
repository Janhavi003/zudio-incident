const pool = require('../db')

// Checkout controller with transaction and atomic coupon update
const checkout = async (req, res) => {
  const client = await pool.connect()

  try {
    const userId = req.user.userId
    const { items, couponCode, shippingAddress } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' })
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: 'Shipping address is required' })
    }

    await client.query('BEGIN') // start transaction

    // Fetch all products and calculate total
    let totalAmount = 0
    const cartItems = []

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, stock FROM products WHERE id = $1',
        [item.productId]
      )
      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.productId} not found`)
      }

      const product = productResult.rows[0]

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`)
      }

      totalAmount += parseFloat(product.price) * item.quantity
      cartItems.push({ ...item, product })
    }

    let discount = 0
    let couponId = null

    // Atomic coupon validation and consumption
    if (couponCode) {
      const couponResult = await client.query(
        `UPDATE coupons
         SET used = true
         WHERE code = $1 AND used = false AND expires_at > NOW()
         RETURNING *`,
        [couponCode]
      )

      if (couponResult.rows.length === 0) {
        throw new Error('Coupon already used or expired')
      }

      const coupon = couponResult.rows[0]
      couponId = coupon.id
      discount = parseFloat(coupon.discount_amount)
      totalAmount = Math.max(0, totalAmount - discount)
    }

    // Create order
    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, discount, shipping_address, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, totalAmount, discount, shippingAddress, 'pending']
    )

    const order = orderResult.rows[0]

    // Insert order items and decrement stock
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, unit_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [order.id, item.productId, item.product.name, item.product.price, item.quantity, item.product.price]
      )

      const stockUpdate = await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2 AND stock >= $1`,
        [item.quantity, item.productId]
      )

      if (stockUpdate.rowCount === 0) {
        throw new Error(`Insufficient stock for ${item.product.name}`)
      }
    }

    await client.query('COMMIT')

    res.status(201).json({
      message: 'Order placed successfully',
      order,
      discount,
      couponId,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('checkout error:', err.message)
    res.status(400).json({ error: err.message })
  } finally {
    client.release()
  }
}

module.exports = { checkout }