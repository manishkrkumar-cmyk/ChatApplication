// ==========================================================================
// CENTRAL BACKEND CONFIGURATION
// ==========================================================================
const BACKEND_URL = "https://chatapplication-backend-kh2m.onrender.com";

let stompClient = null;
let currentUser = null;
let currentChannel = 'general';
let currentAuthMode = 'login';
let typingTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
});

/* ==========================================================================
   1. AUTHENTICATION & MODAL HANDLERS
   ========================================================================== */

function checkActiveSession() {
    const savedUser = localStorage.getItem('pulse_workspace_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showChatApp();
    }
}

function openAuthModal(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('hidden');
        switchAuthTab(mode);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('hidden');
        clearAuthErrors();
    }
}

function switchAuthTab(mode) {
    currentAuthMode = mode;
    clearAuthErrors();

    // Active tab button styling
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const tabForgot = document.getElementById('tab-forgot');

    if (tabLogin) tabLogin.classList.toggle('active', mode === 'login');
    if (tabRegister) tabRegister.classList.toggle('active', mode === 'register');
    if (tabForgot) tabForgot.classList.toggle('active', mode === 'forgot');

    // Toggle input field visibility
    document.getElementById('email-group').classList.toggle('hidden', mode !== 'register');
    document.getElementById('password-group').classList.toggle('hidden', mode === 'forgot');
    document.getElementById('new-password-group').classList.toggle('hidden', mode !== 'forgot');

    // Modal title and button updates
    const title = document.getElementById('modal-title');
    const subtitle = document.getElementById('modal-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (mode === 'login') {
        title.textContent = "Welcome Back";
        subtitle.textContent = "Log in to enter Pulse Workspace";
        submitBtn.innerHTML = `<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>`;
    } else if (mode === 'register') {
        title.textContent = "Create Account";
        subtitle.textContent = "Register to join the workspace";
        submitBtn.innerHTML = `<span>Register</span> <i class="fa-solid fa-user-plus"></i>`;
    } else if (mode === 'forgot') {
        title.textContent = "Reset Password";
        subtitle.textContent = "Enter details to reset your password";
        submitBtn.innerHTML = `<span>Reset Password</span> <i class="fa-solid fa-key"></i>`;
    }
}

function clearAuthErrors() {
    const errorBox = document.getElementById('auth-error');
    if (errorBox) {
        errorBox.innerHTML = '';
        errorBox.classList.add('hidden');
    }
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const newPassword = document.getElementById('newPassword').value;

    let endpoint = '';
    let payload = {};

    if (currentAuthMode === 'login') {
        endpoint = `${BACKEND_URL}/api/auth/login`;
        payload = { username, password };
    } else if (currentAuthMode === 'register') {
        endpoint = `${BACKEND_URL}/api/auth/register`;
        payload = { username, email, password };
    } else if (currentAuthMode === 'forgot') {
        endpoint = `${BACKEND_URL}/api/auth/reset-password`;
        payload = { username, newPassword };
    }

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Authentication failed");
        return res.json();
    })
    .then(data => {
        if (currentAuthMode === 'forgot') {
            alert("Password reset successfully! Please sign in.");
            switchAuthTab('login');
        } else {
            currentUser = { username: data.username || username, email: data.email || email };
            localStorage.setItem('pulse_workspace_user', JSON.stringify(currentUser));
            closeAuthModal();
            showChatApp();
        }
    })
    .catch(err => {
        const errorBox = document.getElementById('auth-error');
        errorBox.textContent = err.message || "Invalid input or credentials.";
        errorBox.classList.remove('hidden');
    });
}

/* ==========================================================================
   2. CHAT APP DASHBOARD & WEBSOCKET ENGINE
   ========================================================================== */

function showChatApp() {
    document.getElementById('home-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');

    document.getElementById('current-username').textContent = currentUser.username;
    document.getElementById('current-user-email').textContent = currentUser.email || '';
    document.getElementById('current-user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();

    connectWebSocket();
    loadPeopleDirectory();
}

function connectWebSocket() {
    const socket = new SockJS(`${BACKEND_URL}/ws`);
    stompClient = Stomp.over(socket);

    stompClient.connect({}, () => {
        selectConversation(currentChannel, 'Public Group Workspace', true);
    }, (error) => {
        console.error('WebSocket connection error:', error);
    });
}

function selectConversation(channelName, subtext, isGroup = false) {
    currentChannel = channelName;

    document.getElementById('target-username').textContent = isGroup ? `# ${channelName}` : channelName;
    document.getElementById('target-email').textContent = subtext;
    document.getElementById('target-avatar').textContent = isGroup ? '#' : channelName.charAt(0).toUpperCase();
    document.getElementById('messageArea').innerHTML = '';

    // STOMP Topic subscription
    stompClient.subscribe(`/topic/${currentChannel}`, (payload) => {
        const message = JSON.parse(payload.body);
        handleIncomingMessage(message);
    });

    // Fetch message history from backend DB
    fetch(`${BACKEND_URL}/api/messages/${currentChannel}`)
        .then(res => res.json())
        .then(messages => {
            messages.forEach(msg => renderMessage(msg));
            scrollToBottom();
        });
}

function handleIncomingMessage(message) {
    if (message.type === 'TYPING') {
        showTypingIndicator(message.sender);
        return;
    }

    const existingMsgEl = document.getElementById(`msg-${message.id}`);
    if (existingMsgEl) {
        updateExistingMessageNode(existingMsgEl, message);
    } else {
        renderMessage(message);
    }
    scrollToBottom();
}

function renderMessage(message) {
    if (!message) return;

    const isSelf = message.sender === currentUser.username;
    const isDeleted = message.deleted;

    let messageContent = message.content || '';
    if (isDeleted) {
        messageContent = '<i>This message was deleted</i>';
    } else if (message.edited) {
        messageContent += ' <span class="edited-badge">(edited)</span>';
    }

    let actionButtons = '';
    if (isSelf && !isDeleted) {
        const safeContent = escapeQuotes(message.content || '');
        actionButtons = `
            <div class="message-actions">
                <button title="Edit" onclick="promptEditMessage(${message.id}, '${safeContent}')"><i class="fa-solid fa-pen"></i></button>
                <button title="Delete" onclick="confirmDeleteMessage(${message.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    }

    const html = `
        <li class="message-item ${isSelf ? 'self' : 'other'}" id="msg-${message.id}">
            <span class="sender-name">${message.sender}</span>
            <div class="message-bubble">
                <div class="bubble-content">${messageContent}</div>
                <span class="time-stamp">${message.time || ''}</span>
            </div>
            ${actionButtons}
        </li>
    `;

    const messageArea = document.getElementById('messageArea');
    if (messageArea) {
        messageArea.insertAdjacentHTML('beforeend', html);
    }
}

function updateExistingMessageNode(element, message) {
    const bubbleContent = element.querySelector('.bubble-content');
    if (message.deleted) {
        bubbleContent.innerHTML = '<i>This message was deleted</i>';
        const actions = element.querySelector('.message-actions');
        if (actions) actions.remove();
    } else if (message.edited) {
        bubbleContent.innerHTML = `${message.content} <span class="edited-badge">(edited)</span>`;
    }
}

function sendMessage(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById('message');
    const text = input.value.trim();

    if (text && stompClient) {
        const chatMessage = {
            sender: currentUser.username,
            content: text,
            channel: currentChannel,
            type: 'CHAT'
        };
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify(chatMessage));
        input.value = '';
    }
}

function promptEditMessage(id, oldContent) {
    const newText = prompt("Edit your message:", oldContent);
    if (newText !== null && newText.trim() !== "" && newText !== oldContent) {
        stompClient.send('/app/chat.editMessage', {}, JSON.stringify({
            id: id,
            content: newText.trim(),
            channel: currentChannel
        }));
    }
}

function confirmDeleteMessage(id) {
    if (confirm("Are you sure you want to delete this message?")) {
        stompClient.send('/app/chat.deleteMessage', {}, JSON.stringify({
            id: id,
            channel: currentChannel
        }));
    }
}

/* ==========================================================================
   3. FIXED FILE & IMAGE UPLOAD ENGINE
   ========================================================================== */

function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error("Upload failed on server");
        return res.json();
    })
    .then(data => {
        // Construct absolute server URL from Render backend
        let rawUrl = data.fileUrl || data.fileName || '';
        let fullUrl = rawUrl.startsWith('http') 
            ? rawUrl 
            : `${BACKEND_URL}/uploads/${rawUrl.replace(/^\/?uploads\//, '')}`;

        const isImage = file.type.startsWith('image/');
        const content = isImage 
            ? `<a href="${fullUrl}" target="_blank"><img src="${fullUrl}" alt="Attachment" /></a>`
            : `📎 <a href="${fullUrl}" target="_blank" download>${file.name}</a>`;

        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
            sender: currentUser.username,
            content: content,
            channel: currentChannel,
            type: 'CHAT'
        }));

        // Reset file input value so user can upload same file again
        event.target.value = '';
    })
    .catch(err => {
        console.error("File upload error:", err);
        alert("Failed to upload file. Ensure backend service is active!");
    });
}

function emitTyping() {
    if (stompClient) {
        stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
            sender: currentUser.username,
            channel: currentChannel,
            type: 'TYPING'
        }));
    }
}

function showTypingIndicator(sender) {
    if (sender === currentUser.username) return;
    const indicator = document.getElementById('typing-indicator');
    const text = document.getElementById('typing-text');
    text.textContent = `${sender} is typing...`;
    indicator.classList.remove('hidden');

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        indicator.classList.add('hidden');
    }, 2000);
}

function loadPeopleDirectory() {
    fetch(`${BACKEND_URL}/api/users`)
        .then(res => res.json())
        .then(users => {
            const container = document.getElementById('peopleListArea');
            if (!container) return;
            container.innerHTML = '';
            users.forEach(user => {
                if (user.username !== currentUser.username) {
                    const roomName = [currentUser.username, user.username].sort().join('_');
                    const html = `
                        <div class="people-item" onclick="selectConversation('${roomName}', '${user.email || 'Direct Message'}', false)">
                            <div class="avatar-medium">${user.username.charAt(0).toUpperCase()}</div>
                            <div class="people-info">
                                <h4>${user.username}</h4>
                                <p>${user.email || 'Available'}</p>
                            </div>
                        </div>
                    `;
                    container.insertAdjacentHTML('beforeend', html);
                }
            });
        });
}

function scrollToBottom() {
    const area = document.getElementById('messageArea');
    if (area) area.scrollTop = area.scrollHeight;
}

function escapeQuotes(str) {
    return str ? str.replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
}

function logout() {
    localStorage.removeItem('pulse_workspace_user');
    window.location.reload();
}