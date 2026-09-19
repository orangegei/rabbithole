const crypto = require('crypto')
const cloud = require('wx-server-sdk')

const EXPECTED_APPID = 'wxc332ca1c908a232c'
const USERS_COLLECTION = 'users'

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
})

function createUserId(appId, openId) {
  return crypto
    .createHash('sha256')
    .update(`${appId}:${openId}`)
    .digest('hex')
}

function isNotFoundError(error) {
  const message = error && error.message ? error.message : ''
  return /not exist|not found|document.get:fail/i.test(message)
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

  return { appId, openId }
}

async function readUser(transaction, userId) {
  try {
    const result = await transaction.collection(USERS_COLLECTION).doc(userId).get()
    return result && result.data ? result.data : null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function loginWithCloud(cloudApi) {
  const { appId, openId } = getVerifiedContext(cloudApi)
  const userId = createUserId(appId, openId)
  const db = cloudApi.database()

  await db.runTransaction(async (transaction) => {
    const userRef = transaction.collection(USERS_COLLECTION).doc(userId)
    const existingUser = await readUser(transaction, userId)
    const now = db.serverDate()

    if (existingUser) {
      await userRef.update({
        data: {
          lastLoginAt: now,
        },
      })
      return
    }

    await userRef.set({
      data: {
        userId,
        appId,
        openId,
        createdAt: now,
        lastLoginAt: now,
      },
    })
  })

  return { userId }
}

exports.main = async () => loginWithCloud(cloud)
