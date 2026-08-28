async function release(transaction, db, order) {
  if (order.stockState !== 'reserved') return
  for (const item of order.items || []) await transaction.collection('products').doc(item.id).update({ data: {
    stock: db.command.inc(item.count), reservedStock: db.command.inc(-item.count), updateTime: db.serverDate()
  } })
  await transaction.collection('orders').doc(order._id).update({ data: { stockState: 'released' } })
}

async function confirm(transaction, db, order) {
  if (order.stockState !== 'reserved') return
  for (const item of order.items || []) await transaction.collection('products').doc(item.id).update({ data: {
    reservedStock: db.command.inc(-item.count), soldStock: db.command.inc(item.count), updateTime: db.serverDate()
  } })
  await transaction.collection('orders').doc(order._id).update({ data: { stockState: 'sold' } })
}

module.exports = { release, confirm }
