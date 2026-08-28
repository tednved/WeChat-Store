Page({
  data: {
    selecting: false,
    loading: true,
    addresses: []
  },

  onLoad(options) {
    this.setData({ selecting: options.select === '1' })
  },

  onShow() { this.loadAddresses() },
  onPullDownRefresh() { this.loadAddresses().finally(() => wx.stopPullDownRefresh()) },

  loadAddresses() {
    this.setData({ loading: true })
    return wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '地址加载失败')
      const addresses = result.addresses || []
      const legacy = wx.getStorageSync('defaultAddress')
      if (addresses.length === 0 && legacy && legacy.name && legacy.phone && legacy.detail) {
        return wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'save', address: legacy, isDefault: true } }).then(() => {
          wx.removeStorageSync('defaultAddress')
          return this.loadAddresses()
        })
      }
      this.setData({ addresses, loading: false })
    }).catch((err) => {
      console.error('地址加载失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '地址加载失败', icon: 'none' })
    })
  },

  addAddress() {
    wx.navigateTo({ url: '/pages/address-edit/address-edit' })
  },

  editAddress(e) {
    wx.navigateTo({ url: '/pages/address-edit/address-edit?id=' + encodeURIComponent(e.currentTarget.dataset.id) })
  },

  makeDefault(e) {
    const id = e.currentTarget.dataset.id
    const address = this.data.addresses.find((item) => item._id === id)
    if (!address || address.isDefault) return
    wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'setDefault', addressId: id } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '默认地址设置失败')
      return this.loadAddresses()
    }).catch((err) => wx.showToast({ title: err.message || '默认地址设置失败', icon: 'none' }))
  },

  chooseForOrder(e) {
    if (!this.data.selecting) return
    const id = e.currentTarget.dataset.id
    wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'setDefault', addressId: id } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '地址选择失败')
      wx.navigateBack()
    }).catch((err) => wx.showToast({ title: err.message || '地址选择失败', icon: 'none' }))
  },

  deleteAddress(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除地址',
      content: '确定删除这个收货地址吗？',
      success: (modal) => {
        if (!modal.confirm) return
        wx.cloud.callFunction({ name: 'userAddresses', data: { action: 'delete', addressId: id } }).then((res) => {
          const result = res.result || {}
          if (!result.success) throw new Error(result.message || '地址删除失败')
          return this.loadAddresses()
        }).catch((err) => wx.showToast({ title: err.message || '地址删除失败', icon: 'none' }))
      }
    })
  }
})