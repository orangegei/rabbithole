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
      wx.navigateBack({
        delta: 1,
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

  async loadUserProfile() {
    const userId = this.userId
    const cachedProfile = this.readCachedProfile(userId)

    if (cachedProfile) {
      this.applyProfile(cachedProfile)
    }

    try {
      const response = await wx.cloud.callFunction({
        name: 'userProfiles',
        data: { action: 'get' },
      })
      const result = response && response.result ? response.result : {}
      const remoteProfile = result.profile

      if (this.userId !== userId) {
        return
      }

      if (remoteProfile && normalizeNickname(remoteProfile.nickname) && remoteProfile.avatarFileId) {
        const profile = {
          nickname: normalizeNickname(remoteProfile.nickname),
          avatarPath: remoteProfile.avatarFileId,
          updatedAt: remoteProfile.updatedAt,
        }
        this.cacheProfile(userId, profile)
        this.applyProfile(profile)
        return
      }

      if (cachedProfile && cachedProfile.avatarPath !== DEFAULT_PROFILE.avatarPath) {
        this.syncLegacyProfile(cachedProfile)
        return
      }
    } catch (error) {
      console.error('[user-profile] 读取云端资料失败', error)
    }

    if (!cachedProfile) {
      this.applyDefaultProfile()
    }
  },

  readCachedProfile(userId) {
    try {
      const savedProfile = wx.getStorageSync(`userProfile:${userId}`)
      const nickname = normalizeNickname(savedProfile && savedProfile.nickname)
      const avatarPath = savedProfile && savedProfile.avatarPath
      return nickname && avatarPath ? { nickname, avatarPath, updatedAt: savedProfile.updatedAt } : null
    } catch (error) {
      return null
    }
  },

  cacheProfile(userId, profile) {
    try {
      wx.setStorageSync(`userProfile:${userId}`, profile)
    } catch (error) {
      // 缓存失败不能影响云端资料的真实保存结果。
    }
  },

  async syncLegacyProfile(profile) {
    try {
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `user-profiles/${this.userId}/${Date.now()}.png`,
        filePath: profile.avatarPath,
      })
      await wx.cloud.callFunction({
        name: 'userProfiles',
        data: {
          action: 'save',
          nickname: profile.nickname,
          avatarFileId: uploadResult.fileID,
        },
      })
      if (this.isPageActive) {
        this.applyProfile({
          nickname: profile.nickname,
          avatarPath: uploadResult.fileID,
          updatedAt: Date.now(),
        })
      }
    } catch (error) {
      console.error('[user-profile] 同步本地资料失败', error)
    }
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

  async completeProfile() {
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

    this.setData({
      isSavingProfile: true,
    })

    try {
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `user-profiles/${this.userId}/${Date.now()}.png`,
        filePath: tempAvatarPath,
      })
      const response = await wx.cloud.callFunction({
        name: 'userProfiles',
        data: {
          action: 'save',
          nickname,
          avatarFileId: uploadResult.fileID,
        },
      })
      const result = response && response.result ? response.result : {}
      const profile = {
        nickname: normalizeNickname(result.profile && result.profile.nickname) || nickname,
        avatarPath: (result.profile && result.profile.avatarFileId) || uploadResult.fileID,
        updatedAt: Date.now(),
      }
      this.cacheProfile(this.userId, profile)
      this.applyProfile(profile)
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      console.error('[user-profile] 保存云端资料失败', error)
      this.setData({
        isSavingProfile: false,
      })
      wx.showToast({
        title: '资料保存失败，请稍后重试',
        icon: 'none',
      })
    }
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
