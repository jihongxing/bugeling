// components/activity-card/activity-card.js - 活动卡片组件
var activityFeedAdapter = require('./activity-feed-adapter')

Component({
  properties: {
    activity: {
      type: Object,
      value: null
    }
  },

  data: {
    card: null
  },

  observers: {
    'activity': function(activity) {
      if (!activity) return
      var normalizedActivity = activity.feedCard ? activity : activityFeedAdapter.normalizeActivity(activity)
      this.setData({ card: normalizedActivity.feedCard })
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
