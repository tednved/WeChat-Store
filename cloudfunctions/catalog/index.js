const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const STORE_ID = process.env.DEFAULT_STORE_ID || 'default-store'

async function ensureStoresCollection() {
  try { await db.collection('stores').limit(1).get() } catch (err) {
    if (typeof db.createCollection !== 'function') throw err
    try { await db.createCollection('stores') } catch (createErr) {
      const message = String(createErr?.message || createErr?.errMsg || '')
      if (!/already exist|已存在/i.test(message)) throw createErr
    }
  }
}

async function getDefaultStore() {
  await ensureStoresCollection()
  try {
    const store = (await db.collection('stores').doc(STORE_ID).get()).data
    if (store) return store
  } catch (err) {}
  const store = { name: '默认店铺', subtitle: '', phone: '', isActive: true, updateTime: db.serverDate() }
  await db.collection('stores').doc(STORE_ID).set({ data: store })
  return store
}

exports.main = async () => {
  try {
    const store = await getDefaultStore()
    if (store.isActive === false) return { success: false, message: '店铺暂未营业' }
    const result = await db.collection('products').where({ status: 'on_sale' }).limit(1000).get()
    const groups = {}
    for (const product of result.data || []) {
      if (product.isDeleted === true || Number(product.stock) <= 0) continue
      const categoryId = product.categoryId || 'default'
      if (!groups[categoryId]) groups[categoryId] = { id: categoryId, name: product.categoryName || '未分类', goods: [] }
      const rawImage = String(product.image || '')
      groups[categoryId].goods.push({
        ...product,
        id: product._id,
        desc: String(product.description || ''),
        image: /^(cloud:\/\/|https:\/\/)/.test(rawImage) ? rawImage : ''
      })
    }
    return {
      success: true,
      store: { _id: STORE_ID, name: store.name || '默认店铺', subtitle: store.subtitle || '', phone: store.phone || '' },
      categories: Object.values(groups)
    }
  } catch (err) {
    console.error('catalog 执行失败', err)
    return { success: false, message: err.message || '店铺加载失败' }
  }
}
