/**
 * Who actually receives a notification.
 *
 * Pure, so it can be tested without a database. The rules are small but they
 * were being re-implemented — slightly differently — at every call site, which
 * is how one of them ended up notifying people about their own actions.
 */

export interface NotificationDraft {
  message: string;
  link: string;
  senderId: string;
}

/**
 * Narrows a set of candidate recipients down to the people who should be told.
 *
 * Two rules, both of which were previously inline `if` statements that some
 * call sites had and others did not:
 *
 *  - **Never notify the actor.** Being told about your own action is noise, and
 *    it trains people to ignore the bell.
 *  - **Deduplicate.** A user can be both an assignee and a division approver.
 *    Without this they get the same sentence twice.
 */
export function resolveRecipients(
  candidateIds: Iterable<string>,
  actorId: string,
): string[] {
  const unique = new Set<string>();
  for (const id of candidateIds) {
    if (id && id !== actorId) unique.add(id);
  }
  return [...unique];
}

/**
 * Expands one draft into the rows `createMany` expects.
 *
 * Returns an empty array when there is nobody to tell, which the caller can use
 * to skip the write entirely rather than issuing an insert of zero rows.
 */
export function buildNotificationRows(
  draft: NotificationDraft,
  candidateIds: Iterable<string>,
): Array<{ message: string; link: string; recipientId: string; senderId: string }> {
  return resolveRecipients(candidateIds, draft.senderId).map((recipientId) => ({
    message: draft.message,
    link: draft.link,
    recipientId,
    senderId: draft.senderId,
  }));
}
