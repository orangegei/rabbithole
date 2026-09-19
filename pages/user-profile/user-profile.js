const auth = require('../../utils/auth')
const DEFAULT_PROFILE = {
  nickname: '旅行者',
  avatarPath: '/assets/GPT_t2_avatar.png',
}

function normalizeNickname(nickname) {
  return typeof nickname === 'string' ? nickname.trim() : ''
}

Page({
  data: {
    profile: DEFAULT_PROFILE,
    avatarSrc: DEFAULT_PROFILE.avatarPath,
    displayName: DEFAULT_PROFILE.nickname,
    loginHint: '登录后可设置头像昵称',
    isLoggedIn: false,
    isAuthBusy: true,
    primaryActionLabel: '登录状态确认中…',
    isEditingProfile: false,
    isSavingProfile: false,
    pendingAvatarPath: '',
    pendingNickname: '',
  },

  onLoad(options = {}) {
    this.loginIntent = options.intent === 'script' ? 'script' : ''
    this.unsubscribeAuth = auth.subscribe((session) => this.applyAuthState(session))
    auth.initialize()
  },

  onUnload() {
    this.isPageActive = false
    this.userId = ''
    this.unsubscribeAuth()
  },

  onShow() {
    this.isPageActive = true
  },

  onHide() {
    this.isPageActive = false
  },

  applyAuthState(session) {
    const isLoggedIn = session.status === 'authenticated'
    const isAuthBusy = ['unknown', 'restoring', 'loggingIn'].includes(session.status)
    const labels = {
      unknown: '登录状态确认中…',
      restoring: '登录状态确认中…',
      loggingIn: '登录中…',
      authenticated: '继续游戏',
    }
    this.setData({
      isLoggedIn,
      isAuthBusy,
      primaryActionLabel: labels[session.status] || '微信登录',
    })

    if (this.userId !== session.userId) {
      this.userId = session.userId
      this.applyDefaultProfile()
      if (isLoggedIn) {
        this.loadUserProfile()
      }
    }
  },

  async handlePrimaryAction() {
    if (this.data.isAuthBusy || this.isHandlingPrimaryAction) {
      return
    }
    if (auth.getState().status === 'authenticated') {
      this.continueGame()
      return
    }

    this.isHandlingPrimaryAction = true
    const session = await auth.login()
    if (this.isPageActive === false) {
      this.isHandlingPrimaryAction = false
      return
    }
    if (session.status !== 'authenticated') {
      this.isHandlingPrimaryAction = false
      wx.showToast({ title: session.errorMessage, icon: 'none' })
      return
    }

    if (this.loginIntent === 'script') {
      wx.redirectTo({
        url: '/pages/script-opening/script-opening',
        fail: () => {
          this.isHandlingPrimaryAction = false
          wx.showToast({ title: '已登录，请从首页进入剧本', icon: 'none' })
        },
      })
      return
    }

    this.isHandlingPrimaryAction = false
    wx.showToast({ title: '登录成功', icon: 'success' })
  },

  loadUserProfile() {
    const userId = this.userId
    let savedProfile

    try {
      savedProfile = wx.getStorageSync(`userProfile:${userId}`)
    } catch (error) {
      this.applyDefaultProfile()
      return
    }

    const nickname = normalizeNickname(savedProfile && savedProfile.nickname)
    const avatarPath = savedProfile && savedProfile.avatarPath

    if (!nickname || !avatarPath) {
      this.applyDefaultProfile()
      return
    }

    wx.getFileSystemManager().access({
      path: avatarPath,
      success: () => {
        if (this.userId !== userId) {
          return
        }
        this.applyProfile({
          nickname,
          avatarPath,
          updatedAt: savedProfile.updatedAt,
        })
      },
      fail: () => {
        if (this.userId !== userId) {
          return
        }
        try {
          wx.removeStorageSync(`userProfile:${userId}`)
        } catch (error) {
          // Storage cleanup failure should not block showing the default profile.
        }

        this.applyDefaultProfile()
      },
    })
  },

  applyDefaultProfile() {
    this.applyProfile(DEFAULT_PROFILE)
  },

  applyProfile(profile) {
    this.setData({
      profile,
      avatarSrc: profile.avatarPath,
      displayName: profile.nickname,
      loginHint: this.data.isLoggedIn ? '点击头像设置资料（可选）' : '登录后可设置头像昵称',
      isEditingProfile: false,
      isSavingProfile: false,
      pendingAvatarPath: '',
      pendingNickname: '',
    })
  },

  handleChooseAvatar(event) {
    if (!this.data.isLoggedIn) {
      return
    }
    const avatarPath = event.detail && event.detail.avatarUrl

    if (!avatarPath) {
      return
    }

    this.setData({
      isEditingProfile: true,
      isSavingProfile: false,
      avatarSrc: avatarPath,
      pendingAvatarPath: avatarPath,
      pendingNickname: this.data.profile.nickname === DEFAULT_PROFILE.nickname ? '' : this.data.profile.nickname,
      loginHint: '确认昵称后保存资料',
    })
  },

  handleNicknameInput(event) {
    this.setData({
      pendingNickname: event.detail.value,
    })
  },

  cancelProfileEdit() {
    this.setData({
      isEditingProfile: false,
      isSavingProfile: false,
      avatarSrc: this.data.profile.avatarPath,
      pendingAvatarPath: '',
      pendingNickname: '',
      loginHint: '点击头像设置资料（可选）',
    })
  },

  completeProfile() {
    if (!this.data.isLoggedIn || this.data.isSavingProfile) {
      return
    }

    const nickname = normalizeNickname(this.data.pendingNickname)
    const tempAvatarPath = this.data.pendingAvatarPath

    if (!tempAvatarPath) {
      wx.showToast({
        title: '请先选择头像',
        icon: 'none',
      })
      return
    }

    if (!nickname) {
      wx.showToast({
        title: '请填写昵称',
        icon: 'none',
      })
      return
    }

    const fileSystemManager = wx.getFileSystemManager()

    this.setData({
      isSavingProfile: true,
    })

    fileSystemManager.saveFile({
      tempFilePath: tempAvatarPath,
      success: (result) => {
        this.persistProfile(nickname, result.savedFilePath)
      },
      fail: () => {
        this.setData({
          isSavingProfile: false,
        })
        wx.showToast({
          title: '头像保存失败',
          icon: 'none',
        })
      },
    })
  },

  persistProfile(nickname, avatarPath) {
    const oldAvatarPath = this.data.profile.avatarPath
    const profile = {
      nickname,
      avatarPath,
      updatedAt: Date.now(),
    }

    try {
      wx.setStorageSync(`userProfile:${this.userId}`, profile)
    } catch (error) {
      this.setData({
        isSavingProfile: false,
      })
      this.removeSavedAvatar(avatarPath)
      wx.showToast({
        title: '资料保存失败',
        icon: 'none',
      })
      return
    }

    this.applyProfile(profile)
    this.removeOldAvatar(oldAvatarPath, avatarPath)

    wx.showToast({
      title: '已保存',
      icon: 'success',
    })
  },

  removeOldAvatar(oldAvatarPath, nextAvatarPath) {
    if (!oldAvatarPath || oldAvatarPath === DEFAULT_PROFILE.avatarPath || oldAvatarPath === nextAvatarPath) {
      return
    }

    this.removeSavedAvatar(oldAvatarPath)
  },

  removeSavedAvatar(avatarPath) {
    wx.getFileSystemManager().removeSavedFile({
      filePath: avatarPath,
      fail: () => {},
    })
  },

  continueGame() {
    // TODO: 接入剧本进度后继续游戏。
  },

  resetScriptProgress() {
    // TODO: 接入剧本进度后重置游戏。
  },

  openAbout() {
    // TODO: 新增关于小程序页面后跳转。
  },

  handleTabChange(event) {
    if (event.detail.tab !== 'script') {
      return
    }

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
      })
      return
    }

    wx.reLaunch({
      url: '/pages/script-home/script-home',
    })
  },
})
