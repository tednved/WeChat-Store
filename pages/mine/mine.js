// pages/mine/mine.js
const LOGIN_STORAGE_KEY = 'loginInfo'

Page({
  data: {
    loading: true,
    isLoggedIn: false,
    openid: '',
    avatarUrl: '',
    nickname: '',
    role: 'user',
    merchantId: '',
    storeIds: [],
    notifyEnabled: true,
    isActive: true
  },

  onShow() {
    this.checkLogin()
  },

  checkLogin() {
    const loginInfo = wx.getStorageSync(LOGIN_STORAGE_KEY)
    if (loginInfo && loginInfo.openid) {
      const userInfo = loginInfo.userInfo || {}
      this.setData({
        loading: false,
        isLoggedIn: true,
        openid: loginInfo.openid,
        avatarUrl: userInfo.avatarUrl || '',
        nickname: userInfo.nickname || '',
        role: userInfo.role || 'user',
        merchantId: userInfo.merchantId || '',
        storeIds: userInfo.storeIds || [],
        notifyEnabled: userInfo.notifyEnabled !== false,
        isActive: userInfo.isActive !== false
      })
      // 管理员修改角色后，重新从服务端刷新权限，避免一直使用旧缓存。
      this.refreshLoginProfile()
    } else {
      console.log('[mine] 本地无登录态，开始微信登录')
      this.doLogin()
    }
  },

  refreshLoginProfile() {
    wx.cloud.callFunction({ name: 'login', data: {} }).then((res) => {
      const result = res.result || {}
      if (result.success) this.handleLoginSuccess(result)
    }).catch((err) => {
      console.warn('[mine] 刷新用户权限失败', err)
    })
  },

  doLogin() {
    if (!wx.cloud) {
      console.error('wx.cloud 未初始化，请检查 app.js')
      this.handleLoginFail('云开发未初始化，请检查 app.js')
      return
    }

    this.setData({ loading: true })
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          this.handleLoginFail('登录失败，请重试')
          return
        }
        wx.cloud.callFunction({
          name: 'login',
          data: { code: loginRes.code }
        }).then((res) => {
          const result = res.result || {}
          if (result.success) this.handleLoginSuccess(result)
          else this.handleLoginFail(result.message || '登录失败')
        }).catch((err) => {
          console.error('调用 login 云函数失败', err)
          this.handleLoginFail('登录失败：请确认已部署 login 云函数')
        })
      },
      fail: (err) => {
        console.error('wx.login 调用失败', err)
        this.handleLoginFail('微信登录失败，请重试')
      }
    })
  },

  handleLoginSuccess(result) {
    const userInfo = result.userInfo || {}
    const loginInfo = {
      openid: result.openid,
      userInfo: {
        avatarUrl: userInfo.avatarUrl || '',
        nickname: userInfo.nickname || '',
        role: userInfo.role || 'user',
        merchantId: userInfo.merchantId || '',
        storeIds: userInfo.storeIds || [],
        notifyEnabled: userInfo.notifyEnabled !== false,
        isActive: userInfo.isActive !== false
      }
    }

    wx.setStorageSync(LOGIN_STORAGE_KEY, loginInfo)
    getApp().globalData.openid = result.openid
    getApp().globalData.userInfo = loginInfo.userInfo
    this.setData({
      loading: false,
      isLoggedIn: true,
      openid: result.openid,
      avatarUrl: loginInfo.userInfo.avatarUrl,
      nickname: loginInfo.userInfo.nickname,
      role: loginInfo.userInfo.role,
      merchantId: loginInfo.userInfo.merchantId,
      storeIds: loginInfo.userInfo.storeIds,
      notifyEnabled: loginInfo.userInfo.notifyEnabled,
      isActive: loginInfo.userInfo.isActive
    })
  },

  handleLoginFail(message) {
    this.setData({ loading: false, isLoggedIn: false })
    wx.showToast({ title: message || '登录失败，请重试', icon: 'none' })
  },

  onChooseAvatar(e) {
    const filePath = e.detail.avatarUrl
    if (!filePath) return
    wx.showLoading({ title: '上传头像...' })
    wx.cloud.uploadFile({
      cloudPath: 'avatars/' + (this.data.openid || Date.now()) + '-' + Date.now() + '.jpg',
      filePath
    }).then((result) => {
      this.setData({ avatarUrl: result.fileID })
      this.saveProfile()
    }).catch((err) => {
      console.error('头像上传失败', err)
      wx.showToast({ title: '头像上传失败', icon: 'none' })
    }).finally(() => wx.hideLoading())
  },

  onSaveUserInfo() {
    this.saveProfile()
  },

  saveProfile() {
    const { openid, avatarUrl, nickname, role, merchantId, storeIds, notifyEnabled, isActive } = this.data
    if (!openid) return
    const userInfo = { avatarUrl, nickname, role, merchantId, storeIds, notifyEnabled, isActive }
    wx.setStorageSync(LOGIN_STORAGE_KEY, { openid, userInfo })
    getApp().globalData.userInfo = userInfo

    wx.cloud.callFunction({ name: 'login', data: { userInfo } }).then((res) => {
      const result = res.result || {}
      if (result.success) wx.showToast({ title: '已保存', icon: 'success' })
      else wx.showToast({ title: result.message || '保存失败', icon: 'none' })
    }).catch((err) => {
      console.error('保存资料失败', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    })
  },

  goToAddress() {
    wx.navigateTo({ url: '/pages/address/address' })
  },
  goToAdmin() {
    if (this.data.role !== 'admin' || this.data.isActive === false) {
      wx.showToast({ title: '当前账号不是管理员', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/admin/index' })
  },

  goToMerchant() {
    if (!(this.data.role === 'merchant' || this.data.role === 'admin') || this.data.isActive === false) {
      wx.showToast({ title: '当前账号不是商户', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/merchant/index' })
  },

  goToOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  }
})
