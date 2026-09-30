/**
 * Who owns the portfolio every project sits in.
 *
 * One owner for every project, so this is a constant rather than a column: a
 * field holding the same value on every row records nothing. It becomes a
 * column, and a choice on the project form, once there is more than one
 * portfolio a project can sit in.
 */
export const PORTFOLIO_OWNER = 'EPMO';
