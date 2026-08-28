const express = require('express');
const controller = require('../controllers/payController');
const router = express.Router();

router.post('/wxpay_order', controller.clientAuth, controller.unifiedOrder);
router.post('/wxpay_query_order_by_out_trade_no', controller.clientAuth, controller.queryOrder);
router.post('/wxpay_close_order', controller.clientAuth, controller.closeOrder);
router.post('/wxpay_refund', controller.clientAuth, controller.refund);
router.post('/wxpay_refund_query', controller.clientAuth, controller.queryRefund);
router.post('/unifiedOrderTrigger', controller.payCallback);
router.post('/refundTrigger', controller.refundCallback);

module.exports = router;
