function getOpenId(req) {
    return String(req.headers['x-wx-openid'] || '');
}

module.exports = { getOpenId };
