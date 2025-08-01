# Privacy Policy
_Last updated: 2025-08-01_

## Summary
This command-line utility runs entirely on the user’s local machine. It requests the Gmail read-only scope solely to fetch one specific login e-mail from WorkFlowy so the user can automate sign-in; no Google data ever leaves the user’s device, and nothing is sent to any server I control. The tool complies with Google’s OAuth 2.0 Policies, the API Services User Data Policy (including the Limited Use requirements), and all other applicable terms. 

## 1. Who I am
My name is **Medhansh Garg** and I developed this tool independently.  
Contact: **medhansh2005@gmail.com**

## 2. What Google data I access
| Data | Source | Purpose | Stored? | Where |
|------|--------|---------|---------|-------|
| Gmail messages that match `from:help@email.workflowy.com` and subject starting “Login code for Workflowy” | Gmail API (`https://www.googleapis.com/auth/gmail.readonly`) | Extract the 12-digit one-time login code | No | Parsed in memory only |
| OAuth 2.0 Refresh Token | Google OAuth | Maintain the user’s own credentials so they do not re-authorize each run | Yes | Plain-text JSON file (`.wfconfig.json`) in the user’s CLI directory, permissions `0600` |

I do **not** access, read, or store any other e-mails, attachments, labels, or metadata.

## 3. How I use the information
* The Tool reads the latest WorkFlowy login e-mail, extracts the one-time code, and fills it into the WorkFlowy login form in an automated browser session.
* Once the code is used, the e-mail and extracted code are discarded from memory.
* The refresh token is written locally to let the user repeat the flow without re-granting permission.
* No Google user data leaves the device at any time.

No analytics, profiling, advertising, or additional processing occurs. 

## 4. Storage and security
* All tokens are written only to the local config file with UNIX file-mode 0600, restricting access to the current OS user.
* The file never leaves the device unless the user chooses to back it up.
* The Tool makes HTTPS requests only to www.googleapis.com (Gmail) and workflowy.com; there is no external server or telemetry.
* Tokens are transmitted to Google only over HTTPS and stored locally.

Users may delete .wfconfig.json at any time to revoke local credentials. 

## 5. Sharing of information
*No data is shared, sold, or transferred to third parties.*

## 6. Google Limited-Use affirmation
“The use of information received from Gmail APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.”

## 7. User controls
* **Revoke access** – <https://myaccount.google.com/permissions>  
* **Delete local data** – delete `.wfconfig.json`.  
* **Inspect source** – the Tool is open-source.

## 8. Children’s privacy
This Tool is not directed to children under 13 and does not knowingly collect data from them.

## 9. Changes to this policy
I may update this policy to reflect changes in functionality or legal requirements. Material changes will be announced in the project’s release notes and the updated policy will bear a revised “Last updated” date. Continued use after any change constitutes acceptance of the revised policy. 

## 10. Contact
For privacy questions, e-mail **medhansh2005@gmail.com** or open a GitHub issue.