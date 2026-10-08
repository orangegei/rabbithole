const crypto = require('crypto')
const cloud = require('wx-server-sdk')

const EXPECTED_APPID = 'wxc332ca1c908a232c'
const USER_PROFILES_COLLECTION = 'userProfiles'
const DEFAULT_NICKNAME = '旅行者'
const DEFAULT_AVATAR_FILE_ID = ''

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

function createUserId(appId, openId) {
  return crypto
    .createHash('sha256')
    .update(`${appId}:${openId}`)
    .digest('hex')
}

function getVerifiedContext(cloudApi) {
  const wxContext = cloudApi.getWXContext()
  const openId = wxContext && wxContext.OPENID
  const appId = wxContext && wxContext.APPID

  if (!openId || !appId) {
    throw new Error('INVALID_WECHAT_CONTEXT')
  }

  if (appId !== EXPECTED_APPID) {
    throw new Error('APPID_MISMATCH')
  }

  return {
    appId,
    openId,
    userId: createUserId(appId, openId),
  }
}

function isNotFoundError(error) {
  const message = error && error.message ? error.message : ''
  return /not exist|not found|document.get:fail/i.test(message)
}

function normalizeNickname(nickname) {
  const value = typeof nickname === 'string' ? nickname.trim() : ''
  return value.slice(0, 24)
}

function normalizeAvatarFileId(avatarFileId) {
  const value = typeof avatarFileId === 'string' ? avatarFileId.trim() : ''
  if (!value) {
    return ''
  }
  if (!/^cloud:\/\//.test(value)) {
    throw new Error('INVALID_AVATAR_FILE_ID')
  }
  return value
}

function toPublicProfile(profile, userId) {
  return {
    userId,
    nickname: profile && profile.nickname ? profile.nickname : DEFAULT_NICKNAME,
    avatarFileId: profile && profile.avatarFileId ? profile.avatarFileId : DEFAULT_AVATAR_FILE_ID,
    updatedAt: profile && profile.updatedAt ? profile.updatedAt : null,
  }
}

async function readProfile(db, userId) {
  try {
    const result = await db.collection(USER_PROFILES_COLLECTION).doc(userId).get()
    return result && result.data ? result.data : null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function getProfile(cloudApi) {
  const { userId } = getVerifiedContext(cloudApi)
  const db = cloudApi.database()
  const profile = await readProfile(db, userId)

  return {
    profile: toPublicProfile(profile, userId),
  }
}

async function saveProfile(cloudApi, event) {
  const { userId } = getVerifiedContext(cloudApi)
  const db = cloudApi.database()
  const nickname = normalizeNickname(event.nickname || (event.profile && event.profile.nickname))
  const avatarFileId = normalizeAvatarFileId(event.avatarFileId || (event.profile && event.profile.avatarFileId))

  if (!nickname) {
    throw new Error('INVALID_NICKNAME')
  }

  const data = {
    userId,
    nickname,
    avatarFileId,
    updatedAt: db.serverDate(),
  }

  await db.collection(USER_PROFILES_COLLECTION).doc(userId).set({
    data,
  })

  return {
    profile: {
      ...data,
      updatedAt: null,
    },
  }
}

exports.main = async (event = {}) => {
  const action = event.action || 'get'

  if (action === 'get') {
    return getProfile(cloud)
  }

  if (action === 'save') {
    return saveProfile(cloud, event)
  }

  throw new Error('UNKNOWN_ACTION')
}
