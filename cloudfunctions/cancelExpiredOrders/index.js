const cloud = require('wx-server-sdk')
const WxPay = require('wechatpay-node-v3')
const trade = require('./trade')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
function payClient() {
  const config = {
    appid: process.env.appId || '', mchid: process.env.merchantId || '',
    serial_no: process.env.merchantSerialNumber || '', key: process.env.apiV3Key || '',
    privateKey: (process.env.privateKey || '').replace(/\\n/g, '\n'),
    publicKey: (process.env.wxPayPublicKey || '').replace(/\\n/g, '\n')
  }
  if (Object.values(config).some((value) => !value)) throw new Error('cancelExpiredOrders 支付环境变量未完整配置')
  return new WxPay(config)
}

function expectedFee(order) {
  return Number.isSafeInteger(Number(order.totalFee)) ? Number(order.totalFee) : Math.round(Number(order.totalPrice) * 100)
}

async function notifyMerchant(order) {
  const templateId = process.env.ORDER_NOTIFY_TEMPLATE_ID || '_qXUQmKilpOf8YLJOfx1gdX7aY3Bxf2V9uYxXqT2AXk'
  if (!templateId || !order.storeId) return
  const items = order.items || []
  const result = await db.collection('users').where({ notifyStoreIds: order.storeId, notifyEnabled: true }).limit(20).get()
  await Promise.all((result.data || []).filter((user) => ['merchant', 'admin'].includes(user.role) && user.isActive !== false && user.openid).map((user) => cloud.openapi.subscribeMessage.send({
    touser: user.openid,
    templateId,
    page: 'pages/merchant/order-detail/order-detail?orderId=' + order._id,
    miniprogramState: 'formal',
    lang: 'zh_CN',
    data: {
      character_string1: { value: String(order.orderNo).slice(-32) },
      thing2: { value: items.map((item) => item.name).join('、').slice(0, 20) || '新订单' },
      number3: { value: String(items.reduce((sum, item) => sum + Number(item.count || 0), 0)) },
      amount8: { value: Number(order.totalPrice || 0).toFixed(2) + '元' },
      thing5: { value: '请在订单详情查看' }
    }
  })))
}

async function markPaid(order, data) {
  const fee = Number(data.amount?.total)
  if (fee !== expectedFee(order) || String(data.payer?.openid || '') !== String(order._openid || '') || !data.transaction_id) throw new Error('支付结果不匹配')
  let newlyPaid = false
  await db.runTransaction(async (transaction) => {
    const latest = (await transaction.collection('orders').doc(order._id).get()).data
    if (!latest) throw new Error('订单不存在')
    if (latest.paymentStatus === 'paid' || latest.paymentLocked === true || latest.status === 'paid' || latest.status === 'completed') {
      if (String(latest.transactionId || '') !== String(data.transaction_id) || Number(latest.payFee) !== fee) throw new Error('支付结果不匹配')
      return
    }
    if (latest.status !== 'pending' || latest.stockState !== 'reserved') throw new Error('订单状态异常')
    await transaction.collection('orders').doc(order._id).update({ data: {
      status: 'paid', paymentStatus: 'paid', paymentLocked: true,
      merchantStatus: latest.merchantStatus || 'waiting_accept', fulfillmentStatus: latest.fulfillmentStatus || latest.merchantStatus || 'waiting_accept',
      paymentChannel: latest.paymentChannel || 'wechatpay-v3', paymentProvider: latest.paymentProvider || 'cloudbase-integration',
      transactionId: String(data.transaction_id), payFee: fee, payTime: db.serverDate(), updateTime: db.serverDate()
    } })
    await trade.confirm(transaction, db, { ...latest, _id: order._id })
    newlyPaid = true
  })
  if (newlyPaid) await notifyMerchant({ ...order, _id: order._id }).catch((err) => console.error('商户通知失败', err))
  return newlyPaid
}

async function queryPayment(client, order) {
  const result = await client.query({ out_trade_no: order.orderNo })
  if (result.status === 404 && result.data?.code === 'ORDER_NOT_EXIST') return 'not_exist'
  if (result.status !== 200 || !result.data) return 'unknown'
  if (result.data.trade_state === 'SUCCESS') { await markPaid(order, result.data); return 'paid' }
  return ['NOTPAY', 'CLOSED', 'REVOKED', 'PAYERROR'].includes(result.data.trade_state) ? 'unpaid' : 'unknown'
}

async function cancelLocal(order) {
  const changed = await db.runTransaction(async (transaction) => {
    const latest = (await transaction.collection('orders').doc(order._id).get()).data
    if (!latest || latest.status !== 'pending' || latest.stockState !== 'reserved') return false
    await transaction.collection('orders').doc(order._id).update({ data: { status: 'cancelled', cancelTime: db.serverDate(), updateTime: db.serverDate() } })
    await trade.release(transaction, db, { ...latest, _id: order._id })
    return true
  })
  return changed ? 'cancelled' : 'unchanged'
}

async function cancelOrder(client, order) {
  const state = await queryPayment(client, order)
  if (state !== 'unpaid' && state !== 'not_exist') return state
  if (state === 'unpaid') {
    const result = await client.close(order.orderNo)
    if (result.status !== 204 && result.status !== 200) return 'unknown'
  }
  return cancelLocal(order)
}

async function claimCleanup(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get()
  const user = result.data && result.data[0]
  if (!user) return false
  return db.runTransaction(async (transaction) => {
    const latest = (await transaction.collection('users').doc(user._id).get()).data
    if (!latest) return false
    const last = latest.lastExpiredCleanupAt ? new Date(latest.lastExpiredCleanupAt).getTime() : 0
    if (Date.now() - last < 60000) return false
    await transaction.collection('users').doc(user._id).update({ data: { lastExpiredCleanupAt: db.serverDate() } })
    return true
  })
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (event.orderId) return { success: false, message: '请通过支付服务取消未支付订单' }
    if (event.action && event.action !== 'cleanup') return { success: false, message: '不支持的操作' }
    const client = payClient()
    const now = Date.now()
    if (OPENID && !await claimCleanup(OPENID)) return { success: true, throttled: true, cancelled: 0, paid: 0 }
    const result = await db.collection('orders')
      .where({ status: 'pending', expireAt: db.command.lte(new Date(now)) })
      .orderBy('expireAt', 'asc')
      .limit(20)
      .get()
    const expired = result.data || []
    let cancelled = 0
    let paid = 0
    for (const order of expired) {
      try {
        const state = await cancelOrder(client, order)
        if (state === 'cancelled') cancelled++
        else if (state === 'paid') paid++
      } catch (err) { console.error('过期订单清理失败', order.orderNo, err) }
    }
    return { success: true, cancelled, paid }
  } catch (err) {
    console.error('过期订单清理失败', err)
    return { success: false, message: err.message || '过期订单清理失败' }
  }
}
