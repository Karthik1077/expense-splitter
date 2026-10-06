// Sends invite emails via Resend (https://resend.com) if RESEND_API_KEY is
// set. If it isn't, this just logs the invite link to the console instead
// of failing — handy for local development before you've set up email.
async function sendInviteEmail({ to, groupName, inviterName }) {
  const apiKey = process.env.RESEND_API_KEY;
  const appUrl = process.env.CLIENT_APP_URL || "http://localhost:5173";
  const signupLink = `${appUrl}/signup?invited_email=${encodeURIComponent(to)}`;

  if (!apiKey) {
    console.log(
      `[invite email - not sent, no RESEND_API_KEY set] To: ${to} | ${inviterName} invited you to "${groupName}" | Sign up: ${signupLink}`
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.INVITE_FROM_EMAIL || "Split <onboarding@resend.dev>",
        to,
        subject: `${inviterName} added you to "${groupName}" on Split`,
        html: `<p>${inviterName} added you to the group <strong>${groupName}</strong> on Split.</p>
               <p><a href="${signupLink}">Sign up</a> to see the group and your balance.</p>`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend API error:", text);
      return { sent: false, reason: "Email provider error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("Failed to send invite email:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendInviteEmail };
