Component({
  properties: {
    activeTab: {
      type: String,
      value: 'script',
    },
  },

  methods: {
    selectTab(event) {
      this.triggerEvent('tabchange', {
        tab: event.currentTarget.dataset.tab,
      })
    },
  },
})
