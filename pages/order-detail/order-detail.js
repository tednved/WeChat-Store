const { requestOrderPayment, syncOrder, closeOrder } = require('../../utils/pay')
const EXPIRE_MINUTES = 15

Page({
  data: { order: null, loading: true, paying: false, cancelling: false },
  orderId: '',
  paymentTimer: null,
  statusTimer: null,
  countdownTimer: null,
  active: false,

  onLoad(options) { this.orderId = decodeURIComponent(options.id || '') },
  onShow() {
    if (!this.orderId) return
    this.active = true
    this.loadOrder()
  },
  onHide() { this.active = false; this.stopStatusRefresh(); this.stopCountdown() },
  onUnload() { this.active = false; this.stopStatusRefresh(); this.stopCountdown(); if (this.paymentTimer) clearTimeout(this.paymentTimer) },

  loadOrder(silent = false) {
    if (!silent) this.setData({ loading: true })
    return wx.cloud.callFunction({ name: 'userOrders', data: { action: 'get', orderId: this.orderId } }).then((res) => {
      const result = res.result || {}
      if (!result.success || !result.order) throw new Error(result.message || '无权查看该订单')
      this.setData({ order: this.formatOrder(result.order), loading: false })
      this.startCountdown()
      this.scheduleStatusRefresh()
      return result.order
    }).catch((err) => {
      console.error('订单详情加载失败', err)
      this.setData({ order: null, loading: false })
    })
  },

  stopStatusRefresh() { if (this.statusTimer) { clearTimeout(this.statusTimer); this.statusTimer = null } },
  scheduleStatusRefresh() {
    this.stopStatusRefresh()
    const order = this.data.order
    const active = order && (order.status === 'pending' || order.refundStatus === 'requesting' || order.refundStatus === 'processing')
    if (this.active && active) this.statusTimer = setTimeout(() => this.loadOrder(true), 5000)
  },

  startCountdown() {
    this.stopCountdown()
    if (this.active && this.data.order && this.data.order.status === 'pending' && this.data.order.remainSec > 0) this.countdownTimer = setInterval(() => this.tickCountdown(), 1000)
  },
  stopCountdown() { if (this.countdownTimer) { clearInterval(this.countdownTimer); this.countdownTimer = null } },
  tickCountdown() {
    const order = this.data.order
    if (!order || order.status !== 'pending') return this.stopCountdown()
    const remainSec = Math.max(0, Number(order.remainSec || 0) - 1)
    if (remainSec > 0) return this.setData({ order: { ...order, remainSec, remainText: this.formatRemain(remainSec) } })
    this.setData({ order: { ...order, remainSec: 0, remainText: '', isExpired: true, statusText: '订单已过期', statusDesc: '该订单已超过支付时间，可取消订单' } })
    this.stopCountdown()
  },

  formatOrder(order) {
    const createAt = order.createTime ? new Date(order.createTime).getTime() : 0
    const expireAt = order.expireAt ? new Date(order.expireAt).getTime() : createAt + EXPIRE_MINUTES * 60000
    const remainSec = order.status === 'pending' ? Math.max(0, Math.ceil((expireAt - Date.now()) / 1000)) : 0
    const isExpired = order.status === 'pending' && remainSec <= 0
    const status = order.refundStatus === 'refunded' ? 'refunded' : order.refundStatus === 'requesting' || order.refundStatus === 'processing' ? 'refunding' : order.merchantStatus === 'rejected' ? 'cancelled' : order.status
    const textMap = { pending: '等待付款', paid: '商家处理中', completed: '订单已完成', cancelled: '订单已取消', refunding: '退款处理中', refunded: '已退款' }
    const descMap = { pending: '请在倒计时结束前完成支付', paid: '付款成功，商家正在处理您的订单', completed: '感谢您的购买', cancelled: '订单已关闭', refunding: '退款已提交，将原路退回您的支付账户', refunded: '退款已完成，请留意微信支付账单' }
    return {
      ...order,
      status,
      isExpired,
      statusText: isExpired ? '订单已过期' : (textMap[status] || '订单处理中'),
      statusDesc: isExpired ? '该订单已超过支付时间，可取消订单' : (descMap[status] || ''),
      remainSec,
      remainText: remainSec ? this.formatRemain(remainSec) : '',
      goodsTotalStr: Number(order.goodsTotal || 0).toFixed(2),
      deliveryFeeStr: Number(order.deliveryFee || 0).toFixed(2),
      totalPriceStr: Number(order.totalPrice || 0).toFixed(2),
      timeStr: this.formatTime(order.createTime),
      payTimeStr: this.formatTime(order.payTime)
    }
  },

  payOrder() {
    if (this.data.paying) return
    this.setData({ paying: true })
    requestOrderPayment(this.data.order).then(() => {
      wx.showToast({ title: '支付结果确认中', icon: 'none' })
      return syncOrder(this.data.order.orderNo).catch((err) => console.error('支付后查单失败', err)).finally(() => this.pollPayment())
    }).catch((err) => {
      const cancelled = ((err && err.errMsg) || '').includes('cancel')
      wx.showToast({ title: cancelled ? '已取消支付' : (err.message || '支付未完成'), icon: 'none' })
      this.setData({ paying: false })
    })
  },

  cancelOrder() {
    const order = this.data.order
    if (!order || order.status !== 'pending' || this.data.cancelling) return
    wx.showModal({ title: '取消订单', content: '确定取消这笔未支付订单吗？', confirmColor: '#d93026', success: (modal) => {
      if (!modal.confirm) return
      this.setData({ cancelling: true })
      closeOrder(order.orderNo).then(() => {
        wx.showToast({ title: '订单已取消', icon: 'none' })
        return this.loadOrder(true)
      }).catch((err) => wx.showToast({ title: err.message || '取消订单失败', icon: 'none' }))
        .finally(() => this.setData({ cancelling: false }))
    } })
  },

  pollPayment(attempt = 0) {
    this.loadOrder(true).then((order) => {
      if (order && (order.status === 'paid' || order.status === 'completed')) {
        this.setData({ paying: false })
        wx.showToast({ title: '支付成功', icon: 'success' })
      } else if (attempt < 5) this.paymentTimer = setTimeout(() => this.pollPayment(attempt + 1), 5000)
      else this.setData({ paying: false })
    })
  },

  callMerchant() {
    const phone = this.data.order && this.data.order.merchantPhone
    if (phone) wx.makePhoneCall({ phoneNumber: phone })
  },

  formatRemain(sec) { const m = Math.floor(sec / 60); const s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s },
  formatTime(value) { if (!value) return ''; const d = new Date(value); if (isNaN(d.getTime())) return ''; const pad = (n) => n < 10 ? '0' + n : String(n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) }
})
