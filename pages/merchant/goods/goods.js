Page({
  data: { goods: [], currentTab: 'all', loading: true, busyId: '', refreshing: false },

  onShow() { this.fetchGoods() },
  onPullDownRefresh() { this.fetchGoods().finally(() => wx.stopPullDownRefresh()) },
  onScrollRefresh() { this.setData({ refreshing: true }); this.fetchGoods().finally(() => this.setData({ refreshing: false })) },

  fetchGoods() {
    this.setData({ loading: true })
    return wx.cloud.callFunction({ name: 'merchantGoods', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '商品加载失败')
      this.setData({ goods: result.goods || [], loading: false })
    }).catch((err) => {
      console.error('商品加载失败', err)
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '商品加载失败', icon: 'none' })
    })
  },

  selectTab(e) { this.setData({ currentTab: e.currentTarget.dataset.tab }) },
  addGoods() { wx.navigateTo({ url: '/pages/merchant/goods-edit/goods-edit' }) },
  editGoods(e) { wx.navigateTo({ url: '/pages/merchant/goods-edit/goods-edit?id=' + encodeURIComponent(e.currentTarget.dataset.id) }) },

  toggleStatus(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.goods.find((goods) => goods.id === id)
    if (!item || this.data.busyId) return
    const nextStatus = item.status === 'off_sale' ? 'on_sale' : 'off_sale'
    wx.showModal({
      title: '操作确认',
      content: nextStatus === 'on_sale' ? '确定上架这个商品吗？' : '确定下架这个商品吗？',
      success: (modal) => {
        if (!modal.confirm) return
        this.setData({ busyId: id })
        wx.cloud.callFunction({ name: 'merchantGoods', data: { action: 'toggleStatus', goodsId: id, status: nextStatus } }).then((res) => {
          const result = res.result || {}
          if (!result.success) throw new Error(result.message || '操作失败')
          wx.showToast({ title: nextStatus === 'on_sale' ? '已上架' : '已下架', icon: 'success' })
          return this.fetchGoods()
        }).catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' })).finally(() => this.setData({ busyId: '' }))
      }
    })
  },

  deleteGoods(e) {
    const id = e.currentTarget.dataset.id
    if (!id || this.data.busyId) return
    wx.showModal({ title: '删除商品', content: '删除后不能恢复，确定继续吗？', success: (modal) => {
      if (!modal.confirm) return
      this.setData({ busyId: id })
      wx.cloud.callFunction({ name: 'merchantGoods', data: { action: 'delete', goodsId: id } }).then((res) => {
        const result = res.result || {}
        if (!result.success) throw new Error(result.message || '删除失败')
        wx.showToast({ title: '已删除', icon: 'success' })
        return this.fetchGoods()
      }).catch((err) => wx.showToast({ title: err.message || '删除失败', icon: 'none' })).finally(() => this.setData({ busyId: '' }))
    } })
  }
})
