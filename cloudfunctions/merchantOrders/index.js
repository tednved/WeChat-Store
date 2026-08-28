const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const STATUS_TEXT = { waiting_accept: '待接单', accepted: '已接单', preparing: '制作中', delivering: '配送中', completed: '已完成', refunding: '退款中', refunded: '已退款', rejected: '已退款', cancelled: '已取消' }
// 已支付订单在退款闭环上线前禁止拒单，避免业务取消但资金未退。
const STATUS_FLOW = { waiting_accept: ['accepted'], accepted: ['preparing', 'delivering'], preparing: ['delivering'], delivering: ['completed'] }
async function getMerchant() { const { OPENID } = cloud.getWXContext(); if (!OPENID) return null; const res = await db.collection('users').where({ openid: OPENID }).limit(1).get(); const user = res.data && res.data[0]; if (!user || !['merchant','admin'].includes(user.role) || user.isActive === false) return null; return { ...user, openid: OPENID } }
function getMerchantStatus(order) { if (order.fulfillmentStatus) return order.fulfillmentStatus; if (order.merchantStatus) return order.merchantStatus; if (order.status === 'paid') return 'waiting_accept'; if (order.status === 'completed') return 'completed'; if (order.status === 'cancelled') return 'cancelled'; return 'waiting_accept' }
function isPaid(order) { return order.paymentStatus === 'paid' || order.paymentLocked === true || order.status === 'paid' || order.status === 'completed' }
function formatTime(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const pad = (n) => n < 10 ? '0' + n : String(n); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}` }
function displayStatus(order) { if (order.refundStatus === 'requesting' || order.refundStatus === 'processing') return 'refunding'; if (order.refundStatus === 'refunded') return 'refunded'; return getMerchantStatus(order) }
function safeImage(value) { const image = String(value || ''); return /^(cloud:\/\/|https:\/\/)/.test(image) ? image : '' }
function formatOrder(order) { const merchantStatus = getMerchantStatus(order); const display = displayStatus(order); return { ...order, items: (order.items || []).map((item) => ({ ...item, image: safeImage(item.image) })), merchantStatus, displayStatus: display, merchantStatusText: STATUS_TEXT[display] || display, timeStr: formatTime(order.createTime) } }

exports.main = async (event = {}) => {
  try {
    const merchant = await getMerchant()
    if (!merchant) return { success: false, message: '没有商户权限' }
    const action = event.action || 'list'
    if (action === 'list') {
      const res = await db.collection('orders').orderBy('createTime', 'desc').limit(100).get()
      const merchantOrders = (res.data || []).filter(isPaid)
      const orders = merchantOrders.map(formatOrder).filter((order) => !event.status || order.displayStatus === event.status)
      return { success: true, orders }
    }
    if (action === 'get') {
      const orderId = String(event.orderId || '')
      if (!orderId) return { success: false, message: '缺少订单参数' }
      let order = (await db.collection('orders').doc(orderId).get()).data
      if (!order) return { success: false, message: '订单不存在' }
      if (!isPaid(order)) return { success: false, message: '订单尚未支付' }
      return { success: true, order: formatOrder(order) }
    }
    if (action === 'updateStatus') {
      const orderId = event.orderId
      const nextStatus = event.nextStatus
      if (!orderId || !STATUS_TEXT[nextStatus]) return { success: false, message: '订单参数不完整' }
      const order = (await db.collection('orders').doc(orderId).get()).data
      if (!order) return { success: false, message: '订单不存在' }
      if (!isPaid(order)) return { success: false, message: '订单尚未支付，不能接单' }
      const { OPENID } = cloud.getWXContext()
      await db.runTransaction(async (transaction) => {
        const latest = (await transaction.collection('orders').doc(orderId).get()).data
        if (!latest) throw new Error('订单不存在')
        if (!isPaid(latest)) throw new Error('订单尚未支付，不能接单')
        if (['requesting', 'processing', 'refunded'].includes(latest.refundStatus)) throw new Error('订单正在退款或已退款，不能继续处理')
        const currentStatus = getMerchantStatus(latest)
        if (!(STATUS_FLOW[currentStatus] || []).includes(nextStatus)) throw new Error(`${STATUS_TEXT[currentStatus]}不能变更为${STATUS_TEXT[nextStatus]}`)
        const data = { merchantStatus: nextStatus, fulfillmentStatus: nextStatus, merchantStatusTime: db.serverDate(), statusHistory: db.command.push({ status: nextStatus, time: db.serverDate(), operator: OPENID }), updateTime: db.serverDate() }
        if (nextStatus === 'completed') data.status = 'completed'
        await transaction.collection('orders').doc(orderId).update({ data })
      })
      return { success: true, merchantStatus: nextStatus }
    }
    return { success: false, message: '不支持的操作' }
  } catch (err) { console.error('merchantOrders 执行失败', err); return { success: false, message: err.message || '订单操作失败' } }
}
