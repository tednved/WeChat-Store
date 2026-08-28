// 管理员用户管理：只能由 role=admin 的账号调用。
// 用户必须先登录过小程序，管理员才能在这里选择其角色。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const usersCollection = db.collection('users')
const VALID_ROLES = ['user', 'merchant', 'admin']
const DEFAULT_STORE_ID = process.env.DEFAULT_STORE_ID || 'default-store'

async function getCurrentAdmin() {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return null

  const result = await usersCollection.where({ openid: OPENID }).limit(1).get()
  const user = result.data && result.data[0]
  if (!user || user.role !== 'admin' || user.isActive === false) return null
  return { ...user, openid: OPENID }
}

function normalizeUser(user) {
  const avatarUrl = /^(cloud:\/\/|https:\/\/)/.test(String(user.avatarUrl || '')) ? String(user.avatarUrl) : ''
  return {
    _id: user._id,
    openid: user.openid || '',
    nickname: user.nickname || '未设置昵称',
    avatarUrl,
    role: user.role || 'user',
    merchantId: user.merchantId || '',
    storeIds: Array.isArray(user.storeIds) ? user.storeIds : [],
    notifyStoreIds: Array.isArray(user.notifyStoreIds) ? user.notifyStoreIds : [],
    phone: user.phone || '',
    notifyEnabled: user.notifyEnabled !== false,
    isActive: user.isActive !== false,
    createTime: user.createTime || null,
    updateTime: user.updateTime || null
  }
}

exports.main = async (event = {}) => {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) return { success: false, message: '没有管理员权限' }

    const action = event.action || 'list'

    if (action === 'list') {
      const result = await usersCollection.limit(100).get()
      return { success: true, users: (result.data || []).map(normalizeUser), currentAdminId: admin._id }
    }

    if (action === 'get') {
      const userId = String(event.userId || '')
      if (!userId) return { success: false, message: '缺少用户 ID' }
      const result = await usersCollection.doc(userId).get()
      if (!result.data) return { success: false, message: '用户不存在' }
      return { success: true, user: normalizeUser(result.data), currentAdminId: admin._id }
    }

    if (action === 'updateUser') {
      const userId = String(event.userId || '')
      const role = String(event.role || 'user')
      if (!userId || !VALID_ROLES.includes(role)) return { success: false, message: '用户参数不正确' }

      const targetResult = await usersCollection.doc(userId).get()
      const target = targetResult.data
      if (!target) return { success: false, message: '用户不存在' }
      // 不允许管理员把自己降级或停用，避免把系统锁死。
      if (target._id === admin._id && (role !== 'admin' || event.isActive === false)) {
        return { success: false, message: '不能修改当前管理员自己的权限或启用状态' }
      }

      const updateData = {
        role,
        storeIds: role === 'merchant' || role === 'admin' ? (DEFAULT_STORE_ID ? [DEFAULT_STORE_ID] : []) : [],
        notifyStoreIds: role === 'merchant' || role === 'admin' ? (DEFAULT_STORE_ID ? [DEFAULT_STORE_ID] : []) : [],
        phone: role === 'merchant' || role === 'admin' ? String(event.phone || '').trim() : '',
        notifyEnabled: event.notifyEnabled !== false,
        isActive: event.isActive !== false,
        updateTime: db.serverDate()
      }

      await usersCollection.doc(userId).update({ data: updateData })
      return { success: true, user: { ...normalizeUser(target), ...updateData, _id: userId } }
    }

    if (action === 'toggleNotify') {
      const userId = String(event.userId || '')
      if (!userId) return { success: false, message: '缺少用户 ID' }
      const targetResult = await usersCollection.doc(userId).get()
      const target = targetResult.data
      if (!target) return { success: false, message: '用户不存在' }

      await usersCollection.doc(userId).update({
        data: {
          notifyEnabled: event.enabled !== false,
          updateTime: db.serverDate()
        }
      })
      return { success: true, notifyEnabled: event.enabled !== false }
    }

    if (action === 'toggleActive') {
      const userId = String(event.userId || '')
      if (!userId) return { success: false, message: '缺少用户 ID' }
      if (userId === admin._id && event.enabled === false) return { success: false, message: '不能停用当前管理员账号' }

      const targetResult = await usersCollection.doc(userId).get()
      if (!targetResult.data) return { success: false, message: '用户不存在' }
      await usersCollection.doc(userId).update({
        data: {
          isActive: event.enabled !== false,
          updateTime: db.serverDate()
        }
      })
      return { success: true, isActive: event.enabled !== false }
    }

    return { success: false, message: '不支持的操作' }
  } catch (err) {
    console.error('adminUsers 执行失败', err)
    return { success: false, message: err.message || '管理员操作失败' }
  }
}
