const { env } = require('../config/cloud')
const RESTORE_KEY = `cloudLogin:${env}`
const listeners = new Set()
let state = { status: 'unknown', userId: '', errorMessage: '' }
let startup
let pendingLogin
let cloudInitialized = false

function getState() {
  return { ...state }
}

function updateState(next) {
  state = next
  listeners.forEach((listener) => listener(getState()))
}

function subscribe(listener) {
  listeners.add(listener)
  listener(getState())
  return () => listeners.delete(listener)
}

function authenticate(status) {
  if (pendingLogin) {
    return pendingLogin
  }

  updateState({ status, userId: '', errorMessage: '' })
  pendingLogin = Promise.resolve().then(() => {
    if (!wx.cloud) {
      throw new Error('当前微信版本不支持云开发，请升级微信')
    }
    if (!cloudInitialized) {
      wx.cloud.init({ env })
      cloudInitialized = true
    }
    return wx.cloud.callFunction({ name: 'login' })
  }).then(({ result }) => {
    if (!result || typeof result.userId !== 'string' || !result.userId) {
      throw new Error('登录结果无效')
    }

    updateState({ status: 'authenticated', userId: result.userId, errorMessage: '' })
    try {
      wx.setStorageSync(RESTORE_KEY, true)
    } catch (error) {
      wx.showToast({ title: '已登录，下次可能需重新登录', icon: 'none' })
    }
    return getState()
  }).catch((error) => {
    console.error('[auth] 云登录失败', {
      env,
      functionName: 'login',
      errCode: error && error.errCode,
      errMsg: error && (error.errMsg || error.message),
    })
    const errorMessage = wx.cloud ? '登录暂不可用，请稍后重试' : '请升级微信后重试登录'
    updateState({ status: 'error', userId: '', errorMessage })
    return getState()
  }).finally(() => {
    pendingLogin = null
  })
  return pendingLogin
}

function initialize() {
  if (startup) {
    return startup
  }

  if (wx.cloud && !cloudInitialized) {
    try {
      wx.cloud.init({ env })
      cloudInitialized = true
    } catch (error) {
      console.error('[auth] 云环境初始化失败', {
        env,
        errCode: error && error.errCode,
        errMsg: error && (error.errMsg || error.message),
      })
      updateState({ status: 'error', userId: '', errorMessage: '登录服务暂不可用，请重试' })
      startup = Promise.resolve(getState())
      return startup
    }
  }

  let shouldRestore = false
  try {
    shouldRestore = wx.getStorageSync(RESTORE_KEY) === true
  } catch (error) {
    // A local hint is optional; only a cloud response can establish identity.
  }

  if (shouldRestore) {
    startup = authenticate('restoring')
  } else {
    updateState({ status: 'guest', userId: '', errorMessage: '' })
    startup = Promise.resolve(getState())
  }
  return startup
}

async function ready() {
  await initialize()
  if (pendingLogin) {
    await pendingLogin
  }
  return getState()
}

async function login() {
  await initialize()
  if (state.status === 'authenticated') {
    return getState()
  }
  return authenticate('loggingIn')
}

module.exports = { initialize, ready, login, getState, subscribe }
