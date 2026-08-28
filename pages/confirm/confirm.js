const { requestOrderPayment } = require('../../utils/pay')

Page({
  data: {
    items: [],
    totalCount: 0,
    goodsTotalStr: '0.00',
    deliveryFeeStr: '0.00',
    totalPriceStr: '0.00',
    address: null,
    remark: '',
    submitting: false,
    quoteLoading: false,
    store: null
  },

  onLoad() {
    const data = wx.getStorageSync('confirmOrder') || {}
    const items = data.items || []
    this.setData({
      items,
      store: data.store || null,
      totalCount: items.reduce((sum, item) => sum + Number(item.count || 0), 0),
      goodsTotalStr: Number(data.totalPrice || 0).toFixed(2),
      totalPriceStr: data.totalPriceStr || '0.00'
    })

    if (items.length === 0) {
      wx.showToast({ title: '订单内容为空', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    this.loadServerQuote(items)
  },

  onShow() {
    this.loadAddress()
  },

  loadAddress() {
    wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '地址加载失败')
      const legacy = wx.getStorageSync('defaultAddress')
      const address = (result.addresses || []).find((item) => item.isDefault) || (result.addresses || [])[0] || legacy || null
      this.setData({ address })
    }).catch((err) => {
      console.error('确认页地址加载失败', err)
      this.setData({ address: null })
    })
  },

  loadServerQuote(items) {
    const data = wx.getStorageSync('confirmOrder') || {}
    const loginInfo = wx.getStorageSync('loginInfo')
    if (!loginInfo || !loginInfo.openid) return
    this.setData({ quoteLoading: true })
    wx.cloud.callFunction({
      name: 'createOrder',
      data: { items, storeId: data.store && data.store._id, preview: true }
    }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '价格校验失败')
      this.setData({
        items: result.items || items,
        goodsTotalStr: Number(result.goodsTotal || 0).toFixed(2),
        deliveryFeeStr: Number(result.deliveryFee || 0).toFixed(2),
        totalPriceStr: Number(result.totalPrice || 0).toFixed(2),
        totalCount: (result.items || items).reduce((sum, item) => sum + Number(item.count || 0), 0)
      })
    }).catch((err) => {
      console.error('服务端价格校验失败', err)
      wx.showToast({ title: err.message || '价格校验失败', icon: 'none' })
    }).finally(() => this.setData({ quoteLoading: false }))
  },

  goAddress() {
    wx.navigateTo({ url: '/pages/address/address?select=1' })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  onSubmitTap() {
    if (this.data.submitting || this.data.items.length === 0) return
    const loginInfo = wx.getStorageSync('loginInfo')
    const openid = loginInfo && loginInfo.openid
    if (!openid) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再下单',
        confirmText: '去登录',
        success: (res) => { if (res.confirm) wx.switchTab({ url: '/pages/mine/mine' }) }
      })
      return
    }
    if (!this.data.address) {
      wx.showToast({ title: '请先填写收货地址', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '创建订单...' })
    wx.cloud.callFunction({
      name: 'createOrder',
      data: {
        items: this.data.items,
        storeId: this.data.store && this.data.store._id,
        address: this.data.address,
        remark: this.data.remark
      }
    }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '创建订单失败')
      return this.requestPayment(result).then(() => ({ order: result, paid: true })).catch((error) => ({ order: result, paid: false, error }))
    }).then((outcome) => {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.setStorageSync('orderSubmitted', true)
      if (outcome.paid) wx.setStorageSync('pendingPaymentOrderId', outcome.order.orderId)
      else wx.removeStorageSync('pendingPaymentOrderId')
      wx.removeStorageSync('confirmOrder')
      wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + encodeURIComponent(outcome.order.orderId), success: () => {
        wx.showToast({ title: outcome.paid ? '支付结果确认中' : '订单已创建，可稍后支付', icon: 'none' })
      } })
    }).catch((err) => {
      console.error('下单失败', err)
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '下单失败，请重试', icon: 'none' })
    })
  },

  requestPayment(order) {
    wx.showLoading({ title: '拉起支付...' })
    return requestOrderPayment(order).then(() => ({ orderId: order.orderId })).catch((err) => {
      const msg = (err && err.errMsg) || err.message || ''
      throw new Error(msg.indexOf('cancel') >= 0 ? '已取消支付' : (err.message || '支付未完成'))
    })
  }
})
