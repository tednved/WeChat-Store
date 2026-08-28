const { requestOrderPayment, syncOrder, closeOrder } = require('../../utils/pay')
const EXPIRE_MINUTES = 15
const PAGE_SIZE = 10
const MERCHANT_STATUS_TEXT = {
  waiting_accept: '已支付',
  accepted: '已支付',
  preparing: '已支付',
  delivering: '配送中',
  completed: '已完成',
  rejected: '已取消',
  cancelled: '已取消'
}

Page({
  data: {
    orders: [],
    loading: true,
    loggedIn: false,
    payingId: '',
    cancellingId: '',
    refreshing: false, loadingMore: false, hasMore: true, nextCursor: 0
  },

  timer: null,
  paymentTimer: null,
  statusTimer: null,
  active: false,

  onShow() {
    this.active = true
    this.fetchOrders(false, true)
    this.startCountdown()
    const pendingOrderId = wx.getStorageSync('pendingPaymentOrderId')
    if (pendingOrderId) this.confirmPaymentStatus(pendingOrderId)
  },

  onHide() { this.active = false; this.stopCountdown(); this.stopPaymentPolling(); this.stopStatusRefresh() },
  onUnload() { this.active = false; this.stopCountdown(); this.stopPaymentPolling(); this.stopStatusRefresh() },
  startCountdown() { this.stopCountdown(); this.timer = setInterval(() => this.tickCountdown(), 1000) },
  stopCountdown() { if (this.timer) { clearInterval(this.timer); this.timer = null } },

  fetchOrders(reconcile = false, reset = false, silent = false) {
    const loginInfo = wx.getStorageSync('loginInfo')
    const openid = loginInfo && loginInfo.openid
    if (!openid) {
      this.setData({ loading: false, loggedIn: false, orders: [] })
      return
    }

    if (!reset && (!this.data.hasMore || this.data.loadingMore)) return Promise.resolve()
    if (!silent) this.setData(reset ? { loading: true, loggedIn: true, hasMore: true, nextCursor: 0 } : { loadingMore: true, loggedIn: true })
    return wx.cloud.callFunction({ name: 'userOrders', data: { pageSize: PAGE_SIZE, cursor: reset ? 0 : this.data.nextCursor } }).then((res) => {
      const result = res.result || {}; if (!result.success) throw new Error(result.message || '订单加载失败')
      const page = (result.orders || []).map((order) => this.formatOrder(order)); const orders = reset ? page : this.data.orders.concat(page)
      this.setData({ orders: this.markExpired(orders), loading: false, loadingMore: false, hasMore: !!result.hasMore, nextCursor: result.nextCursor || 0 })
      this.scheduleStatusRefresh()
    }).catch((err) => {
      console.error('订单加载失败', err)
      this.setData({ loading: false, loadingMore: false })
    })
  },

  onPullRefresh() {
    this.setData({ refreshing: true })
    Promise.resolve(this.fetchOrders(false, true)).finally(() => this.setData({ refreshing: false }))
  },

  onReachBottom() { return this.fetchOrders(false, false) },

  stopStatusRefresh() { if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null } },
  scheduleStatusRefresh() {
    this.stopStatusRefresh()
    const hasActiveOrder = this.data.orders.some((order) => order.status === 'pending' || order.refundStatus === 'requesting' || order.refundStatus === 'processing')
    if (this.active && hasActiveOrder) this.statusTimer = setTimeout(() => this.fetchOrders(false, true, true), 5000)
  },

  formatOrder(order) {
    let remainSec = 0
    let remainText = ''
    if (order.status === 'pending' && order.createTime) {
      const expireAt = order.expireAt ? new Date(order.expireAt).getTime() : new Date(order.createTime).getTime() + EXPIRE_MINUTES * 60 * 1000
      remainSec = Math.max(0, Math.ceil((expireAt - Date.now()) / 1000))
      remainText = remainSec > 0 ? '剩余 ' + this.formatRemain(remainSec) : '已超时'
    }

    let statusText = '等待付款'
    if (order.status === 'pending' && remainSec <= 0) statusText = '已过期'
    else if (order.refundStatus === 'refunded') statusText = '已退款'
    else if (order.refundStatus === 'requesting' || order.refundStatus === 'processing') statusText = '退款中'
    else if (order.status === 'cancelled' || order.merchantStatus === 'rejected') statusText = '已取消'
    else if (order.status === 'completed' || order.merchantStatus === 'completed') statusText = '已完成'
    else if (order.status === 'paid') statusText = MERCHANT_STATUS_TEXT[order.merchantStatus] || '已支付'

    return {
      ...order,
      isExpired: order.status === 'pending' && remainSec <= 0,
      remainSec,
      remainText,
      timeStr: this.formatTime(order.createTime),
      statusText,
      addressText: [order.contactName, order.contactPhone, order.addressDetail].filter(Boolean).join(' · ')
    }
  },

  markExpired(orders) {
    return orders.map((order) => {
      if (order.status === 'pending' && order.remainSec <= 0) {
        return { ...order, isExpired: true, statusText: '已过期', remainText: '已过期', remainSec: 0 }
      }
      return order
    })
  },

  tickCountdown() {
    const orders = this.data.orders
    if (!orders.some((order) => order.status === 'pending')) return
    const next = orders.map((order) => {
      if (order.status !== 'pending') return order
      const remainSec = order.remainSec - 1
      if (remainSec > 0) return { ...order, remainSec, remainText: '剩余 ' + this.formatRemain(remainSec) }
      return { ...order, isExpired: true, statusText: '已过期', remainText: '已过期', remainSec: 0 }
    })
    this.setData({ orders: next })
  },

  formatRemain(sec) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    const pad = (n) => n < 10 ? '0' + n : '' + n
    return pad(m) + ':' + pad(s)
  },

  formatTime(time) {
    if (!time) return ''
    const d = time instanceof Date ? time : new Date(time)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => n < 10 ? '0' + n : '' + n
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },

  goToLogin() { wx.switchTab({ url: '/pages/mine/mine' }) },

  goOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id
    if (orderId) wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + encodeURIComponent(orderId) })
  },

  callMerchant(e) {
    const order = this.data.orders.find((item) => item._id === e.currentTarget.dataset.id)
    if (!order || !order.merchantPhone) {
      wx.showToast({ title: '商户暂未配置电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: order.merchantPhone })
  },

  onCancelTap(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId || this.data.cancellingId) return
    wx.showModal({ title: '取消订单', content: '确定取消这笔未支付订单吗？', confirmColor: '#d93026', success: (modal) => {
      if (!modal.confirm) return
      this.setData({ cancellingId: orderId })
      const order = this.data.orders.find((item) => item._id === orderId)
      if (!order || !order.orderNo) return
      closeOrder(order.orderNo).then(() => {
        wx.showToast({ title: '订单已取消', icon: 'success' })
        return this.fetchOrders(false, true)
      }).catch((err) => wx.showToast({ title: err.message || '取消订单失败', icon: 'none' }))
        .finally(() => this.setData({ cancellingId: '' }))
    } })
  },

  stopPaymentPolling() {
    if (this.paymentTimer) {
      clearTimeout(this.paymentTimer)
      this.paymentTimer = null
    }
  },

  confirmPaymentStatus(orderId, attempt = 0) {
    this.stopPaymentPolling()
    const current = this.data.orders.find((item) => item._id === orderId)
    const query = current?.orderNo ? syncOrder(current.orderNo).catch((err) => console.error('支付查单失败', err)) : Promise.resolve()
    query.then(() => this.fetchOrders(false, true, true)).then(() => {
      const order = this.data.orders.find((item) => item._id === orderId)
      if (order && (order.status === 'paid' || order.status === 'completed')) {
        wx.removeStorageSync('pendingPaymentOrderId')
        const formatted = this.formatOrder(order)
        const orders = this.data.orders.map((item) => item._id === orderId ? formatted : item)
        if (!orders.some((item) => item._id === orderId)) orders.unshift(formatted)
        this.setData({ orders })
        return
      }
      if (attempt < 5) this.paymentTimer = setTimeout(() => this.confirmPaymentStatus(orderId, attempt + 1), 5000)
      else {
        wx.removeStorageSync('pendingPaymentOrderId')
        this.fetchOrders()
        wx.showToast({ title: '支付结果同步稍有延迟', icon: 'none' })
      }
    }).catch((err) => {
      console.error('支付结果确认失败', err)
      if (attempt < 5) this.paymentTimer = setTimeout(() => this.confirmPaymentStatus(orderId, attempt + 1), 5000)
    })
  },

  onPayTap(e) {
    if (this.data.payingId) return
    const orderId = e.currentTarget.dataset.id
    const order = this.data.orders.find((item) => item._id === orderId)
    if (!order || order.status !== 'pending' || order.remainSec <= 0) return

    this.setData({ payingId: orderId })
    wx.showLoading({ title: '拉起支付...' })
    requestOrderPayment(order).then(() => {
      wx.hideLoading()
      this.setData({ payingId: '' })
      wx.showToast({ title: '支付结果确认中', icon: 'none' })
      wx.setStorageSync('pendingPaymentOrderId', orderId)
      return syncOrder(order.orderNo).catch((err) => console.error('支付后查单失败', err)).finally(() => this.confirmPaymentStatus(orderId))
    }).catch((err) => {
      console.error('支付失败', err)
      wx.hideLoading()
      this.setData({ payingId: '' })
      wx.showToast({ title: err.message || '支付失败，请重试', icon: 'none' })
    })
  }
})
