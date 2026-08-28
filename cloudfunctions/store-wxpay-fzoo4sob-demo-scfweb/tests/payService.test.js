const { it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

it('微信支付单使用业务订单的 expireAt', async () => {
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);
    let sentParams;
    class MockSdk {
        async jsapi(params) { sentParams = { ...params }; return { status: 200, data: { prepayId: 'P1' } }; }
    }
    class MockOrders {
        async validateUnified() { return { expireAt }; }
        async handlerUnified() { return true; }
    }
    const original = Module.prototype.require;
    Module.prototype.require = function(id) {
        if (id === '../config/config') return { payConfig: { appId: 'app', mchId: 'mch', jsapiNotifyUrl: 'https://notify' } };
        if (id === './strategies/sdkStrategy') return MockSdk;
        if (id === './orderService') return MockOrders;
        return original.apply(this, arguments);
    };
    try {
        delete require.cache[require.resolve('../services/payService')];
        const PayService = require('../services/payService');
        await new PayService().unifiedOrder({ out_trade_no: 'ORDER001', amount: { total: 100 } });
        assert.equal(sentParams.time_expire, expireAt.toISOString());
    } finally {
        Module.prototype.require = original;
    }
});
