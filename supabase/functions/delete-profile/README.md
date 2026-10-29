# Delete Profile Edge Function

Deploy this protected function before enabling live profile deletion:

```bash
supabase functions deploy delete-profile
```

The function verifies the signed-in user from their JWT, removes Storage items
owned by that user, then uses the server-only `SUPABASE_SERVICE_ROLE_KEY` to
delete the auth user. Database rows are removed through the existing cascade
relationships. Never place the service-role key in the web app or `.env` file.

The profile confirmation first sends `{ "action": "check" }`. This verifies
authentication and server configuration without deleting anything. The delete
button remains disabled if the probe fails. Keep JWT verification enabled.

Before production use, verify all applied journal migrations retain their
`ON DELETE CASCADE` links, then test with a disposable user and two accounts:
own nested/paginated Storage uploads must disappear, while another user's
uploads and journal rows must remain. Only the verified JWT user's ID is used.
Do not test actual deletion with a real user's journal.

Storage cleanup and Auth deletion are not one transaction. If a later step
fails, the function returns an error and some owned uploads may already be
removed. Confirm the cascade behavior and backups before deployment.
