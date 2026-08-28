const WxPay = require('wechatpay-node-v3');
const crypto = require('crypto');

class SdkStrategy {
    constructor(config) {
        this.config = config;
        this.wxPay = new WxPay({
            appid: config.appId,
            mchid: config.mchId,
            serial_no: config.mchSerialNo,
            key: config.mchAPIv3Key,
            privateKey: config.mchPrivateKey,
            publicKey: config.mchWechatpayPublicKey
        });
    }

    async jsapi(params) {
        const result = await this.wxPay.transactions_jsapi(params);
        if (result.status !== 200 || !result.data?.prepay_id) return result;
        const timeStamp = String(Math.floor(Date.now() / 1000));
        const nonceStr = crypto.randomBytes(16).toString('hex');
        const packageValue = 'prepay_id=' + result.data.prepay_id;
        const paySign = crypto.createSign('RSA-SHA256')
            .update(`${params.appid}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`)
            .sign(this.config.mchPrivateKey, 'base64');
        result.data = { prepayId: result.data.prepay_id, timeStamp, nonceStr, package: packageValue, signType: 'RSA', paySign };
        return result;
    }

    query(params) { return this.wxPay.query(params); }
    close(outTradeNo) { return this.wxPay.close(outTradeNo); }
    refund(params) { return this.wxPay.refunds(params); }
    queryRefund(outRefundNo) { return this.wxPay.find_refunds(outRefundNo); }
}

module.exports = SdkStrategy;
