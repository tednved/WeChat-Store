Page({
  data: {
    categories: [],
    cartItems: [],
    cartMap: {},
    cartCount: 0,
    totalPrice: 0,
    totalPriceStr: '0.00',
    showCartPopup: false, // 购物车弹窗开关
    activeCategoryIndex: 0,
    toView: '',
    categoryTops: [],
    store: null
  },

  onLoad() {},

  // 从确认页支付成功返回点单页时，清空购物车
  onShow() {
    if (wx.getStorageSync('orderSubmitted')) {
      wx.removeStorageSync('orderSubmitted');
      this.onClearCart();
    }
    this.fetchGoodsData()
  },

  // 获取云端商品数据
  fetchGoodsData() {
    wx.showLoading({ title: '加载菜单...' });
    this.cleanupExpiredOrders()
    wx.cloud.callFunction({ name: 'catalog', data: {} }).then(res => {
      const result = res.result || {}
      if (!result.success) throw new Error(result.message || '菜单加载失败')
      const categories = result.categories || []
      this.setData({ categories, store: result.store || null });
    }).catch((err) => {
      console.error('菜单加载失败', err)
      wx.showToast({ title: err.message || '菜单加载失败', icon: 'none' })
    }).finally(() => wx.hideLoading());
  },

  cleanupExpiredOrders() {
    const key = 'lastExpiredOrderCleanupAt'
    const last = Number(wx.getStorageSync(key)) || 0
    if (Date.now() - last < 60000) return Promise.resolve()
    wx.setStorageSync(key, Date.now())
    return wx.cloud.callFunction({ name: 'cancelExpiredOrders', data: { action: 'cleanup' } })
      .catch((err) => console.error('过期订单清理失败', err))
  },

  // 统一更新购物车数据源
  updateCart(cartItems) {
    let cartCount = 0;
    let totalPrice = 0;
    let cartMap = {};

    cartItems.forEach(item => {
      cartCount += item.count;
      totalPrice += item.price * item.count;
      cartMap[item.id] = item.count;
    });

    this.setData({
      cartItems,
      cartMap,
      cartCount,
      totalPrice,
      totalPriceStr: totalPrice.toFixed(2)
    });
  },

  // 增加商品 (列表与购物车通用)
  onAddTap(e) {
    const gid = e.currentTarget.dataset.gid;
    const good = this.findGoodById(gid);
    if (!good) return;
    if ((this.data.cartMap[gid] || 0) >= Number(good.stock || 0)) return wx.showToast({ title: '库存不足', icon: 'none' });

    let cartItems = [...this.data.cartItems];
    const idx = cartItems.findIndex(item => item.id === gid);

    if (idx >= 0) {
      cartItems[idx].count += 1;
    } else {
      cartItems.push({
        id: good.id,
        name: good.name,
        price: good.price,
        count: 1
      });
    }
    this.updateCart(cartItems);
  },

  // 减少商品 (列表与购物车通用)
  onMinusTap(e) {
    const gid = e.currentTarget.dataset.gid;
    let cartItems = [...this.data.cartItems];
    const idx = cartItems.findIndex(item => item.id === gid);

    if (idx === -1) return;

    if (cartItems[idx].count > 1) {
      cartItems[idx].count -= 1;
    } else {
      cartItems.splice(idx, 1);
      // 如果购物车空了，自动关闭弹窗
      if (cartItems.length === 0) this.setData({ showCartPopup: false });
    }
    this.updateCart(cartItems);
  },

  findGoodById(gid) {
    for (let cat of this.data.categories) {
      const g = cat.goods.find(item => item.id === gid);
      if (g) return g;
    }
    return null;
  },

  // 弹窗控制逻辑
  onCartIconTap() {
    if (this.data.cartCount > 0) {
      this.setData({ showCartPopup: !this.data.showCartPopup });
    }
  },

  onCartMaskTap() {
    this.setData({ showCartPopup: false });
  },

  onClearCart() {
    this.updateCart([]);
    this.setData({ showCartPopup: false });
  },

  // 去结算：进入订单确认页展示订单内容
  onSubmitTap() {
    if (this.data.cartCount <= 0) return;

    wx.setStorageSync('confirmOrder', {
      items: this.data.cartItems,
      store: this.data.store,
      totalPrice: this.data.totalPrice,
      totalPriceStr: this.data.totalPriceStr
    });
    wx.navigateTo({ url: '/pages/confirm/confirm' });
  },

  // 分类联动逻辑保留
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ activeCategoryIndex: index, toView: 'cat-' + this.data.categories[index].id });
  }
});
