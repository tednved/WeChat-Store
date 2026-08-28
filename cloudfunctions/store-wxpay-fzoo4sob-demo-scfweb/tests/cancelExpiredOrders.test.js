const { it } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
const OrderService = require('../services/orderService');

it('有访问时清理微信侧不存在的过期订单并释放库存', async () => {
    const state = {
        order: { _id: 'order1', _openid: 'openid-1', orderNo: 'ORDER001', status: 'pending', stockState: 'reserved', createTime: new Date(0), items: [{ id: 'product1', count: 2 }] },
        product: { stock: 8, reservedStock: 2 },
        user: { _id: 'user1', openid: 'openid-1' }
    };
    const db = {
        command: { inc: (value) => ({ $inc: value }), lte: (value) => ({ $lte: value }) }, serverDate: () => new Date(),
        collection(name) { return {
            where() { return { orderBy() { return this; }, limit() { return this; }, async get() { return { data: [name === 'users' ? state.user : state.order] }; } }; },
            doc() { return {
                async get() { return { data: name === 'orders' ? state.order : name === 'users' ? state.user : state.product }; },
                async update({ data }) { const target = name === 'orders' ? state.order : name === 'users' ? state.user : state.product; for (const [key, value] of Object.entries(data)) target[key] = value?.$inc !== undefined ? Number(target[key] || 0) + value.$inc : value; }
            }; }
        }; },
        async runTransaction(callback) { return callback(db); }
    };
    let closeCalled = false;
    class MockWxPay {
        async query() { return { status: 404, data: { code: 'ORDER_NOT_EXIST' } }; }
        async close() { closeCalled = true; return { status: 404 }; }
    }
    let openid = 'openid-1';
    const cloud = { DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => db, getWXContext: () => ({ OPENID: openid }) };
    const original = Module.prototype.require;
    Module.prototype.require = function(id) {
        if (id === 'wx-server-sdk') return cloud;
        if (id === 'wechatpay-node-v3') return MockWxPay;
        return original.apply(this, arguments);
    };
    const env = { appId: 'a', merchantId: 'm', merchantSerialNumber: 's', apiV3Key: 'k', privateKey: 'p', wxPayPublicKey: 'w' };
    Object.assign(process.env, env);
    try {
        delete require.cache[require.resolve('../../cancelExpiredOrders/index')];
        const fn = require('../../cancelExpiredOrders/index');
        const result = await fn.main({ action: 'cleanup' });
        assert.equal(result.cancelled, 1);
        assert.equal(closeCalled, false);
        assert.equal(state.order.status, 'cancelled');
        assert.equal(state.order.stockState, 'released');
        assert.equal(state.product.stock, 10);
        assert.equal(state.product.reservedStock, 0);
        const throttled = await fn.main({ action: 'cleanup' });
        assert.equal(throttled.throttled, true);
        openid = '';
        const timer = await fn.main({});
        assert.equal(timer.success, true);
    } finally {
        Module.prototype.require = original;
        for (const key of Object.keys(env)) delete process.env[key];
    }
});

it('主动查单先入账且回调迟到时只扣一次库存并只通知一次', async () => {
    const payment = {
        out_trade_no: 'ORDER002', transaction_id: 'WX002', trade_state: 'SUCCESS',
        amount: { total: 100 }, payer: { openid: 'buyer-openid' }
    };
    const state = {
        order: {
            _id: 'order2', _openid: 'buyer-openid', storeId: 'default-store', orderNo: 'ORDER002',
            status: 'pending', paymentStatus: 'unpaid', paymentLocked: false, stockState: 'reserved',
            totalFee: 100, totalPrice: 1, createTime: new Date(0), expireAt: new Date(0),
            items: [{ id: 'product2', name: '商品', count: 2 }], addressDetail: '地址'
        },
        product: { stock: 8, reservedStock: 2, soldStock: 0 },
        buyer: { _id: 'buyer', openid: 'buyer-openid' },
        merchant: { _id: 'merchant', openid: 'merchant-openid', role: 'merchant', isActive: true, notifyEnabled: true, notifyStoreIds: ['default-store'] }
    };
    const db = {
        command: { inc: (value) => ({ $inc: value }), lte: (value) => ({ $lte: value }) }, serverDate: () => new Date(),
        collection(name) { return {
            where(query) { return {
                orderBy() { return this; }, limit() { return this; },
                async get() {
                    if (name === 'orders') return { data: [state.order] };
                    if (query.openid) return { data: [state.buyer] };
                    return { data: [state.merchant] };
                }
            }; },
            doc() { return {
                async get() { return { data: name === 'orders' ? state.order : name === 'users' ? state.buyer : state.product }; },
                async update({ data }) {
                    const target = name === 'orders' ? state.order : name === 'users' ? state.buyer : state.product;
                    for (const [key, value] of Object.entries(data)) target[key] = value?.$inc !== undefined ? Number(target[key] || 0) + value.$inc : value;
                }
            }; }
        }; },
        async runTransaction(callback) { return callback(db); }
    };
    let notifications = 0;
    class MockWxPay { async query() { return { status: 200, data: payment }; } }
    const cloud = {
        DYNAMIC_CURRENT_ENV: 'test', init() {}, database: () => db, getWXContext: () => ({ OPENID: 'buyer-openid' }),
        openapi: { subscribeMessage: { async send() { notifications++; } } }
    };
    const original = Module.prototype.require;
    Module.prototype.require = function(id) {
        if (id === 'wx-server-sdk') return cloud;
        if (id === 'wechatpay-node-v3') return MockWxPay;
        return original.apply(this, arguments);
    };
    const env = {
        appId: 'a', merchantId: 'm', merchantSerialNumber: 's', apiV3Key: 'k', privateKey: 'p', wxPayPublicKey: 'w',
        ORDER_NOTIFY_TEMPLATE_ID: 'template'
    };
    Object.assign(process.env, env);
    try {
        delete require.cache[require.resolve('../../cancelExpiredOrders/index')];
        const fn = require('../../cancelExpiredOrders/index');
        await fn.main({ action: 'cleanup' });
        await new OrderService({ cloud, db }).handlerUnifiedTrigger(payment);
        assert.equal(state.order.status, 'paid');
        assert.equal(state.order.paymentStatus, 'paid');
        assert.equal(state.order.transactionId, 'WX002');
        assert.equal(state.order.stockState, 'sold');
        assert.equal(state.product.reservedStock, 0);
        assert.equal(state.product.soldStock, 2);
        assert.equal(notifications, 1);
    } finally {
        Module.prototype.require = original;
        for (const key of Object.keys(env)) delete process.env[key];
    }
});
