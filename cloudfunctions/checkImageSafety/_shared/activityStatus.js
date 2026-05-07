const JOINABLE_ACTIVITY_STATUSES = ['pending', 'confirmed']
const LOCKABLE_ACTIVITY_STATUSES = ['pending', 'confirmed']
const CONTACT_UNLOCK_PARTICIPATION_STATUSES = ['paid', 'approved', 'confirmed', 'checked_in', 'completed']
const CHECKIN_ELIGIBLE_PARTICIPATION_STATUSES = ['paid', 'approved', 'confirmed', 'checked_in', 'completed', 'verified']

function isJoinableActivityStatus(status) {
  return JOINABLE_ACTIVITY_STATUSES.includes(status)
}

function isContactUnlockParticipationStatus(status) {
  return CONTACT_UNLOCK_PARTICIPATION_STATUSES.includes(status)
}

function isLockableActivityStatus(status) {
  return LOCKABLE_ACTIVITY_STATUSES.includes(status)
}

function isCheckinEligibleParticipationStatus(status) {
  return CHECKIN_ELIGIBLE_PARTICIPATION_STATUSES.includes(status)
}

function getDisplayStatus(status) {
  if (status === 'pending') return 'recruiting'
  if (status === 'confirmed') return 'formed'
  return status
}

function getNextActivityStatus(activity, nextParticipantCount) {
  const currentStatus = activity && activity.status ? activity.status : 'pending'

  if (!isJoinableActivityStatus(currentStatus)) {
    return currentStatus
  }

  const maxParticipants = Number(activity && activity.maxParticipants ? activity.maxParticipants : 0)
  const fallbackMin = maxParticipants > 0 ? Math.min(3, maxParticipants) : 3
  const minParticipants = Number(activity && activity.minParticipants ? activity.minParticipants : fallbackMin)

  if (nextParticipantCount >= minParticipants) {
    return 'confirmed'
  }

  return 'pending'
}

module.exports = {
  JOINABLE_ACTIVITY_STATUSES,
  LOCKABLE_ACTIVITY_STATUSES,
  CONTACT_UNLOCK_PARTICIPATION_STATUSES,
  CHECKIN_ELIGIBLE_PARTICIPATION_STATUSES,
  isJoinableActivityStatus,
  isLockableActivityStatus,
  isContactUnlockParticipationStatus,
  isCheckinEligibleParticipationStatus,
  getDisplayStatus,
  getNextActivityStatus
}
