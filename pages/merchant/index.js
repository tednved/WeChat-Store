Page({
  data: { loading: true, goodsCount: 0, onSaleCount: 0, waitingCount: 0, deliveringCount: 0, todayAmount: '0.00', notifyBusy: false },

  onShow() { this.loadSummary() },

  loadSummary() {
    this.setData({ loading: true })
    Promise.all([
      wx.cloud.callFunction({ name: 'merchantGoods', data: { action: 'list' } }),
      wx.cloud.callFunction({ name: 'merchantOrders', data: { action: 'list' } })
    ]).then(([goodsRes, ordersRes]) => {
      const goodsResult = goodsRes.result || {}
      const ordersResult = ordersRes.result || {}
      if (!goodsResult.success || !ordersResult.success) throw new Error(goodsResult.message || ordersResult.message || '加载失败')
      const goods = goodsResult.goods || []
      const orders = ordersResult.orders || []
      const today = new Date()
      const todayAmount = orders.filter((order) => {
        const date = new Date(order.createTime)
        return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate() && order.status !== 'cancelled' && order.merchantStatus !== 'rejected'
      }).reduce((sum, order) => sum + Number(order.totalPrice || 0), 0)
      this.setData({ loading: false, goodsCount: goods.length, onSaleCount: goods.filter((item) => item.status !== 'off_sale').length, waitingCount: orders.filter((item) => item.merchantStatus === 'waiting_accept').length, deliveringCount: orders.filter((item) => item.merchantStatus === 'delivering').length, todayAmount: todayAmount.toFixed(2) })
    }).catch((err) => {
      console.error('商户首页加载失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  goGoods() { wx.navigateTo({ url: '/pages/merchant/goods/goods' }) },
  goOrders() { wx.navigateTo({ url: '/pages/merchant/orders/orders' }) },

  enableOrderNotify() {
    if (this.data.notifyBusy) return
    this.setData({ notifyBusy: true })
    wx.cloud.callFunction({ name: 'merchantNotify', data: { action: 'config' } }).then((res) => {
      const result = res.result || {}
      if (!result.success || !result.templateId) throw new Error(result.message || '请先配置订单通知模板ID')
      return new Promise((resolve, reject) => wx.requestSubscribeMessage({ tmplIds: [result.templateId], success: resolve, fail: reject }))
    }).then((subscribeResult) => {
      const accepted = Object.keys(subscribeResult || {}).some((key) => subscribeResult[key] === 'accept')
      if (!accepted) throw new Error('未允许订单通知')
      return wx.cloud.callFunction({ name: 'merchantNotify', data: { action: 'setEnabled', enabled: true } })
    }).then(() => wx.showToast({ title: '订单提醒已开启', icon: 'success' })).catch((err) => wx.showToast({ title: err.message || '开启提醒失败', icon: 'none' })).finally(() => this.setData({ notifyBusy: false }))
  }
})
