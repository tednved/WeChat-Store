const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const STORE_ID = process.env.DEFAULT_STORE_ID || 'default-store'

function orderNo() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

function address(input = {}) {
  const name = String(input.name || '').trim()
  const phone = String(input.phone || '').trim()
  const detail = String(input.detail || '').trim()
  if (!name || !/^1\d{10}$/.test(phone) || detail.length < 4) throw new Error('请填写正确的收货姓名、电话和详细地址')
  return { name, phone, detail }
}

async function quote(items, source = db) {
  let totalFee = 0
  const result = []
  for (const raw of items) {
    const id = String(raw.id || '')
    const count = Math.floor(Number(raw.count))
    if (!id || count < 1 || count > 999) throw new Error('商品数量异常')
    const product = (await source.collection('products').doc(id).get()).data
    if (!product || product.status !== 'on_sale' || product.isDeleted === true) throw new Error('商品不存在或已下架')
    if (Number(product.stock) < count) throw new Error(`${product.name}库存不足`)
    const priceFee = Number(product.priceFee)
    if (!Number.isSafeInteger(priceFee) || priceFee <= 0) throw new Error('商品价格异常')
    totalFee += priceFee * count
    const image = String(product.image || '')
    result.push({ id, name: product.name, image: /^(cloud:\/\/|https:\/\/)/.test(image) ? image : '', priceFee, price: priceFee / 100, count })
  }
  if (!Number.isSafeInteger(totalFee) || totalFee <= 0) throw new Error('订单金额异常')
  return { items: result, totalFee }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const items = (Array.isArray(event.items) ? event.items : []).filter((item) => item && Number(item.count) > 0)
  if (!OPENID) return { success: false, message: '请先登录' }
  if (!items.length) return { success: false, message: '购物车为空' }
  try {
    const store = (await db.collection('stores').doc(STORE_ID).get()).data
    if (!store || store.isActive === false) throw new Error('默认店铺不存在或未营业')
    if (event.preview) {
      const current = await quote(items)
      return { success: true, store: { _id: STORE_ID, name: store.name || '默认店铺' }, items: current.items, goodsTotal: current.totalFee / 100, deliveryFee: 0, totalFee: current.totalFee, totalPrice: current.totalFee / 100, totalPriceStr: (current.totalFee / 100).toFixed(2) }
    }
    const contact = address(event.address)
    const id = 'o_' + crypto.randomBytes(12).toString('hex')
    const no = orderNo()
    let saved
    await db.runTransaction(async (transaction) => {
      const current = await quote(items, transaction)
      for (const item of current.items) {
        const product = (await transaction.collection('products').doc(item.id).get()).data
        if (Number(product.stock) < item.count) throw new Error(`${product.name}库存不足`)
        await transaction.collection('products').doc(item.id).update({ data: { stock: db.command.inc(-item.count), reservedStock: db.command.inc(item.count), updateTime: db.serverDate() } })
      }
      saved = {
        _openid: OPENID, storeId: STORE_ID, storeName: String(store.name || '默认店铺'), storePhone: String(store.phone || ''), orderNo: no,
        items: current.items, contactName: contact.name, contactPhone: contact.phone, addressDetail: contact.detail,
        remark: String(event.remark || '').trim().slice(0, 200), goodsTotalFee: current.totalFee, goodsTotal: current.totalFee / 100,
        totalFee: current.totalFee, totalPrice: current.totalFee / 100, totalPriceStr: (current.totalFee / 100).toFixed(2),
        status: 'pending', paymentStatus: 'unpaid', paymentLocked: false, merchantStatus: 'waiting_accept', fulfillmentStatus: 'waiting_accept',
        stockState: 'reserved', createTime: db.serverDate(), expireAt: new Date(Date.now() + 15 * 60 * 1000), transactionId: '', prepayId: ''
      }
      await transaction.collection('orders').doc(id).set({ data: saved })
    })
    return { success: true, orderId: id, orderNo: no, totalFee: saved.totalFee, storeName: saved.storeName, description: saved.storeName, totalPrice: saved.totalPrice }
  } catch (err) {
    console.error('createOrder失败', err)
    return { success: false, message: err.message || '创建订单失败' }
  }
}
