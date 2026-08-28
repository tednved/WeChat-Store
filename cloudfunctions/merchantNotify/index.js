const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const result = await db.collection('users').where({ openid: OPENID }).limit(1).get()
  const user = result.data && result.data[0]
  if (!user || !(user.role === 'merchant' || user.role === 'admin') || user.isActive === false) return { success: false, message: '没有商户权限' }
  if (event.action === 'config') return { success: true, templateId: process.env.ORDER_NOTIFY_TEMPLATE_ID || '' }
  if (event.action === 'setEnabled') {
    await db.collection('users').doc(user._id).update({ data: { notifyEnabled: event.enabled === true, notifyUpdateTime: db.serverDate() } })
    return { success: true, notifyEnabled: event.enabled === true }
  }
  return { success: false, message: '不支持的操作' }
}
