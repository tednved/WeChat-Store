const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const { validateConfig } = require('./config/config');
const payRouter = require('./routes/pay');

validateConfig();
const app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/wx-pay', payRouter);

const allowedActions = new Set([
    'wxpay_order', 'wxpay_query_order_by_out_trade_no', 'wxpay_close_order',
    'wxpay_refund', 'wxpay_refund_query', 'unifiedOrderTrigger', 'refundTrigger'
]);
const callbackActions = {
    'TRANSACTION.SUCCESS': 'unifiedOrderTrigger',
    'REFUND.SUCCESS': 'refundTrigger',
    'REFUND.ABNORMAL': 'refundTrigger',
    'REFUND.CLOSED': 'refundTrigger'
};

app.use((req, res, next) => {
    const eventType = req.body?.rawData?.event_type || req.body?.ParsedNotify?.event_type;
    let action = req.body?._action || callbackActions[eventType] || '';
    if (!action && req.body?.path?.includes('/wx-pay/')) action = req.body.path.split('/wx-pay/').pop();
    if (action.includes('/wx-pay/')) action = action.split('/wx-pay/').pop();
    if (!action) return next();
    if (!allowedActions.has(action)) return res.status(400).json({ code: -1, msg: '不支持的操作' });
    delete req.body._action;
    delete req.body.path;
    delete req.body.method;
    req.url = '/' + action;
    req.method = 'POST';
    payRouter(req, res, next);
});

app.use((req, res, next) => next(createError(404)));
app.use((err, req, res, next) => res.status(err.status || 500).json({ code: -1, msg: '服务内部错误' }));

module.exports = app;
