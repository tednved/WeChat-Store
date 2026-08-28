const { requestRefund, reconcileRefund } = require('../../../utils/pay')
const STATUS_TEXT = { all: '全部', waiting_accept: '待接单', accepted: '已接单', preparing: '制作中', delivering: '配送中', completed: '已完成', refunding: '退款中', refunded: '已退款', cancelled: '已取消' }

Page({
  data: { orders: [], currentTab: 'all', loading: true, busyId: '', refreshing: false },
  active: false,
  onShow() { this.active = true; this.fetchOrders(true) },
  onHide() { this.active = false; this.stopRefundPolling() },
  onUnload() { this.active = false; this.stopRefundPolling() },
  onPullDownRefresh() { this.fetchOrders(true).finally(() => wx.stopPullDownRefresh()) },
  onScrollRefresh() { this.setData({ refreshing: true }); this.fetchOrders(true).finally(() => this.setData({ refreshing: false })) },

  fetchOrders(reconcile = false, silent = false) {
    if (!silent) this.setData({ loading: true })
    return wx.cloud.callFunction({ name: 'merchantOrders', data: { action: 'list', status: this.data.currentTab === 'all' ? '' : this.data.currentTab } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '订单加载失败')
      const orders = result.orders || []
      this.setData({ orders, loading: false })
      this.scheduleRefundPolling()
      if (reconcile) {
        const now = Date.now()
        const pending = orders.filter((order) => ['requesting', 'processing'].includes(order.refundStatus) && order.refundNo && (!order.nextRefundQueryAt || new Date(order.nextRefundQueryAt).getTime() <= now))
        if (pending.length) return Promise.all(pending.map((order) => reconcileRefund(order).catch((err) => console.error('退款查单补偿失败', order.refundNo, err))))
          .then(() => this.fetchOrders(false, true))
      }
    }).catch((err) => {
      console.error('商户订单加载失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '订单加载失败', icon: 'none' })
    })
  },

  stopRefundPolling() { if (this.refundTimer) { clearTimeout(this.refundTimer); this.refundTimer = null } },
  scheduleRefundPolling() {
    this.stopRefundPolling()
    if (this.active) this.refundTimer = setTimeout(() => this.fetchOrders(true, true), 10000)
  },

  selectTab(e) { const currentTab = e.currentTarget.dataset.tab; this.setData({ currentTab }, () => this.fetchOrders(true)) },
  goOrderDetail(e) { const orderId = e.currentTarget.dataset.id; if (orderId) wx.navigateTo({ url: '/pages/merchant/order-detail/order-detail?orderId=' + encodeURIComponent(orderId) }) },
  formatStatus(status) { return STATUS_TEXT[status] || status || '未知状态' },
  nextAction(status) {
    if (status === 'waiting_accept') return { text: '接单', next: 'accepted' }
    if (status === 'accepted') return { text: '开始制作', next: 'preparing' }
    if (status === 'preparing') return { text: '开始配送', next: 'delivering' }
    if (status === 'delivering') return { text: '完成订单', next: 'completed' }
    return null
  },

  callCustomer(e) {
    const order = this.data.orders.find((item) => item._id === e.currentTarget.dataset.id)
    if (!order || !order.contactPhone) {
      wx.showToast({ title: '订单未填写联系电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: order.contactPhone })
  },
  updateStatus(e) {
    const orderId = e.currentTarget.dataset.id
    const nextStatus = e.currentTarget.dataset.next
    const action = this.nextAction(e.currentTarget.dataset.status)
    if (!orderId || !nextStatus || !action || this.data.busyId) return
    wx.showModal({ title: action.text, content: '确定将订单修改为“' + this.formatStatus(nextStatus) + '”吗？', success: (modal) => {
      if (!modal.confirm) return
      this.setData({ busyId: orderId })
      wx.cloud.callFunction({ name: 'merchantOrders', data: { action: 'updateStatus', orderId, nextStatus } }).then((res) => {
        const result = res.result || {}
        if (!result.success) throw new Error(result.message || '状态更新失败')
        wx.showToast({ title: action.text + '成功', icon: 'success' })
        return this.fetchOrders()
      }).catch((err) => wx.showToast({ title: err.message || '状态更新失败', icon: 'none' })).finally(() => this.setData({ busyId: '' }))
    } })
  },

  rejectOrder(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId || this.data.busyId) return
    wx.showModal({ title: '拒单并退款', content: '确认拒绝该订单并将全部实付款原路退还给用户吗？退款结果以微信处理为准。', confirmColor: '#d93026', success: (modal) => {
      if (!modal.confirm) return
      this.setData({ busyId: orderId })
      wx.cloud.callFunction({ name: 'merchantOrders', data: { action: 'rejectAndRefund', orderId, reason: '商家拒单' } }).then((res) => {
        const result = res.result || {}
        if (!result.success) throw new Error(result.message || '拒单失败')
        if (result.refundRequest) return requestRefund(result.refundRequest)
      }).then(() => {
        wx.showToast({ title: '退款处理中', icon: 'none' })
        return this.fetchOrders()
      }).catch((err) => wx.showToast({ title: err.message || '拒单失败', icon: 'none' })).finally(() => this.setData({ busyId: '' }))
    } })
  }
})
