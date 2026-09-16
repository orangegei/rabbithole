const PROFILE_STORAGE_KEY = 'userProfile'
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
    loginHint: '点击头像授权登录',
    isEditingProfile: false,
    isSavingProfile: false,
    pendingAvatarPath: '',
    pendingNickname: '',
  },

  onLoad() {
    this.loadUserProfile()
  },

  loadUserProfile() {
    let savedProfile

    try {
      savedProfile = wx.getStorageSync(PROFILE_STORAGE_KEY)
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
        this.applyProfile({
          nickname,
          avatarPath,
          updatedAt: savedProfile.updatedAt,
        })
      },
      fail: () => {
        try {
          wx.removeStorageSync(PROFILE_STORAGE_KEY)
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
    const hasSavedProfile = profile.avatarPath !== DEFAULT_PROFILE.avatarPath

    this.setData({
      profile,
      avatarSrc: profile.avatarPath,
      displayName: profile.nickname,
      loginHint: hasSavedProfile ? '点击头像更换资料' : '点击头像授权登录',
      isEditingProfile: false,
      isSavingProfile: false,
      pendingAvatarPath: '',
      pendingNickname: '',
    })
  },

  handleChooseAvatar(event) {
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
      loginHint: '确认昵称后完成登录',
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
      loginHint: this.data.profile.avatarPath === DEFAULT_PROFILE.avatarPath ? '点击头像授权登录' : '点击头像更换资料',
    })
  },

  completeProfile() {
    if (this.data.isSavingProfile) {
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
      wx.setStorageSync(PROFILE_STORAGE_KEY, profile)
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
