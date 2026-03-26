// components/activity-card/activity-card.js - 活动卡片组件
var formatUtil = require('../../utils/format')

Component({
  properties: {
    activity: {
      type: Object,
      value: null
    }
  },

  data: {
    formattedDistance: '',
    formattedTime: ''
  },

  observers: {
    'activity': function(activity) {
      if (!activity) return
      this.setData({
        formattedDistance: formatUtil.formatDistance(activity.distance || 0),
        formattedTime: formatUtil.formatMeetTime(activity.meetTime || '')
      })
    }
  },

  methods: {
    onCardTap: function() {
      if (this.data.activity) {
        this.triggerEvent('tap', { activityId: this.data.activity.activityId })
      }
    }
  }
})
