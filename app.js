// app.js
const ENV_ID = 'cloud1-d1g0vydqz358e6810'
const WX_PAY_FUNCTION_NAME = 'store-wxpay-fzoo4sob-demo-scfweb'

App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: ENV_ID,
        traceUser: true, // 记录用户访问
      });
    }
  },
  globalData: {
    envId: ENV_ID,
    wxPayFunctionName: WX_PAY_FUNCTION_NAME,
    userInfo: null, // 可以在全局保存用户信息
    openid: null // 登录后保存微信 openid
  }
})
