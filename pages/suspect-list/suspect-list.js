Page({
  data: {
    suspects: [
      {
        name: '孙权·产品创意总监',
        status: '未调查·便签疑云',
        completedStatus: '已调查·便签疑云',
        locked: false,
        completed: false,
        statusAsset: '/assets/GPT_t1v5_status_without_lock.png',
      },
      {
        name: '曹雪芹·首席文案官',
        status: '未调查·废稿之谜',
        completedStatus: '已调查·废稿之谜',
        locked: true,
        completed: false,
        statusAsset: '/assets/GPT_t1v5_status_with_lock_1.png',
      },
      {
        name: '郑和·出海业务总经理',
        status: '未调查·金箱入茶',
        completedStatus: '已调查·金箱入茶',
        locked: true,
        completed: false,
        statusAsset: '/assets/GPT_t1v5_status_with_lock_1.png',
      },
      {
        name: '李白·新媒体运营主管',
        status: '未调查·流量之局',
        completedStatus: '已调查·流量之局',
        locked: true,
        completed: false,
        statusAsset: '/assets/GPT_t1v5_status_with_lock_1.png',
      },
    ],
    // 占位流程只在本页更新；接入真实章节后替换状态纸条的触发入口。
    allCompleted: false,
  },

  onTapStatus(event) {
    const { index } = event.currentTarget.dataset
    const suspect = this.data.suspects[index]

    if (!suspect) {
      return
    }

    if (suspect.locked) {
      this.showHint('请先完成上一章节')
      return
    }

    if (suspect.completed) {
      this.showHint('该章节已完成')
      return
    }

    this.completeSuspect(index)
  },

  goBack() {
    const pages = getCurrentPages()
    const previousPage = pages[pages.length - 2]

    if (previousPage && previousPage.route === 'pages/script-opening/script-opening') {
      wx.navigateBack({
        delta: 1,
      })
      return
    }

    wx.redirectTo({
      url: '/pages/script-opening/script-opening',
    })
  },

  completeSuspect(index) {
    const suspects = this.data.suspects.map((item, itemIndex) => {
      if (itemIndex === index) {
        return {
          ...item,
          completed: true,
          status: item.completedStatus,
        }
      }

      if (itemIndex === index + 1) {
        return {
          ...item,
          locked: false,
          statusAsset: '/assets/GPT_t1v5_status_without_lock.png',
        }
      }

      return item
    })
    const allCompleted = suspects.every((item) => item.completed)

    this.setData({
      suspects,
      allCompleted,
    })

    this.showHint(allCompleted ? '全部章节已解锁' : '下一章节已解锁')
  },

  showHint(title) {
    wx.showToast({
      title,
      icon: 'none',
    })
  },

  onTapFinalReasoning() {
    // 预留最终推理入口；本轮暂不接入最终推理页。
  },
})
