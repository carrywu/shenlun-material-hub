# User Role And Invitation Design

## Account Rules

- Users register with a manually entered alphanumeric account.
- Account must contain only digits and/or English letters and be unique.
- Nickname is required, trimmed, and limited to 1-30 characters.
- Password length is 6-18 characters and may contain digits, letters, and symbols.
- Login uses account plus password.
- UI displays nickname first; legacy users without nickname display their account.

## Roles

| Feature | USER | VERIFIED_USER | ADMIN |
|---|---:|---:|---:|
| Browse articles | Yes | Yes | Yes |
| View generated cards | Yes | Yes | Yes |
| AI assessment/generation | No | Yes | Yes |
| WeWeRSS / IMA advanced sync | No | Yes | Yes |
| Admin console | No | No | Yes |

## Invitation Flow

- Registering without an invitation creates a `USER`.
- Registering with a valid invitation creates a `VERIFIED_USER`.
- A `USER` can upgrade in account settings with an invitation code.
- Invitation validation covers missing, disabled, expired, exhausted, repeated use, and transactional used-count increment.

## Database Compatibility

The public account is `User.username`; internal relations keep using `User.id`. Existing users and content relations are not rewritten.
