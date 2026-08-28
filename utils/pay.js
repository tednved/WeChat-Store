function callWxPay(action, data) {
  const { envId, wxPayFunctionName } = getApp().globalData
  return new Promise((resolve, reject) => {
    wx.cloud.callHTTPFunction({
      name: wxPayFunctionName,
      config: { env: envId },
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      path: '/wx-pay/' + action,
      data,
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(body.msg || '支付服务请求失败'))
          return
        }
        resolve(body)
      },
      fail: (err) => reject(new Error(err.errMsg || '支付服务请求失败'))
    })
  })
}

function requireData(body) {
  if (!body || body.code !== 0) throw new Error((body && body.msg) || '支付服务请求失败')
  return body.data || {}
}

function createPayment(order) {
  return callWxPay('wxpay_order', {
    description: String(order.description || order.storeName || '店铺') + '-商品订单',
    out_trade_no: order.orderNo,
    amount: { total: Number(order.totalFee), currency: 'CNY' }
  }).then(requireData)
}

function requestOrderPayment(order) {
  return createPayment(order).then((payment) => new Promise((resolve, reject) => {
    wx.requestPayment({
      timeStamp: String(payment.timeStamp), nonceStr: payment.nonceStr,
      package: payment.package, signType: payment.signType, paySign: payment.paySign,
      success: resolve, fail: reject
    })
  }))
}

function requestRefund(data) {
  return callWxPay('wxpay_refund', data).then(requireData)
}

function syncOrder(orderNo) {
  return callWxPay('wxpay_query_order_by_out_trade_no', { out_trade_no: orderNo }).then(requireData)
}

function closeOrder(orderNo) {
  return callWxPay('wxpay_close_order', { out_trade_no: orderNo }).then(requireData)
}

function syncRefund(outRefundNo) {
  return callWxPay('wxpay_refund_query', { out_refund_no: outRefundNo }).then(requireData)
}

function reconcileRefund(order) {
  if (order.refundStatus === 'requesting') return requestRefund({
    out_trade_no: order.orderNo,
    out_refund_no: order.refundNo,
    reason: order.refundReason || '商家拒单',
    amount: { refund: Number(order.refundFee), total: Number(order.payFee || order.totalFee), currency: 'CNY' }
  })
  return syncRefund(order.refundNo)
}

module.exports = { requestOrderPayment, requestRefund, syncOrder, syncRefund, reconcileRefund, closeOrder }
