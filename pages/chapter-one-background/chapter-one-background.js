Page({
  goBack() {
    const pages = getCurrentPages()
    const previousPage = pages[pages.length - 2]

    if (previousPage && previousPage.route === 'pages/suspect-list/suspect-list') {
      wx.navigateBack({
        delta: 1,
      })
      return
    }

    wx.redirectTo({
      url: '/pages/suspect-list/suspect-list',
    })
  },

  startInvestigation() {
    wx.showToast({
      title: '调查即将开始',
      icon: 'none',
    })
  },
})
