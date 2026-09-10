Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: 'handleVisibilityChange',
    },
  },

  data: {
    isClosing: false,
    shouldRender: false,
  },

  methods: {
    handleVisibilityChange(visible) {
      if (visible) {
        this.setData({
          shouldRender: true,
          isClosing: false,
        })
        return
      }

      if (!this.data.shouldRender) {
        return
      }

      this.setData({ isClosing: true })
      setTimeout(() => {
        if (!this.properties.visible) {
          this.setData({
            shouldRender: false,
            isClosing: false,
          })
        }
      }, 260)
    },

    close() {
      this.triggerEvent('close')
    },

    preventTapThrough() {},
  },
})
