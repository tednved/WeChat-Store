const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let controller;

function reqRes(body = {}, headers = {}) {
    let status = 200;
    let data;
    return {
        req: { body, headers },
        res: { status(code) { status = code; return this; }, json(value) { data = value; return this; } },
        result: () => ({ status, data })
    };
}

before(() => {
    class MockPayService {
        async unifiedOrder() { return { timeStamp: '1', nonceStr: 'n', package: 'prepay_id=x', signType: 'RSA', paySign: 's' }; }
        async queryOrder() { return { trade_state: 'SUCCESS' }; }
        async closeOrder() { return { closed: true }; }
        async refund() { return { refund_id: 'R1' }; }
        async queryRefund() { return { refund_status: 'SUCCESS' }; }
        async handlePayCallback() { return true; }
        async handleRefundCallback() { return true; }
    }
    const original = Module.prototype.require;
    Module.prototype.require = function(id) {
        if (id === '../services/payService') return MockPayService;
        if (id === '../utils/cloudbaseAuth') return { getOpenId: (req) => req.headers['x-wx-openid'] || '' };
        return original.apply(this, arguments);
    };
    try { controller = require('../controllers/payController'); } finally { Module.prototype.require = original; }
});

describe('支付控制器', () => {
    it('拒绝没有平台 openid 的客户端请求', () => {
        const x = reqRes();
        controller.clientAuth(x.req, x.res, () => assert.fail('不应放行'));
        assert.equal(x.result().status, 401);
    });

    it('小程序下单返回支付参数', async () => {
        const x = reqRes({ description: '商品', out_trade_no: 'ORDER001', amount: { total: 100 } }, { 'x-wx-openid': 'openid-1' });
        controller.clientAuth(x.req, x.res, () => {});
        await controller.unifiedOrder(x.req, x.res);
        assert.equal(x.result().status, 200);
        assert.equal(x.result().data.data.signType, 'RSA');
    });

    it('只接受集成中心转发的支付回调', async () => {
        const rejected = reqRes({ ParsedContent: {} });
        await controller.payCallback(rejected.req, rejected.res);
        assert.equal(rejected.result().status, 500);
        const accepted = reqRes({ ParsedContent: {} }, { 'x-tcb-integration-id': 'integration' });
        await controller.payCallback(accepted.req, accepted.res);
        assert.equal(accepted.result().status, 200);
    });
});
