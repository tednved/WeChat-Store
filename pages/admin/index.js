Page({
  data: { users: [], loadingUsers: true },

  onShow() { this.loadUsers() },

  loadUsers() {
    this.setData({ loadingUsers: true })
    return wx.cloud.callFunction({ name: 'adminUsers', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '账户加载失败')
      this.setData({ users: result.users || [], loadingUsers: false })
    }).catch((err) => {
      this.setData({ loadingUsers: false })
      wx.showToast({ title: err.message || '账户加载失败', icon: 'none' })
    })
  },

  goInvite(e) {
    const role = e.currentTarget.dataset.role === 'admin' ? 'admin' : 'merchant'
    wx.navigateTo({ url: `/pages/admin/invite/invite?role=${role}` })
  },

  goStoreManagement() { wx.navigateTo({ url: '/pages/admin/stores/stores' }) },

  goUserDetail(e) {
    const userId = e.currentTarget.dataset.id
    if (userId) wx.navigateTo({ url: '/pages/admin/user-detail/user-detail?userId=' + encodeURIComponent(userId) })
  }
})
