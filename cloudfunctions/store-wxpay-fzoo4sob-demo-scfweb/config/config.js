const payConfig = {
    appId: process.env.appId || '',
    mchId: process.env.merchantId || '',
    mchSerialNo: process.env.merchantSerialNumber || '',
    mchAPIv3Key: process.env.apiV3Key || '',
    mchPrivateKey: (process.env.privateKey || '').replace(/\\n/g, '\n'),
    mchWechatpayPublicKey: (process.env.wxPayPublicKey || '').replace(/\\n/g, '\n'),
    mchWechatpayPublicKeyId: process.env.wxPayPublicKeyId || '',
    jsapiNotifyUrl: process.env.notifyURLPayURL || '',
    refundNotifyUrl: process.env.notifyURLRefundsURL || ''
};

function validateConfig() {
    const required = {
        appId: payConfig.appId, merchantId: payConfig.mchId,
        merchantSerialNumber: payConfig.mchSerialNo, apiV3Key: payConfig.mchAPIv3Key,
        privateKey: payConfig.mchPrivateKey, wxPayPublicKey: payConfig.mchWechatpayPublicKey,
        wxPayPublicKeyId: payConfig.mchWechatpayPublicKeyId,
        notifyURLPayURL: payConfig.jsapiNotifyUrl, notifyURLRefundsURL: payConfig.refundNotifyUrl
    };
    const errors = Object.entries(required).filter(([, value]) => !value).map(([key]) => key + ' 未配置');
    for (const [key, value] of [['notifyURLPayURL', payConfig.jsapiNotifyUrl], ['notifyURLRefundsURL', payConfig.refundNotifyUrl]]) {
        if (value && (!value.startsWith('https://') || value.includes('?'))) errors.push(key + ' 必须是无查询参数的 HTTPS 地址');
    }
    if (errors.length) console.warn('支付配置不完整:', errors.join('; '));
    return errors;
}

module.exports = { payConfig, validateConfig };
