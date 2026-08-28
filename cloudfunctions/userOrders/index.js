const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function safeOrder(order, defaultStorePhone = '') {
  return { ...order, merchantPhone: order.merchantPhone || order.storePhone || defaultStorePhone || '', items: (order.items || []).map((item) => {
    const image = String(item.image || '')
    return { ...item, image: /^(cloud:\/\/|https:\/\/)/.test(image) ? image : '' }
  }) }
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return { success: false, message: '获取用户身份失败' }
    const store = await db.collection('stores').doc('default-store').get().catch(() => ({ data: null }))
    const defaultStorePhone = String(store.data?.phone || '')
    if (event.action === 'get') {
      const order = (await db.collection('orders').doc(String(event.orderId || '')).get()).data
      if (!order || order._openid !== OPENID) return { success: false, message: '订单不存在或无权查看' }
      return { success: true, order: safeOrder(order, defaultStorePhone) }
    }
    const pageSize = Math.min(20, Math.max(5, Math.floor(Number(event.pageSize) || 10)))
    let query = db.collection('orders').where({ _openid: OPENID })
    const cursor = Number(event.cursor)
    if (Number.isFinite(cursor) && cursor > 0) query = query.where({ createTime: db.command.lt(new Date(cursor)) })
    const result = await query.orderBy('createTime', 'desc').limit(pageSize + 1).get()
    const rows = result.data || []
    const hasMore = rows.length > pageSize
    const orders = rows.slice(0, pageSize).map((order) => safeOrder(order, defaultStorePhone))
    const last = orders[orders.length - 1]
    const nextCursor = last && last.createTime ? new Date(last.createTime).getTime() : 0
    return { success: true, orders, hasMore, nextCursor }
  } catch (err) {
    console.error('userOrders 执行失败', err)
    return { success: false, message: err.message || '订单加载失败' }
  }
}
