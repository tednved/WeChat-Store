Page({
  data: {
    // 分类 & 商品（你可以替换成自己的）
    categories: [
      {
        id: 'c1',
        name: '本店优惠',
        goods: [
          {
            id: 'g1',
            name: '统一冰红茶 500ml',
            desc: '这一口会很爽 · 月售108',
            price: 4.5,
            originPrice: 5.0,
            image: '/assets/goods/ice_tea.jpg'
          },
          {
            id: 'g2',
            name: '魔法土豆脆·巴西烤肉味',
            desc: '月售120 · 边看剧边嗑',
            price: 1.0,
            originPrice: 1.2,
            image: '/assets/goods/potato_magic.jpg'
          }
        ]
      },
      {
        id: 'c2',
        name: '热销零食',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      },
      {
        id: 'c3',
        name: '测试1',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      },
      {
        id: 'c4',
        name: '测试2',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      },
      {
        id: 'c5',
        name: '测试3',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c6',
        name: '测试4',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c7',
        name: '测试5',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c8',
        name: '测试6',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c9',
        name: '测试7',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c10',
        name: '测试8',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c11',
        name: '测试9',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      ,
      {
        id: 'c12',
        name: '测试10',
        goods: [
          {
            id: 'g3',
            name: '良品铺子 卤鸭脖 100g',
            desc: '卤香入味 · 宿舍追剧搭子',
            price: 6.9,
            originPrice: 7.5,
            image: '/assets/goods/duck_neck.jpg'
          },
          {
            id: 'g4',
            name: '香辣鸭锁骨 120g',
            desc: '骨肉紧实 · 香辣带劲',
            price: 7.5,
            originPrice: 8.0,
            image: '/assets/goods/duck_bone.jpg'
          }
        ]
      }      
      // ... 你可以继续补更多分类
    ],

    activeCategoryIndex: 0,
    toView: '',
    categoryTops: [],

    // 购物车相关
    cartItems: [],       // [{id, name, price, count}]
    cartCount: 0,
    totalPrice: 0,
    totalPriceStr: '0.00',
    showCartPopup: false
  },

  // 等页面渲染完毕后计算右侧每个分类块的顶部位置
  onReady() {
    this.calcCategoryTops();
  },

  calcCategoryTops() {
    const query = this.createSelectorQuery();
    query.selectAll('.goods-category-block').boundingClientRect();
    query.select('.goods-scroll').boundingClientRect();
    query.exec(res => {
      if (!res || !res[0] || !res[1]) return;
      const rects = res[0];
      const scrollRect = res[1];
      const tops = rects.map(r => r.top - scrollRect.top);
      this.setData({ categoryTops: tops });
    });
  },

  // 左侧点击分类
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    const category = this.data.categories[index];
    this.setData({
      activeCategoryIndex: index,
      toView: 'cat-' + category.id
    });
  },

  // 右侧滚动时更新左侧高亮
  onGoodsScroll(e) {
    const scrollTop = e.detail.scrollTop;
    const tops = this.data.categoryTops;
    if (!tops || tops.length === 0) return;

    let currentIndex = 0;
    for (let i = 0; i < tops.length; i++) {
      const thisTop = tops[i];
      const nextTop = tops[i + 1] !== undefined ? tops[i + 1] : Infinity;
      if (scrollTop >= thisTop && scrollTop < nextTop) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex !== this.data.activeCategoryIndex) {
      this.setData({ activeCategoryIndex: currentIndex });
    }
  },

  /* ========= 购物车相关 ========= */

  // 根据 id 在所有分类中找到商品
  findGoodById(gid) {
    const { categories } = this.data;
    for (let i = 0; i < categories.length; i++) {
      const goods = categories[i].goods || [];
      for (let j = 0; j < goods.length; j++) {
        if (goods[j].id === gid) {
          return goods[j];
        }
      }
    }
    return null;
  }

  ,

  // 点击商品列表里的 "+"
  onAddTap(e) {
    const gid = e.currentTarget.dataset.gid;
    this.addToCart(gid);
  },

  // 把指定商品加入购物车（或数量+1）
  addToCart(gid) {
    const good = this.findGoodById(gid);
    if (!good) return;

    const cartItems = this.data.cartItems.slice();
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

  // 统一更新购物车数量和总价
  updateCart(cartItems) {
    let cartCount = 0;
    let totalPrice = 0;
    cartItems.forEach(item => {
      cartCount += item.count;
      totalPrice += item.price * item.count;
    });

    this.setData({
      cartItems,
      cartCount,
      totalPrice,
      totalPriceStr: totalPrice.toFixed(2)
    });
  },

  // 底部条：点击购物车图标
  onCartIconTap() {
    if (this.data.cartCount <= 0) {
      wx.showToast({
        title: '购物车是空的哦',
        icon: 'none'
      });
      return;
    }
    this.setData({ showCartPopup: true });
  },

  // 点击遮罩，关闭弹窗
  onCartMaskTap() {
    this.setData({ showCartPopup: false });
  },

  // 阻止点击弹窗内容时冒泡到遮罩
  onCartPopupTap() {},

  // 弹窗内 "+": 和 addToCart 共用逻辑
  onCartPlus(e) {
    const gid = e.currentTarget.dataset.gid;
    this.addToCart(gid);
  },

  // 弹窗内 "-": 减少数量/删除项目
  onCartMinus(e) {
    const gid = e.currentTarget.dataset.gid;
    const cartItems = this.data.cartItems.slice();
    const idx = cartItems.findIndex(item => item.id === gid);
    if (idx === -1) return;

    cartItems[idx].count -= 1;
    if (cartItems[idx].count <= 0) {
      cartItems.splice(idx, 1);
    }

    this.updateCart(cartItems);
  },

  // 清空购物车
  onClearCart() {
    this.updateCart([]);
  },

  // 去结算（暂不实现：给个提示即可）
  onSubmitTap() {
    wx.showToast({
      title: '结算页面暂未实现',
      icon: 'none'
    });
  }
});
