import { redirect } from 'next/navigation';

/**
 * Retired: this queue is now a slice of the approvals inbox.
 *
 * Kept as a redirect rather than deleted so existing bookmarks, notification
 * links and anything else pointing here still lands somewhere useful — filtered
 * to the kind it used to show, so the reader sees what they came for.
 *
 * The route's permission is still enforced on the way through by its layout,
 * and `/approvals` re-checks per kind, so this cannot widen anyone's access.
 */
export default function PaymentApprovalsRedirect() {
  redirect('/approvals?type=payment');
}
