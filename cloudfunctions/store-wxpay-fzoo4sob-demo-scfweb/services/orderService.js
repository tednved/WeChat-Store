class OrderService {
    constructor({ cloud, db } = {}) { this.cloud = cloud || null; this.db = db || null; }

    getDb() {
        if (!this.db) {
            this.cloud = require('wx-server-sdk');
            this.cloud.init({ env: this.cloud.DYNAMIC_CURRENT_ENV });
            this.db = this.cloud.database();
        }
        return this.db;
    }

    async findOrder(field, value, source) {
        const db = source || this.getDb();
        const result = await db.collection('orders').where({ [field]: String(value || '') }).limit(1).get();
        return result.data && result.data[0];
    }

    expectedFee(order) {
        const fee = Number.isSafeInteger(Number(order.totalFee)) ? Number(order.totalFee) : Math.round(Number(order.totalPrice) * 100);
        if (!Number.isSafeInteger(fee) || fee <= 0) throw new Error('订单金额异常');
        return fee;
    }

    async validateUnified(params) {
        const order = await this.findOrder('orderNo', params.out_trade_no);
        if (!order) throw new Error('订单不存在');
        if (String(order._openid || '') !== String(params.payer?.openid || '')) throw new Error('无权支付该订单');
        if (order.status !== 'pending' || order.paymentStatus === 'paid' || order.paymentLocked === true) throw new Error('订单当前不可支付');
        if (Number(params.amount?.total) !== this.expectedFee(order) || (params.amount?.currency || 'CNY') !== 'CNY') throw new Error('订单金额不一致');
        const expireAt = order.expireAt ? new Date(order.expireAt).getTime() : new Date(order.createTime).getTime() + 15 * 60 * 1000;
        if (Number.isFinite(expireAt) && Date.now() >= expireAt) throw new Error('订单已超时');
        return order;
    }

    async validateQuery(outTradeNo, openid) {
        const order = await this.findOrder('orderNo', outTradeNo);
        if (!order || String(order._openid || '') !== String(openid || '')) throw new Error('订单不存在或无权查看');
        return order;
    }

    async handlerPaymentQuery(outTradeNo) {
        const db = this.getDb();
        const order = await this.findOrder('orderNo', outTradeNo);
        if (!order || order.status !== 'pending') return;
        const delays = [5, 30, 60, 180, 300, 600, 1800];
        const count = Math.max(0, Number(order.paymentQueryCount) || 0) + 1;
        const delay = delays[Math.min(count - 1, delays.length - 1)];
        await db.collection('orders').doc(order._id).update({ data: {
            paymentQueryCount: count,
            nextPaymentQueryAt: new Date(Date.now() + delay * 1000),
            paymentQueryTime: db.serverDate(),
            updateTime: db.serverDate()
        } });
    }

    async handlerUnified(params, result) {
        const order = await this.findOrder('orderNo', params.out_trade_no);
        const db = this.getDb();
        await db.collection('orders').doc(order._id).update({ data: {
            paymentChannel: 'wechatpay-v3', paymentProvider: 'cloudbase-integration',
            prepayId: result?.prepayId || '', paymentQueryCount: 0,
            nextPaymentQueryAt: new Date(Date.now() + 30000), updateTime: db.serverDate()
        } });
        return true;
    }

    async handlerUnifiedTrigger(params) {
        if (params.trade_state !== 'SUCCESS') return true;
        const db = this.getDb();
        const order = await this.findOrder('orderNo', params.out_trade_no);
        if (!order) throw new Error('订单不存在');
        const actualFee = Number(params.amount?.total);
        const transactionId = String(params.transaction_id || '');
        const payerOpenid = String(params.payer?.openid || '');
        if (!transactionId || !payerOpenid || actualFee !== this.expectedFee(order)) throw new Error('支付结果不匹配');
        let newlyPaid = false;
        await db.runTransaction(async (transaction) => {
            const latest = (await transaction.collection('orders').doc(order._id).get()).data;
            if (!latest || String(latest._openid || '') !== payerOpenid || actualFee !== this.expectedFee(latest)) throw new Error('支付结果不匹配');
            if (latest.paymentStatus === 'paid' || latest.paymentLocked === true || latest.status === 'paid' || latest.status === 'completed') {
                if (String(latest.transactionId || '') !== transactionId || Number(latest.payFee) !== actualFee) throw new Error('支付结果不匹配');
                return;
            }
            if (latest.status !== 'pending' || latest.stockState !== 'reserved') throw new Error('订单当前不可支付');
            for (const item of latest.items || []) await transaction.collection('products').doc(item.id).update({ data: {
                reservedStock: db.command.inc(-item.count), soldStock: db.command.inc(item.count), updateTime: db.serverDate()
            } });
            await transaction.collection('orders').doc(order._id).update({ data: {
                status: 'paid', paymentStatus: 'paid', paymentLocked: true, stockState: 'sold',
                merchantStatus: latest.merchantStatus || 'waiting_accept', fulfillmentStatus: latest.fulfillmentStatus || latest.merchantStatus || 'waiting_accept',
                paymentChannel: latest.paymentChannel || 'wechatpay-v3', paymentProvider: latest.paymentProvider || 'cloudbase-integration',
                transactionId, payFee: actualFee, payTime: db.serverDate(), updateTime: db.serverDate()
            } });
            newlyPaid = true;
        });
        if (newlyPaid) await this.notifyMerchant({ ...order, _id: order._id }).catch((err) => console.error('商户通知失败', err));
        return true;
    }

    async notifyMerchant(order) {
        const templateId = process.env.ORDER_NOTIFY_TEMPLATE_ID || '_qXUQmKilpOf8YLJOfx1gdX7aY3Bxf2V9uYxXqT2AXk';
        if (!templateId || !this.cloud || !order.storeId) return;
        const items = order.items || [];
        const users = await this.getDb().collection('users').where({ notifyStoreIds: order.storeId, notifyEnabled: true }).limit(20).get();
        await Promise.all((users.data || []).filter((user) => ['merchant', 'admin'].includes(user.role) && user.isActive !== false && user.openid).map((user) => this.cloud.openapi.subscribeMessage.send({
            touser: user.openid, templateId, page: 'pages/merchant/order-detail/order-detail?orderId=' + order._id,
            miniprogramState: 'formal', lang: 'zh_CN', data: {
                character_string1: { value: String(order.orderNo).slice(-32) },
                thing2: { value: items.map((item) => item.name).join('、').slice(0, 20) || '新订单' },
                number3: { value: String(items.reduce((sum, item) => sum + Number(item.count || 0), 0)) },
                amount8: { value: Number(order.totalPrice || 0).toFixed(2) + '元' },
                thing5: { value: '请在订单详情查看' }
            }
        })));
    }

    async validateClose(outTradeNo, openid) {
        const order = await this.validateQuery(outTradeNo, openid);
        if (order.status !== 'pending') throw new Error('订单当前不可取消');
        return order;
    }

    async handlerClose(outTradeNo) {
        const db = this.getDb();
        const order = await this.findOrder('orderNo', outTradeNo);
        await db.runTransaction(async (transaction) => {
            const latest = (await transaction.collection('orders').doc(order._id).get()).data;
            if (!latest || latest.status !== 'pending' || latest.stockState !== 'reserved') return;
            for (const item of latest.items || []) await transaction.collection('products').doc(item.id).update({ data: {
                stock: db.command.inc(item.count), reservedStock: db.command.inc(-item.count), updateTime: db.serverDate()
            } });
            await transaction.collection('orders').doc(order._id).update({ data: {
                status: 'cancelled', stockState: 'released', cancelTime: db.serverDate(), updateTime: db.serverDate()
            } });
        });
    }

    async validateRefund(params, operatorOpenid) {
        const db = this.getDb();
        const userResult = await db.collection('users').where({ openid: operatorOpenid }).limit(1).get();
        const user = userResult.data && userResult.data[0];
        const order = await this.findOrder('orderNo', params.out_trade_no);
        if (!user || !['merchant', 'admin'].includes(user.role) || user.isActive === false) throw new Error('没有退款权限');
        if (!order || !['paid', 'completed'].includes(order.status) || order.refundStatus !== 'requesting') throw new Error('订单当前不可退款');
        if (String(order.refundNo || '') !== String(params.out_refund_no || '')) throw new Error('退款单号不一致');
        const fee = Number.isSafeInteger(Number(order.payFee)) ? Number(order.payFee) : this.expectedFee(order);
        if (params.amount?.total !== fee || params.amount?.refund !== Number(order.refundFee) || params.amount.refund !== fee) throw new Error('退款金额不一致');
        return order;
    }

    async prepareMerchantRefund(orderId, operatorOpenid, reason) {
        const db = this.getDb();
        const userResult = await db.collection('users').where({ openid: operatorOpenid }).limit(1).get();
        const user = userResult.data && userResult.data[0];
        if (!user || !['merchant', 'admin'].includes(user.role) || user.isActive === false) throw new Error('没有退款权限');
        let request;
        await db.runTransaction(async (transaction) => {
            const order = (await transaction.collection('orders').doc(orderId).get()).data;
            if (!order || !['paid', 'completed'].includes(order.status) || (order.fulfillmentStatus || order.merchantStatus || 'waiting_accept') !== 'waiting_accept') throw new Error('当前订单不能拒单退款');
            if (['processing', 'refunded'].includes(order.refundStatus)) {
                request = { refundStatus: order.refundStatus };
                return;
            }
            const fee = Number.isSafeInteger(Number(order.payFee)) ? Number(order.payFee) : this.expectedFee(order);
            if (!Number.isSafeInteger(fee) || fee <= 0 || !order.transactionId) throw new Error('支付信息不完整，无法退款');
            const refundNo = order.refundNo || ('R' + Date.now() + require('crypto').randomBytes(5).toString('hex').toUpperCase());
            await transaction.collection('orders').doc(orderId).update({ data: {
                refundNo, refundFee: fee, refundStatus: 'requesting', refundReason: String(reason || '商家拒单').slice(0, 80),
                refundRequestTime: db.serverDate(), refundQueryCount: 0, nextRefundQueryAt: new Date(Date.now() + 60000), updateTime: db.serverDate()
            } });
            request = { refundStatus: 'requesting', params: { out_trade_no: order.orderNo, out_refund_no: refundNo, reason: String(reason || '商家拒单').slice(0, 80), amount: { refund: fee, total: fee, currency: 'CNY' } } };
        });
        return request;
    }

    async handlerRefund(params, result) {
        const status = String(result?.refund_status || result?.status || '');
        if (['SUCCESS', 'CHANGE', 'REFUNDCLOSE', 'CLOSED', 'ABNORMAL'].includes(status)) return this.handlerRefundTrigger({
            ...result,
            refund_status: status,
            out_refund_no: result?.out_refund_no || params.out_refund_no,
            amount: result?.amount || params.amount
        });
        const db = this.getDb();
        const order = await this.findOrder('orderNo', params.out_trade_no);
        await db.collection('orders').doc(order._id).update({ data: {
            refundStatus: 'processing', refundId: result?.refund_id || '', refundAcceptedTime: db.serverDate(),
            refundLastError: '', refundNextRetryAt: null, refundQueryCount: 0,
            nextRefundQueryAt: new Date(Date.now() + 60000), updateTime: db.serverDate()
        } });
        return true;
    }

    async handlerRefundUnknown(params, error) {
        const db = this.getDb();
        const order = await this.findOrder('orderNo', params.out_trade_no);
        if (!order) return;
        const attempts = Math.max(0, Number(order.refundRetryCount) || 0) + 1;
        const delaySeconds = Math.min(300, 5 * Math.pow(2, Math.min(attempts - 1, 6)));
        await db.collection('orders').doc(order._id).update({ data: {
            refundRetryCount: attempts,
            refundLastError: String(error?.message || '退款请求结果未知').slice(0, 200),
            refundNextRetryAt: new Date(Date.now() + delaySeconds * 1000),
            refundUpdateTime: db.serverDate(), updateTime: db.serverDate()
        } });
    }

    async handlerRefundFailure(params, error) {
        const db = this.getDb();
        const order = await this.findOrder('orderNo', params.out_trade_no);
        if (!order) return;
        await db.collection('orders').doc(order._id).update({ data: {
            refundStatus: 'failed', refundFailReason: String(error?.message || '退款申请失败').slice(0, 200),
            refundNextRetryAt: null, refundUpdateTime: db.serverDate(), updateTime: db.serverDate()
        } });
    }

    async validateRefundQuery(outRefundNo, openid) {
        const db = this.getDb();
        const userResult = await db.collection('users').where({ openid }).limit(1).get();
        const user = userResult.data && userResult.data[0];
        const order = await this.findOrder('refundNo', outRefundNo);
        if (!user || !['merchant', 'admin'].includes(user.role) || user.isActive === false) throw new Error('没有退款查询权限');
        if (!order) throw new Error('退款单不存在');
        return order;
    }

    async handlerRefundTrigger(params) {
        const status = params.refund_status || params.status;
        if (!['SUCCESS', 'CHANGE', 'REFUNDCLOSE', 'CLOSED', 'PROCESSING', 'ABNORMAL'].includes(status)) return true;
        const db = this.getDb();
        const outRefundNo = params.out_refund_no || params.outRefundNo;
        const order = await this.findOrder('refundNo', outRefundNo);
        if (!order) throw new Error('退款单不存在');
        const refundFee = Number(params.amount?.refund);
        const totalFee = Number(params.amount?.total);
        if (refundFee !== Number(order.refundFee) || totalFee !== this.expectedFee(order)) throw new Error('退款结果金额不一致');
        await db.runTransaction(async (transaction) => {
            const latest = (await transaction.collection('orders').doc(order._id).get()).data;
            if (!latest) throw new Error('订单不存在');
            if (status === 'SUCCESS' && latest.refundStatus !== 'refunded') {
                if (latest.stockState === 'sold') for (const item of latest.items || []) await transaction.collection('products').doc(item.id).update({ data: {
                    stock: db.command.inc(item.count), soldStock: db.command.inc(-item.count), updateTime: db.serverDate()
                } });
                await transaction.collection('orders').doc(order._id).update({ data: {
                    refundStatus: 'refunded', refundId: params.refund_id || latest.refundId || '', refundTime: db.serverDate(),
                    merchantStatus: 'rejected', fulfillmentStatus: 'rejected', stockState: latest.stockState === 'sold' ? 'restored' : latest.stockState, updateTime: db.serverDate()
                } });
            } else if (['CHANGE', 'REFUNDCLOSE', 'CLOSED', 'ABNORMAL'].includes(status)) {
                await transaction.collection('orders').doc(order._id).update({ data: { refundStatus: 'failed', refundFailReason: status, updateTime: db.serverDate() } });
            } else if (latest.refundStatus !== 'refunded') {
                await transaction.collection('orders').doc(order._id).update({ data: { refundStatus: 'processing', updateTime: db.serverDate() } });
            }
        });
        return true;
    }
}

module.exports = OrderService;
