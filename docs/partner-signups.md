# Partner sign-ups: creating Autinerary members' accounts on your service

Autinerary is a planning app for neurodivergent people and the people who
support them. Its plans recommend services like yours, and its **Sign me up**
button can create a person's account on your service in one click. This page
is for your developers: how to accept those sign-ups directly, so that nobody
has to fill in your form.

## What happens

1. A person presses **Sign me up** for your service in Autinerary. They were
   first shown your terms and privacy policy, and agreed.
2. Autinerary sends one signed HTTPS request to an address you give us, with
   their first name, last name and email address. Nothing else: no password, no
   health or plan information.
3. You create the account, or find that it already exists, and answer at once.
4. Autinerary tells the person how it went, for example "Signed up for <your
   service>" or "Check your email to finish".

You set the password-free way in: send your usual welcome or verification
email, or give a login link in your answer.

## The request

```
POST <your endpoint>
Content-Type: application/json
X-Autinerary-Request-Id: 3f0c…              (a UUID, the same as requestId)
X-Autinerary-Signature: t=1792900000,v1=5b1e…

{
  "version": 1,
  "requestId": "3f0c…",
  "service": "<your service's key in Autinerary>",
  "person": { "firstName": "Sam", "lastName": "Lee", "email": "sam@example.com" },
  "consentedAt": "2026-10-25T14:02:11.000Z",
  "sentAt": "2026-10-25T14:05:40.000Z"
}
```

- `consentedAt` is when the person agreed in Autinerary to have sign-up forms
  filled in for them.
- The email address is the one on the person's Autinerary account.

## Check the signature

We share a secret with you; keep it on your server only.

The header is `t=<unix seconds>,v1=<hex>`, where `<hex>` is
`HMAC-SHA256(secret, "<t>.<raw request body>")`.

Check each request as follows:

1. Recompute the HMAC over the raw body exactly as received (before parsing
   it), and compare it with `v1` in constant time.
2. Reject the request if `t` is more than 5 minutes from your clock, to stop
   replays.
3. Treat a `requestId` you have already handled as the same request: answer
   with what you answered the first time.

In Node:

```js
import { createHmac, timingSafeEqual } from 'crypto'
function verify(secret, rawBody, header) {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header || '')
  if (!m || Math.abs(Date.now() / 1000 - Number(m[1])) > 300) return false
  const want = createHmac('sha256', secret).update(`${m[1]}.${rawBody}`).digest()
  const got = Buffer.from(m[2], 'hex')
  return got.length === want.length && timingSafeEqual(want, got)
}
```

## Your answer

Answer with HTTP 200 and one of these JSON bodies:

| Answer | Meaning | What Autinerary shows |
|---|---|---|
| `{"status":"created"}` | the account is made | "Signed up for <your service>" |
| `{"status":"verify_email"}` | made; they must confirm their email first | "Check your email to finish" |
| `{"status":"exists"}` | they already have an account | "You already have an account" |

- **Login link:** you may add `"loginUrl": "https://…"`, a link where they can
  log in or set a password. Autinerary shows it as "Log in to <your service>".
  It must use https.
- **Errors:** for anything else, answer with a 4xx or 5xx status and
  `{"message": "…"}`. Autinerary shows the person "didn't go through" and lets
  them try again later.
- **Speed:** answer within 15 seconds. Autinerary doesn't retry by itself; the
  person can press the button again.

## What Autinerary needs from you

- **Your endpoint:** its https address.
- **Your service's website addresses:** the domains, so Autinerary knows which
  of its listings and plan recommendations are yours.
- **The secret:** a long random value that you or we generate, shared once, by
  a safe channel.

On our side, a partner is one entry in the `SIGNUP_PARTNERS` setting, with the
secret held in its own environment variable (`frontend/lib/signupPartners.ts`).
Both are set in Vercel.

## Privacy

- Only the three fields above are sent, and only for people who pressed Sign
  me up for your service.
- Accounts of people under 18 can't use Sign me up.
- Autinerary keeps a record that it signed the person up with you and how it
  ended, never a password.
