export function shouldAttemptStampLocation(
  requireGeofence: boolean,
  nextVisitNumber: number,
  firstVerifiedVisit = 3
): boolean {
  return (
    requireGeofence &&
    nextVisitNumber >= Math.max(Math.trunc(firstVerifiedVisit), 1)
  )
}
