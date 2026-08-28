const GENDER_OPTIONS = ['先生', '女士']

Page({
  data: {
    addressId: '',
    name: '',
    gender: '先生',
    phone: '',
    detail: '',
    genderOptions: GENDER_OPTIONS,
    saving: false
  },

  onLoad(options) {
    const addressId = options.id ? decodeURIComponent(options.id) : ''
    this.setData({ addressId })
    if (addressId) this.loadAddress(addressId)
  },

  loadAddress(addressId) {
    wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '地址加载失败')
      const address = (result.addresses || []).find((item) => item._id === addressId)
      if (!address) throw new Error('地址不存在')
      this.setData({ name: address.name || '', gender: address.gender || '先生', phone: address.phone || '', detail: address.detail || '' })
    }).catch((err) => wx.showToast({ title: err.message || '地址加载失败', icon: 'none' }))
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  onGenderChange(e) {
    this.setData({ gender: GENDER_OPTIONS[Number(e.currentTarget.dataset.index)] })
  },

  save() {
    const name = this.data.name.trim()
    const phone = this.data.phone.trim()
    const detail = this.data.detail.trim()
    if (!name) return wx.showToast({ title: '请输入收货人姓名', icon: 'none' })
    if (name.length > 10) return wx.showToast({ title: '收货人姓名不要超过10个字', icon: 'none' })
    if (phone.replace(/[\s\-+]/g, '').length < 5) return wx.showToast({ title: '请输入联系电话', icon: 'none' })
    if (!detail) return wx.showToast({ title: '请输入收货地址', icon: 'none' })

    this.setData({ saving: true })
    wx.cloud.callFunction({
      name: 'userAddresses',
      data: {
        action: 'save',
        addressId: this.data.addressId,
        address: { name, gender: this.data.gender, phone, detail }
      }
    }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '地址保存失败')
      wx.showToast({ title: '地址已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    }).catch((err) => wx.showToast({ title: err.message || '地址保存失败', icon: 'none' })).finally(() => this.setData({ saving: false }))
  }
})