const { payConfig } = require('../config/config');
const SdkStrategy = require('./strategies/sdkStrategy');
const OrderService = require('./orderService');

class PayService {
    constructor() { this.orders = new OrderService(); this.sdk = new SdkStrategy(payConfig); }

    async unifiedOrder(params) {
        const order = await this.orders.validateUnified(params);
        params.appid = payConfig.appId;
        params.mchid = payConfig.mchId;
        params.notify_url = payConfig.jsapiNotifyUrl;
        const expireAt = order.expireAt
            ? new Date(order.expireAt)
            : new Date(new Date(order.createTime).getTime() + 15 * 60 * 1000);
        if (!Number.isFinite(expireAt.getTime()) || expireAt.getTime() <= Date.now()) throw new Error('订单已超时');
        params.time_expire = expireAt.toISOString();
        const result = await this.sdk.jsapi(params);
        if (result.status !== 200 || !result.data) throw new Error(result.data?.message || '微信下单失败');
        await this.orders.handlerUnified(params, result.data);
        return result.data;
    }

    async queryOrder(params, openid) {
        await this.orders.validateQuery(params.out_trade_no, openid);
        try {
            const result = await this.sdk.query(params);
            if (result.status === 200 && result.data?.trade_state === 'SUCCESS') await this.orders.handlerUnifiedTrigger(result.data);
            else await this.orders.handlerPaymentQuery(params.out_trade_no);
            return result.data || result;
        } catch (err) {
            await this.orders.handlerPaymentQuery(params.out_trade_no);
            throw err;
        }
    }

    async closeOrder(params, openid) {
        await this.orders.validateClose(params.out_trade_no, openid);
        const result = await this.sdk.close(params.out_trade_no);
        if (result.status !== 204 && result.status !== 200) throw new Error(result.data?.message || '关闭支付单失败');
        await this.orders.handlerClose(params.out_trade_no);
        return { closed: true };
    }

    async refund(params, openid) {
        await this.orders.validateRefund(params, openid);
        params.notify_url = payConfig.refundNotifyUrl;
        let result;
        try {
            result = await this.sdk.refund(params);
        } catch (err) {
            await this.orders.handlerRefundUnknown(params, err);
            throw err;
        }
        if (result.status !== 200 || !result.data) {
            const error = new Error(result.data?.message || '退款申请失败');
            await this.orders.handlerRefundFailure(params, error);
            throw error;
        }
        await this.orders.handlerRefund(params, result.data);
        return result.data;
    }

    async rejectAndRefund(orderId, reason, openid) {
        const prepared = await this.orders.prepareMerchantRefund(String(orderId || ''), openid, reason);
        if (!prepared.params) return { refundStatus: prepared.refundStatus };
        const params = prepared.params;
        params.notify_url = payConfig.refundNotifyUrl;
        try {
            const result = await this.sdk.refund(params);
            if (result.status !== 200 || !result.data) throw new Error(result.data?.message || '退款申请失败');
            await this.orders.handlerRefund(params, result.data);
            return { refundStatus: result.data.status === 'SUCCESS' ? 'refunded' : 'processing' };
        } catch (err) {
            await this.orders.handlerRefundUnknown(params, err);
            throw err;
        }
    }

    async queryRefund(params, openid) {
        await this.orders.validateRefundQuery(params.out_refund_no, openid);
        const result = await this.sdk.queryRefund(params.out_refund_no);
        if (result.status === 200 && result.data) await this.orders.handlerRefundTrigger(result.data);
        return result.data || result;
    }

    async handlePayCallback(data) { if (!data) throw new Error('回调明文缺失'); await this.orders.handlerUnifiedTrigger(data); return true; }
    async handleRefundCallback(data) { if (!data) throw new Error('回调明文缺失'); await this.orders.handlerRefundTrigger(data); return true; }
}

module.exports = PayService;
