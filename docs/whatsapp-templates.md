# WhatsApp absence alert — templates and setup

Draft wording from roadmap §15. **The school must review this text** before it is submitted to Meta
for approval. Only approved templates can be sent.

## Template

- **Name:** `absence_alert` (set `WHATSAPP_TEMPLATE_NAME` if the approved name differs)
- **Category:** Utility
- **Languages:** English (`en`) and Hindi (`hi`). Each guardian receives the language recorded on the
  student's record ("Message language").
- **Body variables, in this exact order:**
  1. `{{1}}` student's full name, e.g. `Aarav Kumar`
  2. `{{2}}` class and section, e.g. `Class 3 – A`
  3. `{{3}}` date in DD-MM-YYYY format, e.g. `26-10-2026`

### English (`en`)

> Dear Parent/Guardian, your child {{1}} of Class {{2}} was marked absent at Uttam Niketan School on {{3}}. If you believe this is incorrect, please contact the school office.

### Hindi (`hi`)

> प्रिय अभिभावक, आपके बच्चे {{1}} (कक्षा {{2}}) को दिनांक {{3}} को उत्तम निकेतन विद्यालय में अनुपस्थित दर्ज किया गया है। यदि यह जानकारी गलत है, तो कृपया विद्यालय कार्यालय से संपर्क करें।

Because `{{2}}` already contains "Class 3 – A", the wording "of Class {{2}}" would read "of Class Class 3 – A".
Before submitting, change it to **"of {{2}}"** (English) and **"({{2}})"** (Hindi), or ask for the
app to send only "3 – A".

## When an alert is sent

- Only after attendance for the section is **submitted**. Drafts never send anything.
- Only for students marked **Absent**. Late and Excused do not send.
- Only if the guardian has **agreed to receive messages** (checkbox on the student record) and a mobile
  number is recorded.
- Only if the school setting (**Settings → WhatsApp absence alerts**) is on **and** the server's
  `WHATSAPP_MODE` is `test` or `live`.
- At most once per student per day. If an admin corrects the absence before the alert goes out, the alert
  is cancelled.
- Alerts for absences more than 2 days old are skipped rather than sent late.

## Server configuration (Vercel → Project → Settings → Environment Variables)

| Variable                   | Purpose                                                                   |
| -------------------------- | ------------------------------------------------------------------------- |
| `WHATSAPP_MODE`            | `off` (default), `test` or `live`                                         |
| `WHATSAPP_ACCESS_TOKEN`    | Permanent system-user token from Meta Business. **Secret.**               |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID of the school's WhatsApp Business number                  |
| `WHATSAPP_TEMPLATE_NAME`   | Approved template name (default `absence_alert`)                          |
| `WHATSAPP_APP_SECRET`      | Meta app secret, used to verify webhook signatures. **Secret.**           |
| `WHATSAPP_VERIFY_TOKEN`    | Any long random string; enter the same value in the Meta webhook settings |
| `WHATSAPP_TEST_RECIPIENTS` | Comma-separated numbers allowed to receive messages in `test` mode        |
| `CRON_SECRET`              | Long random string; Vercel Cron uses it to call the daily safety-net run  |

Webhook callback URL for the Meta app: `https://<site>/api/webhooks/whatsapp`, subscribed to the
`messages` field.

## Go-live checklist

1. The school owns the Meta Business account and the WhatsApp Business number, and has completed
   business verification.
2. The template is approved in English and Hindi, with the variable order above.
3. The school has written authorization for absence messages, and consent is recorded per guardian.
4. The school has agreed who pays Meta's per-message fees.
5. Run in `test` mode with staff phone numbers. Submit attendance for a test student and confirm in
   **Settings → Message log** that the message is **Delivered**.
6. Switch `WHATSAPP_MODE` to `live` and redeploy.
