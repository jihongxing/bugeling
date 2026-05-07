const activityStatus = require('./activityStatus')

const ACTIVE_PARTICIPATION_STATUSES = ['paid', 'approved', 'confirmed', 'checked_in', 'completed', 'verified']

function isActiveParticipationStatus(status) {
  return ACTIVE_PARTICIPATION_STATUSES.indexOf(status) !== -1
}

function countActiveParticipations(participations) {
  return (participations || []).filter(item => isActiveParticipationStatus(item && item.status)).length
}

function buildParticipationStatusUpdates(participations, nextActivityStatus) {
  const updates = []

  ;(participations || []).forEach(item => {
    if (!item || !item._id) return

    if (nextActivityStatus === 'confirmed' && item.status === 'paid') {
      updates.push({ participationId: item._id, status: 'confirmed' })
      return
    }

    if (nextActivityStatus === 'pending' && item.status === 'confirmed') {
      updates.push({ participationId: item._id, status: 'paid' })
    }
  })

  return updates
}

async function syncActivityFormation(database, collections, activity, participations) {
  const participantCount = countActiveParticipations(participations)
  const nextActivityStatus = activityStatus.getNextActivityStatus(activity, participantCount)
  const activityPatch = {}
  const currentParticipants = Number(activity.currentParticipants || activity.approvedParticipants || 0)

  if (currentParticipants !== participantCount) {
    activityPatch.currentParticipants = participantCount
    activityPatch.approvedParticipants = participantCount
  }

  if (activity.status !== nextActivityStatus) {
    activityPatch.status = nextActivityStatus
  }

  const participationUpdates = buildParticipationStatusUpdates(participations, nextActivityStatus)

  if (Object.keys(activityPatch).length > 0) {
    await database.collection(collections.ACTIVITIES)
      .doc(activity._id)
      .update({ data: activityPatch })
  }

  for (const update of participationUpdates) {
    await database.collection(collections.PARTICIPATIONS)
      .doc(update.participationId)
      .update({
        data: {
          status: update.status
        }
      })
  }

  return {
    participantCount,
    activityStatus: nextActivityStatus,
    activityPatch,
    participationUpdates
  }
}

module.exports = {
  ACTIVE_PARTICIPATION_STATUSES,
  isActiveParticipationStatus,
  countActiveParticipations,
  buildParticipationStatusUpdates,
  syncActivityFormation
}
