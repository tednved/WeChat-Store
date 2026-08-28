// 云函数：login
// 用于小程序登录：识别微信用户身份（openid），并在 users 集合中创建或更新用户资料。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const USERS_COLLECTION = 'users'
const usersCollection = db.collection(USERS_COLLECTION)
const DEFAULT_STORE_ID = process.env.DEFAULT_STORE_ID || 'default-store'

function getErrorText(err) {
  return ((err && (err.errMsg || err.message)) || '').toLowerCase()
}

function isCollectionMissing(err) {
  const text = getErrorText(err)
  return text.includes('not exist') || text.includes('不存在')
}

function isCollectionExists(err) {
  const text = getErrorText(err)
  return text.includes('already exist') || text.includes('已存在')
}

function safeAvatar(value) {
  const avatar = String(value || '')
  return /^(cloud:\/\/|https:\/\/)/.test(avatar) ? avatar : ''
}

async function ensureUsersCollection() {
  try {
    await usersCollection.limit(1).get()
    return
  } catch (err) {
    if (!isCollectionMissing(err)) throw err
    if (typeof db.createCollection !== 'function') throw new Error('USERS_COLLECTION_NOT_EXIST')
    try {
      await db.createCollection(USERS_COLLECTION)
    } catch (createErr) {
      if (!isCollectionExists(createErr)) throw createErr
    }
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { success: false, message: '获取用户身份失败' }
  const incoming = event.userInfo || {}

  try {
    await ensureUsersCollection()
    const existing = await usersCollection.where({ openid: OPENID }).get()
    let userInfo

    if (existing.data.length > 0) {
      userInfo = existing.data[0]
      if (!userInfo.role) userInfo.role = 'user'
      if (!userInfo.merchantId) userInfo.merchantId = ''
      if (!Array.isArray(userInfo.storeIds)) userInfo.storeIds = []
      if (!Array.isArray(userInfo.notifyStoreIds)) userInfo.notifyStoreIds = []
      if (typeof userInfo.notifyEnabled !== 'boolean') userInfo.notifyEnabled = true
      if (typeof userInfo.isActive !== 'boolean') userInfo.isActive = true
      const updateData = {}
      if ((userInfo.role === 'merchant' || userInfo.role === 'admin') && DEFAULT_STORE_ID && (!(userInfo.storeIds || []).includes(DEFAULT_STORE_ID) || !(userInfo.notifyStoreIds || []).includes(DEFAULT_STORE_ID))) {
        updateData.storeIds = [DEFAULT_STORE_ID]
        updateData.notifyStoreIds = [DEFAULT_STORE_ID]
      }
      if (typeof incoming.avatarUrl === 'string' && incoming.avatarUrl) updateData.avatarUrl = safeAvatar(incoming.avatarUrl)
      if (typeof incoming.nickname === 'string' && incoming.nickname) updateData.nickname = incoming.nickname
      if (Object.keys(updateData).length > 0) {
        updateData.updateTime = db.serverDate()
        await usersCollection.doc(userInfo._id).update({ data: updateData })
        userInfo = Object.assign({}, userInfo, updateData)
      }
    } else {
      const record = {
        openid: OPENID,
        avatarUrl: safeAvatar(incoming.avatarUrl),
        nickname: incoming.nickname ? String(incoming.nickname) : '',
        role: 'user',
        merchantId: '',
        storeIds: [],
        notifyStoreIds: [],
        notifyEnabled: true,
        isActive: true,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
      const addRes = await usersCollection.add({ data: record })
      userInfo = Object.assign({ _id: addRes._id }, record)
    }

    return {
      success: true,
      openid: OPENID,
      userInfo: {
        avatarUrl: safeAvatar(userInfo.avatarUrl),
        nickname: userInfo.nickname || '',
        role: userInfo.role || 'user',
        merchantId: userInfo.merchantId || '',
        storeIds: Array.isArray(userInfo.storeIds) ? userInfo.storeIds : [],
        notifyStoreIds: Array.isArray(userInfo.notifyStoreIds) ? userInfo.notifyStoreIds : [],
        notifyEnabled: userInfo.notifyEnabled !== false,
        isActive: userInfo.isActive !== false
      }
    }
  } catch (err) {
    console.error('login 云函数执行失败', err)
    if (err && err.message === 'USERS_COLLECTION_NOT_EXIST') return { success: false, message: '数据库缺少 users 集合，请在云开发控制台创建后重试' }
    return { success: false, message: '服务繁忙，请稍后重试' }
  }
}
