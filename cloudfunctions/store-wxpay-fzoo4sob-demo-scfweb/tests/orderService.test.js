const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const OrderService = require('../services/orderService');

function createDb() {
    const state = {
        orders: {
            order1: {
                _openid: 'openid-1', storeId: 'store-1', orderNo: 'ORDER001', totalFee: 100,
                status: 'pending', paymentStatus: 'unpaid', paymentLocked: false,
                stockState: 'reserved', expireAt: new Date(Date.now() + 60000),
                items: [{ id: 'product1', count: 2 }]
            }
        },
        products: { product1: { stock: 8, reservedStock: 2, soldStock: 0 } },
        users: { merchant1: { openid: 'merchant-1', role: 'merchant', storeIds: ['store-1'], isActive: true } }
    };
    const db = {
        command: { inc: (value) => ({ $inc: value }) },
        serverDate: () => 'SERVER_DATE',
        collection(name) {
            return {
                where(query) {
                    return {
                        limit() { return this; },
                        async get() {
                            return { data: Object.entries(state[name])
                                .filter(([, value]) => Object.keys(query).every((key) => value[key] === query[key]))
                                .map(([id, value]) => ({ _id: id, ...value })) };
                        }
                    };
                },
                doc(id) {
                    return {
                        async get() { return { data: state[name][id] }; },
                        async update({ data }) {
                            for (const [key, value] of Object.entries(data)) {
                                state[name][id][key] = value && value.$inc !== undefined
                                    ? Number(state[name][id][key] || 0) + value.$inc
                                    : value;
                            }
                        }
                    };
                }
            };
        },
        async runTransaction(callback) { return callback(db); }
    };
    return { db, state };
}

describe('OrderService', () => {
    it('下单前拒绝客户端篡改金额', async () => {
        const { db } = createDb();
        const service = new OrderService({ db });
        await assert.rejects(() => service.validateUnified({
            out_trade_no: 'ORDER001', amount: { total: 1, currency: 'CNY' },
            payer: { openid: 'openid-1' }
        }), /订单金额不一致/);
    });

    it('未支付查单按递增时间安排下一次补查', async () => {
        const { db, state } = createDb();
        const service = new OrderService({ db });
        await service.handlerPaymentQuery('ORDER001');
        assert.equal(state.orders.order1.paymentQueryCount, 1);
        assert.ok(new Date(state.orders.order1.nextPaymentQueryAt).getTime() > Date.now());
    });

    it('支付回调原子更新订单与库存且可幂等重试', async () => {
        const { db, state } = createDb();
        const service = new OrderService({ db });
        const callback = {
            out_trade_no: 'ORDER001', transaction_id: 'WX001', trade_state: 'SUCCESS',
            amount: { total: 100 }, payer: { openid: 'openid-1' }
        };
        await service.handlerUnifiedTrigger(callback);
        await service.handlerUnifiedTrigger(callback);
        assert.equal(state.orders.order1.status, 'paid');
        assert.equal(state.orders.order1.transactionId, 'WX001');
        assert.equal(state.orders.order1.stockState, 'sold');
        assert.equal(state.products.product1.reservedStock, 0);
        assert.equal(state.products.product1.soldStock, 2);
    });

    it('退款回调幂等恢复库存', async () => {
        const { db, state } = createDb();
        const order = state.orders.order1;
        Object.assign(order, {
            status: 'paid', paymentStatus: 'paid', paymentLocked: true, stockState: 'sold',
            transactionId: 'WX001', payFee: 100, refundNo: 'REFUND001', refundFee: 100, refundStatus: 'processing'
        });
        Object.assign(state.products.product1, { reservedStock: 0, soldStock: 2 });
        const service = new OrderService({ db });
        const callback = {
            out_trade_no: 'ORDER001', out_refund_no: 'REFUND001', refund_id: 'WR1',
            refund_status: 'SUCCESS', amount: { refund: 100, total: 100 }
        };
        await service.handlerRefundTrigger(callback);
        await service.handlerRefundTrigger(callback);
        assert.equal(order.refundStatus, 'refunded');
        assert.equal(order.stockState, 'restored');
        assert.equal(state.products.product1.stock, 10);
        assert.equal(state.products.product1.soldStock, 0);
    });

    it('退款关闭状态结束轮询并允许重新退款', async () => {
        const { db, state } = createDb();
        Object.assign(state.orders.order1, {
            status: 'paid', paymentStatus: 'paid', paymentLocked: true,
            payFee: 100, refundNo: 'REFUND001', refundFee: 100, refundStatus: 'processing'
        });
        const service = new OrderService({ db });
        await service.handlerRefundTrigger({
            out_refund_no: 'REFUND001', refund_status: 'CLOSED', amount: { refund: 100, total: 100 }
        });
        assert.equal(state.orders.order1.refundStatus, 'failed');
        assert.equal(state.orders.order1.refundFailReason, 'CLOSED');
    });

    it('关单释放预占库存', async () => {
        const { db, state } = createDb();
        const service = new OrderService({ db });
        await service.handlerClose('ORDER001');
        assert.equal(state.orders.order1.status, 'cancelled');
        assert.equal(state.orders.order1.stockState, 'released');
        assert.equal(state.products.product1.stock, 10);
        assert.equal(state.products.product1.reservedStock, 0);
    });

    it('订单仍在支付时限内也允许下单用户主动取消', async () => {
        const { db } = createDb();
        const service = new OrderService({ db });
        const order = await service.validateClose('ORDER001', 'openid-1');
        assert.equal(order.orderNo, 'ORDER001');
    });

    it('拒绝普通用户发起退款', async () => {
        const { db, state } = createDb();
        Object.assign(state.orders.order1, {
            status: 'paid', paymentStatus: 'paid', paymentLocked: true,
            payFee: 100, refundNo: 'REFUND001', refundFee: 100, refundStatus: 'requesting'
        });
        state.users.merchant1.role = 'user';
        const service = new OrderService({ db });
        await assert.rejects(() => service.validateRefund({
            out_trade_no: 'ORDER001', out_refund_no: 'REFUND001', amount: { refund: 100, total: 100 }
        }, 'merchant-1'), /没有退款权限/);
    });

    it('确定性退款失败解锁订单，未知结果设置退避时间', async () => {
        const { db, state } = createDb();
        Object.assign(state.orders.order1, { refundStatus: 'requesting', refundNo: 'REFUND001' });
        const service = new OrderService({ db });
        await service.handlerRefundUnknown({ out_trade_no: 'ORDER001' }, new Error('网络超时'));
        assert.equal(state.orders.order1.refundStatus, 'requesting');
        assert.equal(state.orders.order1.refundRetryCount, 1);
        assert.ok(new Date(state.orders.order1.refundNextRetryAt).getTime() > Date.now());
        await service.handlerRefundFailure({ out_trade_no: 'ORDER001' }, new Error('参数错误'));
        assert.equal(state.orders.order1.refundStatus, 'failed');
        assert.equal(state.orders.order1.refundFailReason, '参数错误');
    });
});
