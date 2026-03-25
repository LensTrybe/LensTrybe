export const userIdentifierKeys = ['user_id', 'creative_id', 'owner_id', 'profile_id']

export function filterRowsForUser(rows, userId) {
  if (!Array.isArray(rows) || !userId) {
    return []
  }

  const hasUserIdentifier = rows.some((row) =>
    userIdentifierKeys.some((key) => Object.prototype.hasOwnProperty.call(row ?? {}, key)),
  )

  if (!hasUserIdentifier) {
    return rows
  }

  return rows.filter((row) => userIdentifierKeys.some((key) => row?.[key] === userId))
}

export function findUserRow(rows, userId) {
  return filterRowsForUser(rows, userId)[0] ?? null
}
