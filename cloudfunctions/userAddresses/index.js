const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const addressesCollection = db.collection('addresses')

function validateAddress(input) {
  const name = String(input.name || '').trim()
  const gender = input.gender === '女士' ? '女士' : '先生'
  const phone = String(input.phone || '').trim()
  const detail = String(input.detail || '').trim()
  if (!name) throw new Error('请输入收货人姓名')
  if (name.length > 10) throw new Error('收货人姓名不要超过10个字')
  if (phone.replace(/[\s\-+]/g, '').length < 5) throw new Error('请输入联系电话')
  if (!detail) throw new Error('请输入收货地址')
  return { name, gender, phone, detail }
}

function getOpenid() {
  return cloud.getWXContext().OPENID
}

async function getMine(openid) {
  try {
    const result = await addressesCollection.where({ _openid: openid }).limit(100).get()
    return result.data || []
  } catch (err) {
    const text = String((err && (err.errMsg || err.message)) || '').toLowerCase()
    if (text.includes('not exist') || text.includes('不存在')) return []
    throw err
  }
}

async function setOnlyDefault(openid, addressId) {
  const addresses = await getMine(openid)
  for (const address of addresses) {
    if (address._id !== addressId && address.isDefault) {
      await addressesCollection.doc(address._id).update({ data: { isDefault: false, updateTime: db.serverDate() } })
    }
  }
}

exports.main = async (event = {}) => {
  const openid = getOpenid()
  if (!openid) return { success: false, message: '获取用户身份失败，请先登录' }

  try {
    const action = event.action || 'list'
    if (action === 'list') {
      const addresses = await getMine(openid)
      addresses.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || String(b.updateTime || '').localeCompare(String(a.updateTime || '')))
      return { success: true, addresses }
    }

    if (action === 'save') {
      const address = validateAddress(event.address || event)
      const addressId = String(event.addressId || '')
      const mine = await getMine(openid)
      const shouldDefault = event.isDefault === true || mine.length === 0

      if (addressId) {
        const target = mine.find((item) => item._id === addressId)
        if (!target) return { success: false, message: '地址不存在或无权操作' }
        await addressesCollection.doc(addressId).update({
          data: {
            ...address,
            isDefault: shouldDefault ? true : target.isDefault === true,
            updateTime: db.serverDate()
          }
        })
        if (shouldDefault) await setOnlyDefault(openid, addressId)
        return { success: true, addressId }
      }

      const addResult = await addressesCollection.add({
        data: {
          _openid: openid,
          ...address,
          isDefault: shouldDefault,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      if (shouldDefault) await setOnlyDefault(openid, addResult._id)
      return { success: true, addressId: addResult._id }
    }

    if (action === 'setDefault') {
      const addressId = String(event.addressId || '')
      const mine = await getMine(openid)
      if (!mine.some((item) => item._id === addressId)) return { success: false, message: '地址不存在或无权操作' }
      await setOnlyDefault(openid, addressId)
      await addressesCollection.doc(addressId).update({ data: { isDefault: true, updateTime: db.serverDate() } })
      return { success: true }
    }

    if (action === 'delete') {
      const addressId = String(event.addressId || '')
      const mine = await getMine(openid)
      const target = mine.find((item) => item._id === addressId)
      if (!target) return { success: false, message: '地址不存在或无权操作' }
      await addressesCollection.doc(addressId).remove()
      if (target.isDefault && mine.length > 1) {
        const next = mine.find((item) => item._id !== addressId)
        await addressesCollection.doc(next._id).update({ data: { isDefault: true, updateTime: db.serverDate() } })
      }
      return { success: true }
    }

    return { success: false, message: '不支持的操作' }
  } catch (err) {
    console.error('userAddresses 执行失败', err)
    return { success: false, message: err.message || '地址操作失败' }
  }
}