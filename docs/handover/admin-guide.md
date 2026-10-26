# Uttam Niketan — Principal / Admin quick-start

Staff app: **https://uttamniketan.vercel.app/login** (the **Staff login** link is also at the bottom of
every page of the school website). Works on any phone or computer browser.

## First sign-in

1. The developer gives you your email and a temporary password, privately.
2. Sign in. Keep the password private and do not share your account; every correction you make is
   recorded under your name.

## Daily routine

| When               | What to do                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Morning            | **Dashboard → Today's attendance** shows which sections have not submitted yet.                                           |
| During the day     | Remind teachers of sections still showing **Not taken** or **Draft**.                                                     |
| If a mark is wrong | Open the section from **Attendance**, press **Correct** next to the student, choose the right status, and write a reason. |
| End of week/month  | **Reports** → _Daily_ for a day's totals, _Monthly by student_ for each student's attendance rate.                        |

A day can be **locked** (button at the bottom of a submitted day) once it is final; locked days can no
longer be corrected.

## Students

- **Students → Add student**: admission number, full name and class/section are required.
- Guardian mobile number: type it as usual (e.g. `98765 43210`); it is saved in international format.
- Tick **Guardian has agreed to receive school messages** only when the guardian has actually agreed.
- When a student leaves, open them and set **Enrolment status** to _Transferred_ or _Inactive_. Do not
  delete students; their attendance history is kept.

## Staff accounts

**Staff** page (admins only):

- **Add a staff account**: name, email, role. A temporary password is shown **once**. Give it to the
  teacher privately.
- **Assign a teacher to a section**: teachers only see and mark their assigned sections.
- **Reset password**: when a teacher forgets theirs. The old password stops working immediately.
- **Disable account**: when someone leaves. They are signed out on their next click and cannot sign in.
  **Re-enable** restores access.

## WhatsApp absence alerts

**Settings → WhatsApp absence alerts**. Alerts stay off until the school's WhatsApp Business setup is
approved (see `docs/whatsapp-templates.md`). Once live:

- Only guardians who agreed, and only for **Absent** (not Late or Excused).
- Sent when attendance is submitted; correcting an absence quickly cancels the alert if it has not gone out.
- **Message log** shows each alert: _Delivered_, _Read_, _Failed_ (with the reason), _Skipped_.

## If something goes wrong

- "Email or password is incorrect" for a teacher: reset their password on the **Staff** page; check the
  account is not **Disabled**.
- A teacher cannot see their class: check their section assignment on the **Staff** page.
- Anything else: note the page, the time and what you clicked, and contact the developer (see
  `docs/handover/operations.md`, _Support_).
