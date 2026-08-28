const PayService = require('../services/payService');
const { validateOrderParams, validateRefundParams } = require('../utils/validator');
const { getOpenId } = require('../utils/cloudbaseAuth');
const pay = new PayService();

function success(res, data) { res.status(200).json({ code: 0, msg: 'success', data }); }
function fail(res, error, status = 400) { res.status(status).json({ code: -1, msg: error.message || String(error), data: null }); }

exports.clientAuth = (req, res, next) => {
    const openid = getOpenId(req);
    if (!openid) return fail(res, new Error('未授权访问'), 401);
    req.openid = openid;
    next();
};

exports.unifiedOrder = async (req, res) => {
    try {
        req.body.payer = { openid: req.openid };
        const errors = validateOrderParams(req.body);
        if (errors.length) throw new Error(errors.join('; '));
        success(res, await pay.unifiedOrder(req.body));
    } catch (err) { fail(res, err); }
};

exports.queryOrder = async (req, res) => {
    try {
        if (!req.body.out_trade_no) throw new Error('out_trade_no 必填');
        success(res, await pay.queryOrder(req.body, req.openid));
    } catch (err) { fail(res, err); }
};

exports.closeOrder = async (req, res) => {
    try {
        if (!req.body.out_trade_no) throw new Error('out_trade_no 必填');
        success(res, await pay.closeOrder(req.body, req.openid));
    } catch (err) { fail(res, err); }
};

exports.refund = async (req, res) => {
    try {
        const errors = validateRefundParams(req.body);
        if (errors.length) throw new Error(errors.join('; '));
        success(res, await pay.refund(req.body, req.openid));
    } catch (err) { fail(res, err); }
};

exports.rejectAndRefund = async (req, res) => {
    try {
        if (!req.body.orderId) throw new Error('orderId 必填');
        success(res, await pay.rejectAndRefund(req.body.orderId, req.body.reason, req.openid));
    } catch (err) { fail(res, err); }
};

exports.queryRefund = async (req, res) => {
    try {
        if (!req.body.out_refund_no) throw new Error('out_refund_no 必填');
        success(res, await pay.queryRefund(req.body, req.openid));
    } catch (err) { fail(res, err); }
};

async function callback(req, res, handler) {
    try {
        if (!req.headers['x-tcb-integration-id']) throw new Error('非法回调来源');
        await handler(req.body?.ParsedContent);
        res.status(200).json({ code: 'SUCCESS', message: '成功' });
    } catch (err) {
        console.error('支付回调处理失败', err);
        res.status(500).json({ code: 'FAIL', message: '处理失败' });
    }
}

exports.payCallback = (req, res) => callback(req, res, (data) => pay.handlePayCallback(data));
exports.refundCallback = (req, res) => callback(req, res, (data) => pay.handleRefundCallback(data));
