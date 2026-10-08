const auth = require('../../utils/auth')

const SCRIPT_ID = 'sunquan'
const PAGE_SIZE = 20
const DEFAULT_AVATAR = '/assets/GPT_t2_avatar.png'
const COMMENT_MAX_LENGTH = 200

function toTimestamp(value) {
  if (value instanceof Date || (value && typeof value.getTime === 'function')) {
    return value.getTime()
  }
  if (value && typeof value.$date === 'number') {
    return value.$date
  }
  if (typeof value === 'number') {
    return value
  }
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? Date.now() : timestamp
}

function formatCommentTime(value) {
  const timestamp = toTimestamp(value)
  const elapsed = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(elapsed / 60000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`

  const date = new Date(timestamp)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getCloudResult(response) {
  return response && response.result ? response.result : {}
}

Page({
  data: {
    hasComments: false,
    hasLoaded: false,
    showEmptyState: false,
    comments: [],
    isInitialLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true,
    loadError: '',
    isComposerVisible: false,
    isComposerFocused: false,
    draftContent: '',
    draftLength: 0,
    canSubmitDraft: false,
    keyboardHeight: 0,
    maxCommentLength: COMMENT_MAX_LENGTH,
  },

  onLoad() {
    this.isPageActive = true
    this.nextCursor = null
    this.session = null
    this.handleKeyboardHeightChange = ({ height = 0 }) => {
      if (!this.isPageActive || !this.data.isComposerVisible) return
      this.setData({ keyboardHeight: Math.max(0, height) })
    }
    if (wx.onKeyboardHeightChange) {
      wx.onKeyboardHeightChange(this.handleKeyboardHeightChange)
    }
  },

  async onShow() {
    this.isPageActive = true
    const session = await auth.ready()
    if (!this.isPageActive) return

    if (session.status !== 'authenticated') {
      wx.redirectTo({ url: '/pages/user-profile/user-profile?intent=script' })
      return
    }

    this.session = session
    if (!this.data.hasLoaded && !this.data.isInitialLoading) {
      this.loadComments({ reset: true })
    }
  },

  onHide() {
    this.isPageActive = false
    if (this.data.isComposerVisible) {
      this.setData({
        isComposerFocused: false,
        keyboardHeight: 0,
      })
    }
  },

  onUnload() {
    this.isPageActive = false
    if (wx.offKeyboardHeightChange && this.handleKeyboardHeightChange) {
      wx.offKeyboardHeightChange(this.handleKeyboardHeightChange)
    }
  },

  onPullDownRefresh() {
    this.setData({ isRefreshing: true })
    Promise.resolve(this.loadComments({ reset: true })).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  goBack() {
    const pages = getCurrentPages()
    const previousPage = pages[pages.length - 2]
    if (previousPage && previousPage.route === 'pages/script-opening/script-opening') {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.redirectTo({ url: '/pages/script-opening/script-opening' })
  },

  async ensureAuthenticated() {
    const session = await auth.ready()
    if (session.status === 'authenticated') {
      this.session = session
      return true
    }
    wx.showToast({ title: '登录状态已失效，请重新登录', icon: 'none' })
    wx.redirectTo({ url: '/pages/user-profile/user-profile?intent=script' })
    return false
  },

  callComments(action, data = {}) {
    return wx.cloud.callFunction({
      name: 'scriptComments',
      data: { action, scriptId: SCRIPT_ID, ...data },
    }).then(getCloudResult)
  },

  normalizeComment(item) {
    return {
      ...item,
      avatarSrc: item.avatarUrl || item.avatarFileId || item.avatarPath || DEFAULT_AVATAR,
      nickname: item.nickname || '旅行者',
      relativeTime: formatCommentTime(item.createdAt),
      isOwner: item.isOwner === true || item.authorId === (this.session && this.session.userId),
      isExpanded: false,
      canExpand: false,
    }
  },

  async loadComments({ reset = false } = {}) {
    if (this.data.isInitialLoading || this.data.isLoadingMore || (!reset && !this.data.hasMore)) return
    if (!await this.ensureAuthenticated()) return

    const loadingKey = reset ? 'isInitialLoading' : 'isLoadingMore'
    this.setData({ [loadingKey]: true, loadError: '' })

    try {
      const result = await this.callComments('list', {
        cursor: reset ? null : this.nextCursor,
        pageSize: PAGE_SIZE,
      })
      const incoming = Array.isArray(result.items) ? result.items.map((item) => this.normalizeComment(item)) : []
      const comments = reset ? incoming : this.mergeComments(this.data.comments, incoming)
      this.nextCursor = result.nextCursor || null
      this.setData({
        comments,
        hasComments: comments.length > 0,
        hasLoaded: true,
        showEmptyState: comments.length === 0,
        hasMore: typeof result.hasMore === 'boolean' ? result.hasMore : incoming.length >= PAGE_SIZE,
      }, () => this.measureExpandableComments())
    } catch (error) {
      console.error('[script-comments] 加载评论失败', error)
      this.setData({
        hasLoaded: true,
        loadError: reset ? '评论加载失败，点击重试' : '加载失败，点击重试',
      })
    } finally {
      if (this.isPageActive) {
        this.setData({ [loadingKey]: false, isRefreshing: false })
      }
    }
  },

  measureExpandableComments() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery()
      query.selectAll('.script-comment-measure').fields({ size: true, dataset: true }, (items) => {
        if (!Array.isArray(items) || !items.length) return
        const expandableIds = new Set(items.filter((item) => item.height > 154).map((item) => item.dataset.id))
        const comments = this.data.comments.map((item) => ({
          ...item,
          canExpand: expandableIds.has(item._id),
        }))
        this.setData({ comments })
      }).exec()
    })
  },

  mergeComments(existing, incoming) {
    const seen = new Set()
    return existing.concat(incoming).filter((item) => {
      if (!item._id) return true
      if (seen.has(item._id)) return false
      seen.add(item._id)
      return true
    })
  },

  handleRefresh() {
    if (this.data.isInitialLoading) return
    this.setData({ isRefreshing: true })
    this.loadComments({ reset: true })
  },

  handleLoadMore() {
    this.loadComments()
  },

  retryLoad() {
    this.loadComments({ reset: this.data.comments.length === 0 })
  },

  handleWriteComment() {
    if (this.data.isComposerVisible) return
    this.setData({
      isComposerVisible: true,
      isComposerFocused: false,
      keyboardHeight: 0,
    }, () => {
      wx.nextTick(() => {
        if (this.data.isComposerVisible) {
          this.setData({ isComposerFocused: true })
        }
      })
    })
  },

  closeCommentComposer() {
    this.setData({
      isComposerVisible: false,
      isComposerFocused: false,
      keyboardHeight: 0,
    })
    if (wx.hideKeyboard) {
      wx.hideKeyboard({})
    }
  },

  handleCommentInput(event) {
    const draftContent = String(event.detail.value || '').slice(0, COMMENT_MAX_LENGTH)
    this.setData({
      draftContent,
      draftLength: draftContent.length,
      canSubmitDraft: draftContent.trim().length > 0,
    })
  },

  handleCommentSubmit() {
    if (!this.data.canSubmitDraft) return
    wx.showToast({
      title: '评论发布功能暂未接入',
      icon: 'none',
    })
  },

  toggleComment(event) {
    const commentId = event.currentTarget.dataset.id
    const comments = this.data.comments.map((item) => item._id === commentId ? {
      ...item,
      isExpanded: !item.isExpanded,
    } : item)
    this.setData({ comments })
  },

  deleteComment(event) {
    const commentId = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除评论',
      content: '删除后不可恢复，确认删除这条评论吗？',
      confirmColor: '#8b3c27',
      success: async ({ confirm }) => {
        if (!confirm || !await this.ensureAuthenticated()) return
        try {
          await this.callComments('delete', { commentId })
          const comments = this.data.comments.filter((item) => item._id !== commentId)
          this.setData({
            comments,
            hasComments: comments.length > 0,
            showEmptyState: comments.length === 0,
          })
          wx.showToast({ title: '评论已删除', icon: 'success' })
        } catch (error) {
          console.error('[script-comments] 删除评论失败', error)
          wx.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
        }
      },
    })
  },
})
