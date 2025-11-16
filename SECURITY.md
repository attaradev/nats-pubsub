# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of NatsPubsub seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Email us directly** at mpyebattara@gmail.com with:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fixes (if available)

2. **Allow time for a fix**: We will acknowledge your email within 48 hours and will send a more detailed response within 7 days indicating the next steps.

3. **Provide your contact information** so we can coordinate the disclosure with you.

## Security Update Process

1. **Acknowledgment**: We acknowledge receipt of your vulnerability report
2. **Assessment**: We assess the vulnerability and its impact
3. **Fix Development**: We develop and test a fix
4. **Release**: We release a security patch
5. **Disclosure**: We coordinate disclosure with you (if desired)

## Security Best Practices

When using NatsPubsub in production:

### General

- Keep your NatsPubsub version up to date
- Use TLS/SSL for NATS connections in production
- Use authentication for NATS server access
- Validate and sanitize all event payloads
- Use environment variables for sensitive configuration

### Ruby Specific

- Keep Ruby and gem dependencies updated
- Use strong authentication for database connections (Inbox/Outbox)
- Enable database encryption at rest
- Use Rails encrypted credentials for sensitive data
- Implement proper access controls for the Web UI

### JavaScript Specific

- Keep Node.js and npm dependencies updated
- Run `npm audit` regularly and address vulnerabilities
- Avoid logging sensitive data
- Implement proper error handling to avoid information leakage

### NATS Server Configuration

```bash
# Use TLS
nats-server --tls --tlscert=/path/to/server-cert.pem --tlskey=/path/to/server-key.pem

# Use authentication
nats-server --user nats --pass <strong-password>

# Use JWT authentication (recommended for production)
nats-server --jwt /path/to/jwt.conf
```

### Network Security

- Use firewall rules to restrict NATS server access
- Use VPC/private networks in cloud environments
- Implement network segmentation
- Monitor and log NATS server access

### Event Payload Security

- Never include passwords or sensitive credentials in event payloads
- Use encryption for sensitive data in payloads
- Implement payload size limits to prevent DoS
- Validate payload schemas to prevent injection attacks

## Known Security Considerations

### Inbox/Outbox Pattern

- Database credentials must be properly secured
- Ensure proper database access controls
- Use database encryption for sensitive event data

### Dead Letter Queue (DLQ)

- Monitor DLQ for potential security issues
- Implement proper access controls for DLQ messages
- Regularly review and process DLQ messages

### Middleware

- Custom middleware has access to all event data
- Review and audit third-party middleware carefully
- Implement proper error handling in middleware

## Security Updates

We will announce security updates through:

- GitHub Security Advisories
- Release notes
- CHANGELOG.md

Subscribe to repository notifications to stay informed.

## Credits

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities (unless they prefer to remain anonymous).

## Questions?

If you have questions about security that are not sensitive in nature, feel free to open a GitHub issue or discussion.

For security concerns, always use email: mpyebattara@gmail.com
