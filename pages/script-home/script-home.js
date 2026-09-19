const auth = require('../../utils/auth')
Page({
  data: {
    isCityPickerVisible: false,
    selectedCity: '南京',
    visualSrc: '/assets/GPT_t1v1_nj.png',
  },

  openCityPicker() {
    this.setData({
      isCityPickerVisible: true,
    })
  },

  closeCityPicker() {
    this.setData({
      isCityPickerVisible: false,
    })
  },

  async openScriptOpening() {
    if (this.isOpeningScript) {
      return
    }
    this.isOpeningScript = true

    const session = await auth.ready()
    if (this.isPageActive === false) {
      this.isOpeningScript = false
      return
    }
    if (session.status !== 'authenticated') {
      this.promptLogin()
      return
    }

    wx.navigateTo({
      url: '/pages/script-opening/script-opening',
      fail: () => {
        this.isOpeningScript = false
        wx.showToast({ title: '页面打开失败，请重试', icon: 'none' })
      },
    })
  },

  onShow() {
    this.isPageActive = true
    this.isOpeningScript = false
  },

  onHide() {
    this.isPageActive = false
  },

  onUnload() {
    this.isPageActive = false
  },

  promptLogin() {
    wx.navigateTo({
      url: '/pages/user-profile/user-profile?intent=script',
      success: () => {
        wx.showToast({
          title: auth.getState().errorMessage || '请先登录后进入剧本',
          icon: 'none',
          duration: 2500,
        })
      },
      fail: () => {
        this.isOpeningScript = false
        wx.showToast({ title: '页面打开失败，请重试', icon: 'none' })
      },
    })
  },

  handleTabChange(event) {
    if (event.detail.tab !== 'profile') {
      return
    }

    wx.navigateTo({
      url: '/pages/user-profile/user-profile',
    })
  },

})
