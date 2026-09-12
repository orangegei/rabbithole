// script-home.js
Page({
  data: {
    isCityPickerVisible: false,
    activeTab: 'script',
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

  selectTab(event) {
    this.setData({
      activeTab: event.currentTarget.dataset.tab,
    })
  },

})
