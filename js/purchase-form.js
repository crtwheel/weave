async function submitPurchase(event, templateId) {
  event.preventDefault();
  const btn = document.getElementById('submit-btn');
  const status = document.getElementById('form-status');
  const email = document.getElementById('email').value.trim();
  const txHash = document.getElementById('tx-hash').value.trim();
  const senderWallet = document.getElementById('sender-wallet').value.trim();
  const discordUsername = document.getElementById('discord').value.trim();

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      status.innerHTML = '<p style="color:var(--error);">You must be <a href="dashboard.html" style="color:var(--accent);">signed in</a> to submit a purchase.</p>';
      btn.disabled = false;
      btn.textContent = 'Submit for Verification';
      return;
    }

    const { data, error } = await supabaseClient
      .from('purchases')
      .insert({
        user_id: user.id,
        template_id: templateId,
        tx_hash: txHash,
        sender_wallet: senderWallet,
        discord_username: discordUsername || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        status.innerHTML = '<p style="color:var(--error);">This transaction hash has already been used. Each hash can only be verified once.</p>';
      } else {
        status.innerHTML = `<p style="color:var(--error);">Submission failed: ${error.message}</p>`;
      }
      btn.disabled = false;
      btn.textContent = 'Submit for Verification';
      return;
    }

    status.innerHTML = '<p style="color:var(--success);">Payment submitted successfully! Your purchase is pending verification. Check your dashboard for updates. Usually takes under 5 minutes.</p>';
    document.getElementById('purchase-form').reset();
  } catch (err) {
    status.innerHTML = '<p style="color:var(--error);">Something went wrong. Please try again.</p>';
  }

  btn.disabled = false;
  btn.textContent = 'Submit for Verification';
}
