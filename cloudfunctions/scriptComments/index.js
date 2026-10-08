const crypto = require('crypto')
const cloud = require('wx-server-sdk')

const EXPECTED_APPID = 'wxc332ca1c908a232c'
const SCRIPT_ID = 'sunquan'
const COMMENTS_COLLECTION = 'scriptComments'
const PROFILES_COLLECTION = 'userProfiles'
const MODERATION_LOGS_COLLECTION = 'commentModerationLogs'
const DEFAULT_NICKNAME = '旅行者'
const DEFAULT_AVATAR_FILE_ID = ''
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 20

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

function ensureScriptId(scriptId) {
  if (scriptId !== SCRIPT_ID) {
    throw new Error('INVALID_SCRIPT_ID')
  }
}

function isNotFoundError(error) {
  const message = error && error.message ? error.message : ''
  return /not exist|not found|document.get:fail/i.test(message)
}

function parseDate(value) {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object' && value.$date) {
    return parseDate(value.$date)
  }
  return null
}

function compareByCreatedAtDesc(left, right) {
  const leftTime = parseDate(left.createdAt)
  const rightTime = parseDate(right.createdAt)
  const leftValue = leftTime ? leftTime.getTime() : 0
  const rightValue = rightTime ? rightTime.getTime() : 0

  if (leftValue !== rightValue) {
    return rightValue - leftValue
  }

  return String(right._id || '').localeCompare(String(left._id || ''))
}

function encodeCursor(comment) {
  if (!comment) {
    return ''
  }
  const createdAt = parseDate(comment.createdAt)
  return Buffer.from(JSON.stringify({
    createdAt: createdAt ? createdAt.toISOString() : null,
    id: comment._id,
  })).toString('base64')
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
    const createdAt = parseDate(parsed.createdAt)
    if (!createdAt || !parsed.id) {
      return null
    }
    return {
      createdAt,
      id: String(parsed.id),
    }
  } catch (error) {
    return null
  }
}

function isBeforeCursor(comment, cursor) {
  if (!cursor) {
    return true
  }
  const createdAt = parseDate(comment.createdAt)
  const commentTime = createdAt ? createdAt.getTime() : 0
  const cursorTime = cursor.createdAt.getTime()

  if (commentTime < cursorTime) {
    return true
  }
  if (commentTime > cursorTime) {
    return false
  }
  return String(comment._id || '') < cursor.id
}

function toPublicProfile(profile, userId) {
  return {
    userId,
    nickname: profile && profile.nickname ? profile.nickname : DEFAULT_NICKNAME,
    avatarFileId: profile && profile.avatarFileId ? profile.avatarFileId : DEFAULT_AVATAR_FILE_ID,
  }
}

function toPublicComment(comment, profile, currentUserId) {
  return {
    _id: comment._id,
    scriptId: comment.scriptId,
    authorId: comment.authorId,
    content: comment.content,
    createdAt: comment.createdAt,
    nickname: profile.nickname,
    avatarFileId: profile.avatarFileId,
    isOwner: comment.authorId === currentUserId,
  }
}

async function readDoc(collection, id) {
  try {
    const result = await collection.doc(id).get()
    return result && result.data ? result.data : null
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }
    throw error
  }
}

async function readProfiles(db, authorIds) {
  const profileMap = new Map()

  await Promise.all(authorIds.map(async (authorId) => {
    const profile = await readDoc(db.collection(PROFILES_COLLECTION), authorId)
    profileMap.set(authorId, toPublicProfile(profile, authorId))
  }))

  return profileMap
}

async function listComments(cloudApi, event, context) {
  ensureScriptId(event.scriptId)

  const db = cloudApi.database()
  const _ = db.command
  const pageSize = Math.max(1, Math.min(Number(event.pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE))
  const cursor = decodeCursor(event.cursor)
  const queryLimit = pageSize + 1
  const baseWhere = {
    scriptId: SCRIPT_ID,
    deletedAt: _.eq(null),
    moderationStatus: 'approved',
  }
  const where = cursor
    ? _.and([
      baseWhere,
      _.or([
        { createdAt: _.lt(cursor.createdAt) },
        { createdAt: cursor.createdAt, _id: _.lt(cursor.id) },
      ]),
    ])
    : baseWhere

  const result = await db.collection(COMMENTS_COLLECTION)
    .where(where)
    .orderBy('createdAt', 'desc')
    .orderBy('_id', 'desc')
    .limit(queryLimit)
    .get()

  const sorted = (result.data || [])
    .sort(compareByCreatedAtDesc)
  const items = sorted.slice(0, pageSize)
  const hasMore = sorted.length > pageSize
  const authorIds = Array.from(new Set(items.map((item) => item.authorId).filter(Boolean)))
  const profiles = await readProfiles(db, authorIds)

  return {
    items: items.map((item) => toPublicComment(
      item,
      profiles.get(item.authorId) || toPublicProfile(null, item.authorId),
      context.userId,
    )),
    nextCursor: hasMore ? encodeCursor(items[items.length - 1]) : '',
    hasMore,
  }
}

async function deleteComment(cloudApi, event, context) {
  const commentId = typeof event.commentId === 'string' ? event.commentId : ''
  if (!commentId) {
    throw new Error('INVALID_COMMENT_ID')
  }

  const db = cloudApi.database()
  const collection = db.collection(COMMENTS_COLLECTION)
  const comment = await readDoc(collection, commentId)

  if (!comment || comment.scriptId !== SCRIPT_ID) {
    throw new Error('COMMENT_NOT_FOUND')
  }

  if (comment.authorId !== context.userId) {
    throw new Error('FORBIDDEN')
  }

  await collection.doc(commentId).update({
    data: {
      deletedAt: db.serverDate(),
    },
  })

  return {
    success: true,
    commentId,
  }
}

function getModeratorIds() {
  return String(process.env.COMMENT_MODERATOR_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function ensureModerator(context) {
  if (!getModeratorIds().includes(context.userId)) {
    throw new Error('FORBIDDEN')
  }
}

async function moderateComment(cloudApi, event, context) {
  ensureModerator(context)

  const commentId = typeof event.commentId === 'string' ? event.commentId : ''
  const decision = event.decision === 'approve' ? 'approved' : event.decision === 'reject' ? 'rejected' : ''
  const reason = typeof event.reason === 'string' ? event.reason.trim().slice(0, 120) : ''

  if (!commentId || !decision) {
    throw new Error('INVALID_MODERATION_REQUEST')
  }

  const db = cloudApi.database()
  const comments = db.collection(COMMENTS_COLLECTION)
  const comment = await readDoc(comments, commentId)

  if (!comment || comment.scriptId !== SCRIPT_ID) {
    throw new Error('COMMENT_NOT_FOUND')
  }

  await comments.doc(commentId).update({
    data: {
      moderationStatus: decision,
      moderatedAt: db.serverDate(),
      moderationSource: 'manual',
      moderationReason: reason || 'MANUAL_REVIEW',
    },
  })

  await db.collection(MODERATION_LOGS_COLLECTION).add({
    data: {
      commentId,
      moderatorId: context.userId,
      action: decision,
      fromStatus: comment.moderationStatus || '',
      toStatus: decision,
      reason,
      moderationRequestId: comment.moderationRequestId || '',
      createdAt: db.serverDate(),
    },
  })

  return {
    commentId,
    status: decision,
  }
}

exports.main = async (event = {}) => {
  const context = getVerifiedContext(cloud)
  const action = event.action || 'list'

  if (action === 'list') {
    return listComments(cloud, event, context)
  }

  if (action === 'delete') {
    return deleteComment(cloud, event, context)
  }

  if (action === 'moderate') {
    return moderateComment(cloud, event, context)
  }

  throw new Error('UNKNOWN_ACTION')
}
