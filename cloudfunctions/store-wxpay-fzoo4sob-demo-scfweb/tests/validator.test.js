const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { validateOrderParams, validateRefundParams } = require('../utils/validator');

describe('支付参数校验', () => {
    it('接受完整的小程序订单', () => {
        assert.deepEqual(validateOrderParams({
            description: '商品订单', out_trade_no: 'ORDER001', amount: { total: 100 }
        }), []);
    });

    it('拒绝缺失订单号和非整数金额', () => {
        const errors = validateOrderParams({ description: '商品', amount: { total: 1.5 } });
        assert.equal(errors.length, 2);
    });

    it('接受全额退款并拒绝超额退款', () => {
        assert.deepEqual(validateRefundParams({
            out_trade_no: 'ORDER001', out_refund_no: 'REFUND001', amount: { refund: 100, total: 100 }
        }), []);
        assert.ok(validateRefundParams({
            out_trade_no: 'ORDER001', out_refund_no: 'REFUND001', amount: { refund: 101, total: 100 }
        }).length > 0);
    });
});
