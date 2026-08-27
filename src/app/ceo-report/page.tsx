import { redirect } from 'next/navigation';

/**
 * Retired: the portfolio report and the drill-down are one screen now.
 *
 * The two pages shared a permission, overlapped on four figures and linked to
 * each other, so "the report" meant different things to different people — and
 * only one of them had filters, which meant the summary and the drill-down
 * could not be reconciled once anybody narrowed the view.
 *
 * Kept as a redirect rather than deleted so existing bookmarks still land on
 * the report. The route's permission is still enforced by its layout on the
 * way through.
 */
export default function CeoReportRedirect() {
  redirect('/reports');
}
