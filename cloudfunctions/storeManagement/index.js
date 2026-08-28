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

async function currentAdmin() {
  const { OPENID } = cloud.getWXContext()
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get()
  const user = result.data && result.data[0]
  return user && user.role === 'admin' && user.isActive !== false ? user : null
}

async function getStore() {
  try { return (await db.collection('stores').doc(STORE_ID).get()).data || null } catch (err) { return null }
}

exports.main = async (event = {}) => {
  try {
    if (!await currentAdmin()) return { success: false, message: '没有管理员权限' }
    await ensureStoresCollection()
    const action = event.action || 'get'
    if (action === 'get') {
      const store = await getStore()
      return { success: true, store: store ? { ...store, _id: STORE_ID } : { _id: STORE_ID, name: '默认店铺', phone: '', subtitle: '', isActive: true } }
    }
    if (action === 'save') {
      const name = String(event.name || '').trim()
      if (name.length < 2) return { success: false, message: '请填写店铺名称' }
      const old = await getStore()
      const data = {
        ...(old || {}),
        name,
        phone: String(event.phone || '').trim(),
        subtitle: String(event.subtitle || '').trim(),
        isActive: event.isActive !== false,
        updateTime: db.serverDate()
      }
      if (!old) data.createTime = db.serverDate()
      await db.collection('stores').doc(STORE_ID).set({ data })
      return { success: true, storeId: STORE_ID }
    }
    return { success: false, message: '不支持的操作' }
  } catch (err) {
    console.error('storeManagement 执行失败', err)
    return { success: false, message: err.message || '默认店铺操作失败' }
  }
}
