// pages/user/calendar/calendar.js
const { callFunction } = require('../../../utils/api')
const { formatDeposit, formatMeetTime } = require('../../../utils/format')
const { getMonthDays, getFirstDayOfWeek, isToday, formatDateKey } = require('../../../utils/date')

Page({
  data: {
    year: 0,
    month: 0,
    days: {},                // 日期 → 活动列表映射
    summary: null,           // 月度统计
    calendarGrid: [],        // 日历网格数据
    selectedDate: '',        // 当前选中日期 YYYY-MM-DD
    selectedActivities: [],  // 选中日期的活动列表
    todayActivities: [],     // 今日任务列表
    loading: true
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    })
    this.loadCalendarData()
  },

  // 加载日历数据
  async loadCalendarData() {
    this.setData({ loading: true })
    try {
      const res = await callFunction('getCalendarActivities', {
        year: this.data.year,
        month: this.data.month
      })
      const { days, summary } = res.data
      this.setData({ days, summary, loading: false })
      this.buildCalendarGrid()
      this.loadTodayActivities()
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 构建日历网格
  buildCalendarGrid() {
    const { year, month, days } = this.data
    const totalDays = getMonthDays(year, month)
    const firstDay = getFirstDayOfWeek(year, month)

    const grid = []
    // 填充前置空白
    for (let i = 0; i < firstDay; i++) {
      grid.push({ day: 0, dateKey: '', dots: [], isToday: false })
    }
    // 填充日期
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = formatDateKey(year, month, d)
      const activities = days[dateKey] || []
      const dots = activities.map(a => a.status)
      grid.push({
        day: d,
        dateKey,
        dots,
        isToday: isToday(year, month, d)
      })
    }
    this.setData({ calendarGrid: grid })
  },

  // 加载今日任务
  loadTodayActivities() {
    const now = new Date()
    const todayKey = formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
    const todayActivities = (this.data.days[todayKey] || [])
      .filter(a => a.status === 'upcoming')
    this.setData({ todayActivities })
  },

  // 切换月份
  onSwipeLeft() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month, selectedDate: '', selectedActivities: [] })
    this.loadCalendarData()
  },

  onSwipeRight() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month, selectedDate: '', selectedActivities: [] })
    this.loadCalendarData()
  },

  // 点击日期
  onDateTap(e) {
    const { dateKey } = e.currentTarget.dataset
    const activities = this.data.days[dateKey] || []
    this.setData({ selectedDate: dateKey, selectedActivities: activities })
  },

  // 复制微信号
  onCopyWechat(e) {
    const { wechatId } = e.currentTarget.dataset
    wx.setClipboardData({ data: wechatId })
  },

  // 跳转海报页
  goToPoster() {
    wx.navigateTo({
      url: `/pages/user/poster/poster?year=${this.data.year}&month=${this.data.month}`
    })
  }
})
