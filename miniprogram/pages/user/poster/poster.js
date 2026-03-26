// pages/user/poster/poster.js
const { callFunction } = require('../../../utils/api')

Page({
  data: {
    year: 0,
    month: 0,
    posterData: null,
    canvasReady: false,
    saving: false
  },

  onLoad(options) {
    const now = new Date()
    this.setData({
      year: Number(options.year) || now.getFullYear(),
      month: Number(options.month) || now.getMonth() + 1
    })
    this.loadPosterData()
  },

  async loadPosterData() {
    try {
      const res = await callFunction('getPosterData', {
        year: this.data.year,
        month: this.data.month
      })
      this.setData({ posterData: res.data })
      this.drawPoster()
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // Canvas 2D 绘制海报
  drawPoster() {
    const query = wx.createSelectorQuery()
    query.select('#posterCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        ctx.scale(dpr, dpr)

        this._canvas = canvas
        this._ctx = ctx

        const { posterData, year, month } = this.data
        const width = res[0].width
        const height = res[0].height

        // 1. 背景
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, width, height)

        // 2. 标题
        ctx.fillStyle = '#1A1A2E'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${year}年${month}月 守约月报`, width / 2, 40)

        // 3. 日历缩略图（简化版网格 + 颜色点）
        this.drawCalendarThumbnail(ctx, posterData.calendarDots, width, year, month)

        // 4. 统计文案
        ctx.fillStyle = '#1A1A2E'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(posterData.slogan, width / 2, 260)

        // 5. 契约分
        ctx.font = 'bold 24px sans-serif'
        ctx.fillStyle = '#FF6B35'
        ctx.fillText(`契约分：${posterData.creditScore}`, width / 2, 300)

        // 6. 击败百分比
        ctx.font = '14px sans-serif'
        ctx.fillStyle = '#6B7280'
        ctx.fillText(`击败了 ${posterData.beatPercent}% 的人`, width / 2, 330)

        // 7. 品牌标识
        ctx.font = 'bold 16px sans-serif'
        ctx.fillStyle = '#FF6B35'
        ctx.fillText('── 不鸽令 ──', width / 2, 370)
        ctx.font = '12px sans-serif'
        ctx.fillStyle = '#9CA3AF'
        ctx.fillText('这就是我的契约精神。', width / 2, 395)

        this.setData({ canvasReady: true })
      })
  },

  // 绘制日历缩略图
  drawCalendarThumbnail(ctx, calendarDots, canvasWidth, year, month) {
    const colorMap = {
      green: '#10B981',
      yellow: '#F59E0B',
      red: '#EF4444',
      grey: '#9CA3AF'
    }
    const gridLeft = 30
    const gridTop = 70
    const cellSize = (canvasWidth - 60) / 7
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDay = new Date(year, month - 1, 1).getDay()

    for (let d = 1; d <= daysInMonth; d++) {
      const idx = firstDay + d - 1
      const col = idx % 7
      const row = Math.floor(idx / 7)
      const cx = gridLeft + col * cellSize + cellSize / 2
      const cy = gridTop + row * cellSize + cellSize / 2

      // 日期数字
      ctx.fillStyle = '#1A1A2E'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(d), cx, cy)

      // 颜色点
      const dotColor = calendarDots[String(d)]
      if (dotColor && colorMap[dotColor]) {
        ctx.beginPath()
        ctx.arc(cx, cy + 8, 3, 0, 2 * Math.PI)
        ctx.fillStyle = colorMap[dotColor]
        ctx.fill()
      }
    }
  },

  // 保存图片到相册
  async savePoster() {
    if (!this._canvas) return
    this.setData({ saving: true })
    try {
      const tempFilePath = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({
          canvas: this._canvas,
          success: res => resolve(res.tempFilePath),
          fail: reject
        })
      })
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: resolve,
          fail: reject
        })
      })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要相册权限才能保存图片，请前往设置页开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          }
        })
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    }
    this.setData({ saving: false })
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: `${this.data.posterData?.slogan || '我的守约月报'}`,
      path: `/pages/user/poster/poster?year=${this.data.year}&month=${this.data.month}`
    }
  }
})
