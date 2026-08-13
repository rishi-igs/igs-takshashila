// Shared constant — kept out of lib/actions/admin.ts because a "use server"
// file may only export async functions; plain constants aren't allowed.
export const CERTIFICATE_PASS_SCORE = 15; // minimum score out of 25 to qualify (inclusive)
