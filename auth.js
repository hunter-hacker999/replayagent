// --- Modal UI Controls ---
function openModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeModal() {
    const modal = document.getElementById('authModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// --- Supabase Config ---
const SUPABASE_URL = 'https://rkwpzubygaaqkrbyyhmu.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_V_pzVGdCZNm9KTYcM-uYdg_hEEYJmIU'
const EXTENSION_ID = 'ffcbkeipcfkkgafnflapocbhlchlaioc' 

let currentEmail = ''
let currentUser = null
let sb = null

// Initialize Supabase if the library loaded correctly
if (typeof supabase !== 'undefined') {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // Initial check: Is the user already logged in?
  sb.auth.getSession().then(({ data }) => {
    document.getElementById('card-loading').classList.add('hidden');
    
    if (data.session?.user) {
      currentUser = data.session.user
      sendTokenToExtension(data.session)
      showProfileScreen()
    } else {
      document.getElementById('card-login').classList.remove('hidden');
    }
  })

  // Listen for changes (e.g. login/logout events)
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user
      sendTokenToExtension(session)
      showProfileScreen()
    } else if (event === 'SIGNED_OUT') {
      document.getElementById('card-profile').classList.add('hidden');
      document.getElementById('card-login').classList.remove('hidden');
    }
  })
}

// --- Auth Flow ---
async function sendCode() {
  const email = document.getElementById('email-input').value.trim()
  if (!email) return;
  currentEmail = email
  
  const sendBtn = document.getElementById('send-btn');
  sendBtn.innerText = 'Sending...'
  sendBtn.disabled = true;
  
  const { error } = await sb.auth.signInWithOtp({ email })
  
  sendBtn.innerText = 'Send Code'
  sendBtn.disabled = false;
  
  if (error) {
    const alertBox = document.getElementById('alert');
    alertBox.innerText = error.message;
    alertBox.classList.remove('hidden');
    return;
  }

  document.getElementById('step-email').classList.add('hidden');
  document.getElementById('step-otp').classList.remove('hidden');
  document.getElementById('otp-info').textContent = `Code sent to ${email}`;
}

async function verifyCode() {
  const code = document.getElementById('otp-input').value.trim()
  if (!code) return;
  
  const verifyBtn = document.getElementById('verify-btn');
  verifyBtn.innerText = 'Verifying...'
  verifyBtn.disabled = true;

  const { data, error } = await sb.auth.verifyOtp({ email: currentEmail, token: code, type: 'email' })
  
  verifyBtn.innerText = 'Verify'
  verifyBtn.disabled = false;

  if (error) {
     const alertBox = document.getElementById('alert');
     alertBox.innerText = error.message;
     alertBox.classList.remove('hidden');
     return;
  }
  
  currentUser = data.user
  sendTokenToExtension(data.session)
  showProfileScreen()
}

// Pass the token to your Node.js Chrome Extension
function sendTokenToExtension(sessionData) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(EXTENSION_ID, { type: "LOGIN_SUCCESS", session: sessionData });
  }
}

async function signOut() {
  await sb.auth.signOut()
  currentUser = null
  
  // Reset UI
  document.getElementById('card-profile').classList.add('hidden');
  document.getElementById('step-otp').classList.add('hidden');
  
  document.getElementById('card-login').classList.remove('hidden');
  document.getElementById('step-email').classList.remove('hidden');
  document.getElementById('email-input').value = '';
}

// --- Profile Flow ---
function showProfileScreen() {
  document.getElementById('card-loading').classList.add('hidden');
  document.getElementById('card-login').classList.add('hidden');
  document.getElementById('card-profile').classList.remove('hidden');
  fetchProfile()
}

async function fetchProfile() {
  if (!currentUser) return;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      document.getElementById('prof-name').value = data.full_name || '';
      document.getElementById('prof-brokerage').value = data.brokerage || '';
      document.getElementById('prof-market').value = data.market || '';
    }
  } catch (err) { console.error("Could not fetch profile:", err) }
}

async function fetchProfile() {
  if (!currentUser) return;
  try {
    const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    if (data) {
      // Basic Info
      document.getElementById('prof-name').value = data.full_name || '';
      document.getElementById('prof-brokerage').value = data.brokerage || '';
      document.getElementById('prof-market').value = data.market || '';
      
      // Advanced Portfolio Info
      document.getElementById('prof-role').value = data.role || '';
      document.getElementById('prof-style').value = data.communication_style || '';
      document.getElementById('prof-rules').value = data.strict_rules || '';
    }
  } catch (err) { console.error("Could not fetch profile:", err) }
}

async function saveProfile() {
  if (!currentUser) return;
  
  const saveBtn = document.getElementById('save-profile-btn');
  saveBtn.innerText = 'Saving...';
  saveBtn.disabled = true;

  const updates = {
    id: currentUser.id,
    full_name: document.getElementById('prof-name').value.trim(),
    brokerage: document.getElementById('prof-brokerage').value.trim(),
    market: document.getElementById('prof-market').value.trim(),
    
    // New Portfolio Data
    role: document.getElementById('prof-role').value.trim(),
    communication_style: document.getElementById('prof-style').value.trim(),
    strict_rules: document.getElementById('prof-rules').value.trim(),
    
    updated_at: new Date()
  };

  const { error } = await sb.from('profiles').upsert(updates);
  
  saveBtn.innerText = 'Save Portfolio';
  saveBtn.disabled = false;

  if (!error) {
    const profileAlert = document.getElementById('profile-alert');
    profileAlert.innerText = 'Portfolio saved securely.';
    profileAlert.classList.remove('hidden');
    
    // Send updated session/profile to extension immediately
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(EXTENSION_ID, { type: "LOGIN_SUCCESS", session: { user: currentUser } });
    }
  } else {
      console.error(error);
  }
}
