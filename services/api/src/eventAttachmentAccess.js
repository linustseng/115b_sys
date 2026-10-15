// Same membership contract as createEvent/updateEvent; drafts need not be saved first.
export function canManageEventAttachments(memberships = []) {
  return memberships.some(item => {
    const group = String(item.groupId || item.group_id || '').trim();
    const role = String(item.roleInGroup || item.role_in_group || '').trim();
    return group === 'C' || (['A', 'E'].includes(group) && ['lead', 'deputy'].includes(role));
  });
}
export function isLegacyEventDocumentMime(mime) {
  return ['image/webp', 'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'].includes(mime);
}
