// The /team/accept/:token link in team invitation emails now opens the full join flow.
// (The old accept page wrote to team_invitations directly from the browser, which is no longer allowed.)
export { default } from './TeamJoinPage';
