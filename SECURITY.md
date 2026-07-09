# Security & Authentication

## Admin Pages Protection

The admin pages (`/admin/*` and `/admin-stats`) are now protected with session-based authentication.

### Setting Up Admin Password

To enable admin access, set the `ADMIN_PASSWORD` environment variable:

**Local Development:**
Add to `.dev.vars`:
```
ADMIN_PASSWORD=your_secure_password_here
```

**Production:**
Set via Cloudflare using wrangler:
```bash
npx wrangler secret put ADMIN_PASSWORD
# Then enter your password when prompted
```

### How Authentication Works

1. User visits `/admin/login`
2. Enters password
3. If correct, a session is created in KV store with 7-day expiry
4. Session cookie (`admin_session`) stored as HttpOnly, Secure, SameSite=Strict
5. All admin pages check for valid session before allowing access
6. Logout clears the session

### Protected Routes

- `/admin/*` - Article management (create, edit, delete)
- `/admin-stats` - Page view statistics
- `/admin/login` - Login page (public)
- `/admin/logout` - Logout endpoint (authenticated)

## Security Headers

The following security headers are applied via Cloudflare (`_headers` file):

- **X-Content-Type-Options: nosniff** - Prevents MIME type sniffing
- **X-Frame-Options: DENY** - Blocks clickjacking attacks
- **X-XSS-Protection** - Enables browser XSS filters
- **Strict-Transport-Security** - Forces HTTPS
- **Content-Security-Policy** - Restricts resource loading
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Disables unnecessary APIs

## Best Practices

1. **Use a Strong Password**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Avoid common words or patterns

2. **Keep Dependencies Updated**
   ```bash
   npm update
   npm audit
   ```

3. **Monitor Sessions**
   - Sessions expire after 7 days
   - Each login creates a new session
   - Logout clears the session immediately

4. **API Key Management**
   - Never commit `.dev.vars` to git
   - Use Cloudflare secrets for production
   - Rotate keys regularly

5. **Database Security**
   - All queries use parameterized statements (prevents SQL injection)
   - No user input directly in SQL
   - D1 encryption at rest

## What's Protected

✅ Admin pages require login
✅ Sessions stored securely in KV
✅ Cookies are HttpOnly (JavaScript can't access)
✅ HTTPS enforced (HSTS)
✅ CSP prevents XSS attacks
✅ MIME type sniffing blocked
✅ Clickjacking protection
✅ SQL injection prevention
✅ Public pages unaffected

## What's Public

✅ Homepage - fully accessible
✅ Writing articles - fully accessible
✅ Photography gallery - fully accessible
✅ About page - fully accessible
✅ Experiments page - fully accessible

## Future Enhancements

Consider these additional protections:
- IP whitelisting for admin panel
- Rate limiting on login attempts
- Two-factor authentication
- Admin action logging
- Session activity monitoring
