const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const STORE_ID = process.env.DEFAULT_STORE_ID || 'default-store'

function safeImage(value) {
  const image = String(value || '')
  return /^(cloud:\/\/|https:\/\/)/.test(image) ? image : ''
}

function createCategoryId(name) {
  return 'c_' + crypto.createHash('sha1').update(name).digest('hex').slice(0, 12)
}

async function currentMerchant() {
  const { OPENID } = cloud.getWXContext()
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get()
  const user = result.data && result.data[0]
  if (!user || !['merchant', 'admin'].includes(user.role) || user.isActive === false) return null
  return user
}

function normalize(input) {
  const name = String(input.name || '').trim()
  const categoryName = String(input.categoryName || '').trim() || '未分类'
  const priceFee = Math.round(Number(input.price) * 100)
  const stock = Math.floor(Number(input.stock))
  if (!name || !Number.isSafeInteger(priceFee) || priceFee <= 0 || !Number.isSafeInteger(stock) || stock < 0) throw new Error('商品名称、价格或库存不正确')
  return {
    name, priceFee, price: priceFee / 100, stock, image: safeImage(input.image),
    description: String(input.description || ''), status: input.status === 'off_sale' ? 'off_sale' : 'on_sale',
    categoryId: String(input.categoryId || createCategoryId(categoryName)), categoryName
  }
}

exports.main = async (event = {}) => {
  try {
    if (!await currentMerchant()) return { success: false, message: '没有商户权限' }
    const products = db.collection('products')
    const action = event.action || 'list'
    if (action === 'list') {
      const result = await products.limit(1000).get()
      const goods = (result.data || []).filter((item) => item.isDeleted !== true).map((item) => ({ ...item, id: item._id, image: safeImage(item.image) }))
      const categories = Array.from(new Map(goods.map((item) => [String(item.categoryId || createCategoryId(item.categoryName || '未分类')), {
        id: String(item.categoryId || createCategoryId(item.categoryName || '未分类')),
        name: String(item.categoryName || '未分类')
      }])).values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      return { success: true, goods, categories }
    }
    if (action === 'create') {
      const id = 'p_' + crypto.randomBytes(12).toString('hex')
      await products.doc(id).set({ data: { ...normalize(event.goods || event), storeId: STORE_ID, isDeleted: false, createTime: db.serverDate(), updateTime: db.serverDate() } })
      return { success: true, goodsId: id }
    }
    const id = String(event.goodsId || '')
    const old = (await products.doc(id).get()).data
    if (!old || old.isDeleted === true) return { success: false, message: '商品不存在或无权操作' }
    if (action === 'delete') {
      await products.doc(id).update({ data: { status: 'off_sale', isDeleted: true, deleteTime: db.serverDate(), updateTime: db.serverDate() } })
      return { success: true }
    }
    if (action === 'toggleStatus') {
      await products.doc(id).update({ data: { status: event.status === 'off_sale' ? 'off_sale' : 'on_sale', updateTime: db.serverDate() } })
      return { success: true }
    }
    if (action === 'update') {
      await products.doc(id).update({ data: { ...normalize(event.goods || event), updateTime: db.serverDate() } })
      return { success: true }
    }
    return { success: false, message: '不支持的操作' }
  } catch (err) {
    console.error('merchantGoods 执行失败', err)
    return { success: false, message: err.message || '商品操作失败' }
  }
}
