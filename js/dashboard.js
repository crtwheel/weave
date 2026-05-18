async function initDashboard() {
  const user = await getCurrentUser().catch(() => null);
  const authSection = document.getElementById('auth-section');
  const dashboardSection = document.getElementById('dashboard-section');

  if (!user) {
    authSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    return;
  }

  authSection.style.display = 'none';
  dashboardSection.style.display = 'block';
  document.getElementById('user-email').textContent = user.email;
  await loadPurchases(user.id);
}

async function loadPurchases(userId) {
  const tbody = document.getElementById('purchases-body');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-secondary);"><div class="skeleton" style="height:40px;margin:0.5rem 0;"></div></td></tr>';

  try {
    const { data, error } = await supabaseClient
      .from('purchases')
      .select('*, templates(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-secondary);">No purchases yet. <a href="index.html" style="color:var(--accent);">Browse templates.</a></td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => {
      const statusBadge = p.status === 'verified' ? 'badge badge-verified' :
                          p.status === 'rejected' ? 'badge badge-rejected' :
                          'badge badge-pending';
      const statusText = p.status.charAt(0).toUpperCase() + p.status.slice(1);

      let downloadBtn = '';
      if (p.status === 'verified' && p.templates) {
        downloadBtn = `<button class="btn btn-primary btn-sm" onclick="downloadTemplate(${p.template_id})">Download</button>`;
      }

      return `
        <tr>
          <td>${p.templates ? p.templates.name : 'Unknown'}</td>
          <td>${new Date(p.created_at).toLocaleDateString()}</td>
          <td><span class="${statusBadge}">${statusText}</span></td>
          <td>${downloadBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--error);">Failed to load purchases.</td></tr>';
  }
}

async function downloadTemplate(templateId) {
  try {
    const { data, error } = await supabaseClient
      .from('templates')
      .select('storage_path, name')
      .eq('id', templateId)
      .single();

    if (error || !data) throw error;

    const { data: urlData, error: urlError } = await supabaseClient
      .storage
      .from('template-files')
      .createSignedUrl(data.storage_path, 3600);

    if (urlError || !urlData) throw urlError;

    window.open(urlData.signedUrl, '_blank');
  } catch (err) {
    showToast('Failed to generate download link. Please try again.', 'error');
  }
}

function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const isSignUp = document.getElementById('auth-mode').textContent === 'Sign Up';
  const status = document.getElementById('auth-status');

  (isSignUp ? signUp(email, password) : signIn(email, password))
    .then(() => {
      status.textContent = isSignUp ? 'Check your email to confirm signup.' : 'Signed in successfully.';
      status.style.color = 'var(--success)';
      if (!isSignUp) setTimeout(initDashboard, 500);
    })
    .catch(err => {
      status.textContent = err.message;
      status.style.color = 'var(--error)';
    });
}

function toggleAuthMode() {
  const mode = document.getElementById('auth-mode');
  const toggle = document.getElementById('auth-toggle');
  const submitBtn = document.getElementById('auth-submit');
  if (mode.textContent === 'Sign Up') {
    mode.textContent = 'Sign In';
    toggle.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthMode();return false;">Sign up</a>';
    submitBtn.textContent = 'Sign In';
  } else {
    mode.textContent = 'Sign Up';
    toggle.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthMode();return false;">Sign in</a>';
    submitBtn.textContent = 'Sign Up';
  }
  document.getElementById('auth-status').textContent = '';
}

async function handleSignOut() {
  await signOut();
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('dashboard-section').style.display = 'none';
}

function showToast(message, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

document.addEventListener('DOMContentLoaded', initDashboard);
