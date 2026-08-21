export const STORAGE_MONITORING_STUDENT_ID = "P15747021";

export function canViewStorageMonitoring(studentId) {
  return String(studentId || "").trim() === STORAGE_MONITORING_STUDENT_ID;
}
