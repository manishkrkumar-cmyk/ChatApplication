let stompClient = null;
let username = null;
let userEmail = null;
let currentTarget = 'general';
let activeChannelKey = 'general';
let isGroup = true;
let currentSubscription = null;
let currentAuthMode = 'login';
let typingTimeout = null;

// --- AUTO-LOGIN CHECK ON PAGE REFRESH ---

window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('chat_username');
    const savedEmail = localStorage.getItem('chat_email');
    if (savedUser) {
        username = savedUser;
        userEmail = savedEmail || `${savedUser}@chat.com`;
        enterChat();
    }
});

// --- MODAL & AUTHENTICATION HANDLERS ---

function openAuthModal(mode) {
    document.querySelector('#auth-modal').classList.remove('hidden');
    switchAuthTab(mode);
}

function closeAuthModal() {
    document.querySelector('#auth-modal').classList.add('hidden');
    hideAlert();
}

function switchAuthTab(mode) {
    currentAuthMode = mode;
    hideAlert();

    document.querySelector('#tab-login').classList.toggle('active', mode === 'login');
    document.querySelector('#tab-register').classList.toggle('active', mode === 'register');
    document.querySelector('#tab-forgot').classList.toggle('active', mode === 'forgot');

    const emailGroup = document.querySelector('#email-group');
    const passGroup = document.querySelector('#password-group');
    const newPassGroup = document.querySelector('#new-password-group');
    const submitBtn = document.querySelector('#auth-submit-btn span');

    if (mode === 'register') {
        emailGroup.classList.remove('hidden');
        passGroup.classList.remove('hidden');
        newPassGroup.classList.add('hidden');
        submitBtn.textContent = 'Create Account';
    } else if (mode === 'forgot') {
        emailGroup.classList.add('hidden');
        passGroup.classList.add('hidden');
        newPassGroup.classList.remove('hidden');
        submitBtn.textContent = 'Update Password';
    } else {
        emailGroup.classList.add('hidden');
        passGroup.classList.remove('hidden');
        newPassGroup.classList.add('hidden');
        submitBtn.textContent = 'Sign In';
    }
}

function showAlert(message, isError = true) {
    const banner = document.querySelector('#auth-error');
    banner.textContent = message;
    banner.className = `alert-banner ${isError ? 'error' : 'success'}`;
    banner.classList.remove('hidden');
}

function hideAlert() {
    document.querySelector('#auth-error').classList.add('hidden');
}

function handleAuthSubmit(event) {
    event.preventDefault();
    hideAlert();

    const u = document.querySelector('#username').value.trim();
    const p = document.querySelector('#password').value;
    const np = document.querySelector('#newPassword').value;
    const e = document.querySelector('#email').value.trim();

    let endpoint = '/api/auth/login';
    let payload = { username: u, password: p };

    if (currentAuthMode === 'register') {
        endpoint = '/api/auth/register';
        payload = { username: u, password: p, email: e };
    } else if (currentAuthMode === 'forgot') {
        endpoint = '/api/auth/forgot-password';
        payload = { username: u, newPassword: np };
    }

    fetch(`http://localhost:8081${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Authentication failed');
        return data;
    })
    .then(data => {
        if (currentAuthMode === 'register' || currentAuthMode === 'forgot') {
            showAlert(data.message, false);
            setTimeout(() => switchAuthTab('login'), 1200);
        } else {
            username = u;
            userEmail = data.email || `${u}@chat.com`;
            localStorage.setItem('chat_username', username);
            localStorage.setItem('chat_email', userEmail);
            closeAuthModal();
            enterChat();
        }
    })
    .catch(err => showAlert(err.message, true));
}

// --- ENTER CHAT & WEBSOCKET SETUP ---

function enterChat() {
    document.querySelector('#home-page').classList.add('hidden');
    document.querySelector('#chat-page').classList.remove('hidden');

    document.querySelector('#current-username').textContent = username;
    document.querySelector('#current-user-email').textContent = userEmail;
    document.querySelector('#current-user-avatar').textContent = username.charAt(0).toUpperCase();

    fetchPeopleList();

    const socket = new SockJS('http://localhost:8081/ws');
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, () => subscribeToChannel('general'), err => console.error("WebSocket Error:", err));
}

function fetchPeopleList() {
    fetch('http://localhost:8081/api/auth/users')
        .then(res => res.json())
        .then(users => {
            const listArea = document.querySelector('#peopleListArea');
            listArea.innerHTML = '';

            users.forEach(u => {
                if (u.username !== username) {
                    const item = document.createElement('div');
                    item.className = 'people-item';
                    item.onclick = () => selectConversation(u.username, u.email || `${u.username}@chat.com`, false);
                    item.innerHTML = `
                        <div class="avatar-medium">${u.username.charAt(0).toUpperCase()}</div>
                        <div class="people-info">
                            <h4>${u.username}</h4>
                            <p>${u.email || `${u.username}@chat.com`}</p>
                        </div>
                    `;
                    listArea.appendChild(item);
                }
            });
        });
}

function selectConversation(targetName, subText, group = true) {
    currentTarget = targetName;
    isGroup = group;

    document.querySelector('#target-username').textContent = targetName;
    document.querySelector('#target-email').textContent = subText;
    document.querySelector('#target-avatar').textContent = group ? '#' : targetName.charAt(0).toUpperCase();
    document.querySelector('#messageArea').innerHTML = '';

    if (group) {
        activeChannelKey = targetName;
    } else {
        const sorted = [username, targetName].sort();
        activeChannelKey = `${sorted[0]}_${sorted[1]}`;
    }

    subscribeToChannel(activeChannelKey);
}

function subscribeToChannel(channelKey) {
    if (currentSubscription) currentSubscription.unsubscribe();

    currentSubscription = stompClient.subscribe(`/topic/${channelKey}`, onMessageReceived);
    stompClient.send(`/app/chat.addUser/${channelKey}`, {}, JSON.stringify({ sender: username, type: 'JOIN' }));

    loadHistory(channelKey);
}

function loadHistory(channelKey) {
    fetch(`http://localhost:8081/api/messages/${channelKey}`)
        .then(res => res.json())
        .then(messages => {
            document.querySelector('#messageArea').innerHTML = '';
            messages.forEach(msg => renderMessage(msg));
        });
}

function emitTyping() {
    if (stompClient) {
        stompClient.send(`/app/chat.sendMessage/${activeChannelKey}`, {}, JSON.stringify({ sender: username, type: 'TYPING' }));
    }
}

function sendMessage(event) {
    event.preventDefault();
    const input = document.querySelector('#message');
    const content = input.value.trim();

    if (content && stompClient) {
        stompClient.send(`/app/chat.sendMessage/${activeChannelKey}`, {}, JSON.stringify({
            sender: username,
            content: content,
            type: 'CHAT'
        }));
        input.value = '';
    }
}

function uploadFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://localhost:8081/api/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(data => {
            stompClient.send(`/app/chat.sendMessage/${activeChannelKey}`, {}, JSON.stringify({
                sender: username,
                content: `Shared a file: ${data.fileName}`,
                fileUrl: data.fileUrl,
                type: 'CHAT'
            }));
        });
}

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);

    if (message.type === 'TYPING') {
        if (message.sender !== username) {
            const bar = document.querySelector('#typing-indicator');
            document.querySelector('#typing-text').textContent = `${message.sender} is typing...`;
            bar.classList.remove('hidden');
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => bar.classList.add('hidden'), 2000);
        }
        return;
    }

    renderMessage(message);
}

function renderMessage(message) {
    const messageArea = document.querySelector('#messageArea');
    const el = document.createElement('li');

    if (message.type === 'JOIN') {
        el.className = 'message-item event-message';
        el.innerHTML = `<div class="event-bubble">${message.sender} joined</div>`;
    } else {
        const isSelf = message.sender === username;
        el.className = `message-item ${isSelf ? 'self' : 'other'}`;

        let mediaHTML = '';
        if (message.fileUrl) {
            const isImg = message.fileUrl.match(/\.(jpeg|jpg|gif|png)$/i);
            mediaHTML = isImg ? `<img src="${message.fileUrl}" style="max-width:240px; border-radius:12px; margin-top:8px;" />`
                              : `<a href="${message.fileUrl}" target="_blank" style="color:#2563eb;"><i class="fa-solid fa-download"></i> Download File</a>`;
        }

        const displayContent = (message.content && message.content !== "null") ? message.content : '';

        el.innerHTML = `
            ${isSelf ? '' : `<span class="sender-name">${message.sender}</span>`}
            <div class="message-bubble">
                ${displayContent}
                ${mediaHTML}
                <span class="time-stamp">${message.timestamp || ''}</span>
            </div>
        `;
    }

    messageArea.appendChild(el);
    messageArea.scrollTop = messageArea.scrollHeight;
}

function logout() {
    localStorage.removeItem('chat_username');
    localStorage.removeItem('chat_email');
    location.reload();
}