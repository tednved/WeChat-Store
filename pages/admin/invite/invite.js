Page({
  data: { token: '', invite: null, role: 'merchant', loading: false, accepted: false },
  onLoad(options) {
    this.setData({ role: options.role === 'admin' ? 'admin' : 'merchant' })
    if (options.token) {
      this.setData({ token: decodeURIComponent(options.token) })
      this.ensureLogin().then(() => this.loadInvite()).catch((e) => wx.showToast({ title: e.message || '请先登录', icon: 'none' }))
    }
  },
  ensureLogin() { return wx.cloud.callFunction({ name: 'login' }).then((res) => { const result = res.result || {}; if (!result.success) throw Error(result.message || '登录失败'); return result }) },
  loadInvite() { this.setData({ loading: true }); return wx.cloud.callFunction({ name: 'roleInvites', data: { action: 'get', token: this.data.token } }).then((res) => { const result = res.result || {}; if (!result.success) throw Error(result.message); this.setData({ invite: result.invite, loading: false }) }).catch((e) => { this.setData({ loading: false }); wx.showToast({ title: e.message || '邀请加载失败', icon: 'none' }) }) },
  choose(e) { this.setData({ role: e.currentTarget.dataset.role }) },
  create() { this.setData({ loading: true }); this.ensureLogin().then(() => wx.cloud.callFunction({ name: 'roleInvites', data: { action: 'create', role: this.data.role } })).then((res) => { const result = res.result || {}; if (!result.success) throw Error(result.message); this.setData({ token: result.token, invite: { role: result.role, status: 'pending', creatorName: '你', expireAt: new Date(result.expireAt) }, loading: false }) }).catch((e) => { this.setData({ loading: false }); wx.showToast({ title: e.message || '生成失败', icon: 'none' }) }) },
  accept() { if (this.data.loading) return; this.setData({ loading: true }); this.ensureLogin().then(() => wx.cloud.callFunction({ name: 'roleInvites', data: { action: 'accept', token: this.data.token } })).then((res) => { const result = res.result || {}; if (!result.success) throw Error(result.message); wx.removeStorageSync('loginInfo'); this.setData({ accepted: true, loading: false }); wx.showToast({ title: '权限已开通', icon: 'success' }) }).catch((e) => { this.setData({ loading: false }); wx.showToast({ title: e.message || '领取失败', icon: 'none' }) }) },
  goMine() { wx.switchTab({ url: '/pages/mine/mine' }) },
  onShareAppMessage() { return { title: this.data.invite && this.data.invite.role === 'admin' ? '邀请你成为管理员' : '邀请你成为商户', path: '/pages/admin/invite/invite?token=' + encodeURIComponent(this.data.token) } }
})
