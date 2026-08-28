function validateOrderParams(body) {
    const errors = [];
    if (!body.description || typeof body.description !== 'string' || body.description.length > 127) errors.push('description 不合法');
    if (!body.out_trade_no || !/^[a-zA-Z0-9_-]{6,32}$/.test(body.out_trade_no)) errors.push('out_trade_no 不合法');
    if (!Number.isInteger(body.amount?.total) || body.amount.total <= 0) errors.push('amount.total 必须为正整数');
    return errors;
}

function validateRefundParams(body) {
    const errors = [];
    if (!body.out_trade_no) errors.push('out_trade_no 必填');
    if (!body.out_refund_no || !/^[a-zA-Z0-9_-]{6,64}$/.test(body.out_refund_no)) errors.push('out_refund_no 不合法');
    if (!Number.isInteger(body.amount?.refund) || body.amount.refund <= 0) errors.push('amount.refund 必须为正整数');
    if (!Number.isInteger(body.amount?.total) || body.amount.total <= 0) errors.push('amount.total 必须为正整数');
    if (body.amount && body.amount.refund > body.amount.total) errors.push('退款金额不能大于订单金额');
    return errors;
}

module.exports = { validateOrderParams, validateRefundParams };
