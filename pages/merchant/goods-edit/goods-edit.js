Page({
  data: { editing: false, goodsId: '', image: '', name: '', price: '', stock: '9999', categoryId: '', categoryName: '', description: '', status: 'on_sale', saving: false, categories: [], categoryNames: [], selectedCategoryIndex: -1, useNewCategory: false },

  onLoad(options) {
    if (options.id) this.setData({ editing: true, goodsId: decodeURIComponent(options.id) })
    this.loadGoods(options.id)
  },

  loadGoods(id) {
    wx.cloud.callFunction({ name: 'merchantGoods', data: { action: 'list' } }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '商品加载失败')
      const categories = result.categories || []
      const next = { categories, categoryNames: categories.map((item) => item.name) }
      if (id) {
        const goods = (result.goods || []).find((item) => item.id === id)
        if (!goods) throw new Error('商品不存在')
        const selectedCategoryIndex = categories.findIndex((item) => item.id === goods.categoryId)
        Object.assign(next, { goodsId: goods.id, image: goods.image || '', name: goods.name || '', price: String(goods.price == null ? '' : goods.price), stock: String(goods.stock == null ? 9999 : goods.stock), categoryId: goods.categoryId || '', categoryName: goods.categoryName || '', description: goods.description || '', status: goods.status || 'on_sale', selectedCategoryIndex, useNewCategory: selectedCategoryIndex < 0 })
      }
      this.setData(next)
    }).catch((err) => wx.showToast({ title: err.message || '商品加载失败', icon: 'none' }))
  },

  onInput(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  onCategorySelect(e) {
    const selectedCategoryIndex = Number(e.detail.value)
    const category = this.data.categories[selectedCategoryIndex]
    if (category) this.setData({ selectedCategoryIndex, categoryId: category.id, categoryName: category.name, useNewCategory: false })
  },
  useExistingCategory() { this.setData({ useNewCategory: false }) },
  useNewCategory() { this.setData({ useNewCategory: true, selectedCategoryIndex: -1, categoryId: '', categoryName: '' }) },

  chooseImage() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: (res) => {
      const filePath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传图片...' })
      wx.cloud.uploadFile({ cloudPath: 'goods/' + Date.now() + '-' + Math.floor(Math.random() * 10000) + '.jpg', filePath }).then((uploadRes) => {
        this.setData({ image: uploadRes.fileID })
      }).catch((err) => {
        console.error('商品图片上传失败', err)
        wx.showToast({ title: '图片上传失败', icon: 'none' })
      }).finally(() => wx.hideLoading())
    } })
  },

  save() {
    if (this.data.saving) return
    const { name, price, stock, categoryName, categoryId, useNewCategory } = this.data
    if (!name.trim()) return wx.showToast({ title: '请输入商品名称', icon: 'none' })
    if (price === '' || Number(price) < 0) return wx.showToast({ title: '请输入正确价格', icon: 'none' })
    if (stock === '' || Number(stock) < 0) return wx.showToast({ title: '请输入正确库存', icon: 'none' })
    if (!categoryName.trim()) return wx.showToast({ title: useNewCategory ? '请输入新分类名称' : '请选择商品分类', icon: 'none' })
    const goods = { name: name.trim(), price: Number(price), stock: Math.floor(Number(stock)), image: this.data.image, description: this.data.description.trim(), status: this.data.status, categoryId: useNewCategory ? '' : categoryId, categoryName: categoryName.trim() }
    this.setData({ saving: true })
    const data = this.data.editing ? { action: 'update', goodsId: this.data.goodsId, goods } : { action: 'create', goods }
    wx.cloud.callFunction({ name: 'merchantGoods', data }).then((res) => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '保存失败')
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 700)
    }).catch((err) => wx.showToast({ title: err.message || '保存失败', icon: 'none' })).finally(() => this.setData({ saving: false }))
  }
})
