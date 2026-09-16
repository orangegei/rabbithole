// script-home.js
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

  openScriptOpening() {
    wx.navigateTo({
      url: '/pages/script-opening/script-opening',
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
