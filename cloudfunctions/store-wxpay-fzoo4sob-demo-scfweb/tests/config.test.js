const { it } = require('node:test');
const assert = require('node:assert/strict');

it('配置模块导出支付配置和校验函数', () => {
    const config = require('../config/config');
    assert.equal(typeof config.payConfig, 'object');
    assert.equal(typeof config.validateConfig, 'function');
});
