// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBCGd5_a8p1Jt0p3ZUEzjOqtZ8Do5dLJGI",
    authDomain: "megachat-6b432.firebaseapp.com",
    projectId: "megachat-6b432",
    storageBucket: "megachat-6b432.firebasestorage.app",
    messagingSenderId: "689172817399",
    appId: "1:689172817399:web:7f5c324ee9b1f4de7efaf2"
};

// Inicialização
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Referências DOM
const loadingIndicator = document.getElementById('loading-indicator');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const pages = document.querySelectorAll('.page');
const navButtons = document.querySelectorAll('.nav-button');
const mainContactsList = document.getElementById('main-contacts-list');
const profileUpdateForm = document.getElementById('profile-update-form');
const profileUsernameInput = document.getElementById('profile-username');
const appLogoutButton = document.getElementById('app-logout-button');
const chatPage = document.getElementById('chat-page');
const chatArea = document.getElementById('chat-area');
const welcomeScreen = document.getElementById('welcome-screen');
const chatWithUsername = document.getElementById('chat-with-username');
const backToContactsBtn = document.getElementById('back-to-contacts-btn');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const uploadFileBtn = document.getElementById('upload-file-btn');
const fileInput = document.getElementById('file-input');
const subchatsList = document.getElementById('subchats-list');
const addSubchatBtn = document.getElementById('add-subchat-btn');
const subchatModal = document.getElementById('subchat-modal');
const subchatForm = document.getElementById('subchat-form');
const subchatNameInput = document.getElementById('subchat-name-input');
const subchatIdInput = document.getElementById('subchat-id-input');
const cancelSubchatBtn = document.querySelector('#subchat-modal #cancel-subchat-btn');
const messageContextMenu = document.getElementById('message-context-menu');
const editMessageBtn = document.getElementById('edit-message-btn');
const deleteMessageBtn = document.getElementById('delete-message-btn');
const emojiReactions = document.getElementById('emoji-reactions');
const editMessageModal = document.getElementById('edit-message-modal');
const editMessageForm = document.getElementById('edit-message-form');
const editMessageInput = document.getElementById('edit-message-input');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const authError = document.getElementById('auth-error');

// Variáveis de Estado
let currentUser = null;
let currentChatPartner = null;
let currentSubchatId = null;
let unsubscribeMessages = null;
let unsubscribeSubchats = null;
let longPressTimer;
let activeMessageId = null;
let listenersInitialized = false;

// --- LÓGICA DE NAVEGAÇÃO ---
function showPage(pageId) {
    pages.forEach(p => p.classList.remove('active'));
    navButtons.forEach(b => b.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    document.getElementById(`nav-${pageId.replace('-page', '')}`)?.classList.add('active');
    
    if (pageId !== 'chat-page') {
        chatPage.classList.remove('chat-view-active');
    }
}

// --- LÓGICA DE AUTENTICAÇÃO E PERFIL ---
auth.onAuthStateChanged(user => {
    loadingIndicator.classList.add('hidden'); 
    if (user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        loadUsersForContactsPage();
        loadProfile();
        initializeEventListeners();
        showPage('contacts-page');
    } else {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        if (unsubscribeMessages) unsubscribeMessages();
        if (unsubscribeSubchats) unsubscribeSubchats();
    }
});

// --- INICIALIZAÇÃO DOS OUVINTES DE EVENTOS ---
function initializeEventListeners() {
    if (listenersInitialized) return;

    console.log("Inicializando os ouvintes de eventos da aplicação...");

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.id.replace('nav-', '') + '-page';
            showPage(pageId);
        });
    });

    showSignup.addEventListener('click', (e) => { e.preventDefault(); loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); });
    showLogin.addEventListener('click', (e) => { e.preventDefault(); signupForm.classList.add('hidden'); loginForm.classList.remove('hidden'); });

    signupForm.addEventListener('submit', e => {
        e.preventDefault();
        const username = signupForm.querySelector('#signup-username').value;
        const email = signupForm.querySelector('#signup-email').value;
        const password = signupForm.querySelector('#signup-password').value;
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => db.collection('users').doc(cred.user.uid).set({ username, email }))
            .catch(err => authError.textContent = err.message);
    });

    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = loginForm.querySelector('#login-email').value;
        const password = loginForm.querySelector('#login-password').value;
        auth.signInWithEmailAndPassword(email, password).catch(err => authError.textContent = err.message);
    });

    profileUpdateForm.addEventListener('submit', e => {
        e.preventDefault();
        const newUsername = profileUsernameInput.value.trim();
        if (newUsername) {
            db.collection('users').doc(currentUser.uid).update({ username: newUsername })
              .then(() => alert('Perfil atualizado!'));
        }
    });

    appLogoutButton.addEventListener('click', () => auth.signOut());

    addSubchatBtn.addEventListener('click', () => {
        openSubchatModal(); 
    });

    backToContactsBtn.addEventListener('click', () => {
        chatPage.classList.remove('chat-view-active');
        showPage('contacts-page');
    });

    messageForm.addEventListener('submit', e => {
        e.preventDefault();
        const content = messageInput.value.trim();
        if (content) { sendMessage({ tipo: 'texto', conteudo: content }); messageInput.value = ''; }
    });

    uploadFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => { const file = e.target.files[0]; if (file) sendFileMessage(file); fileInput.value = ''; });

    subchatsList.addEventListener('click', (event) => {
        const pill = event.target.closest('.subchat-pill');
        if (pill) {
            const subchatId = pill.dataset.id === 'null' ? null : pill.dataset.id;
            selectSubchat(subchatId);
        }
    });

    subchatsList.addEventListener('dblclick', (event) => {
        const pill = event.target.closest('.subchat-pill');
        if (pill && pill.dataset.id !== 'null') {
            const subchatId = pill.dataset.id;
            const subchatName = pill.textContent;
            openSubchatModal(subchatId, subchatName);
        }
    });

    window.addEventListener('click', e => { if (!e.target.closest('.message-bubble') && !e.target.closest('#message-context-menu')) { messageContextMenu.classList.add('hidden'); } });
    
    deleteMessageBtn.addEventListener('click', () => {
        if (activeMessageId) {
            const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
            const collectionName = currentSubchatId ? `subchat_${currentSubchatId}` : 'messages';
            db.collection('chats').doc(chatId).collection(collectionName).doc(activeMessageId).delete();
        }
        messageContextMenu.classList.add('hidden');
    });
    
    emojiReactions.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            if (activeMessageId) {
                const emoji = button.textContent;
                const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
                const collectionName = currentSubchatId ? `subchat_${currentSubchatId}` : 'messages';
                const messageRef = db.collection('chats').doc(chatId).collection(collectionName).doc(activeMessageId);
                db.runTransaction(async t => {
                    const doc = await t.get(messageRef);
                    if (!doc.exists) return;
                    const reactions = doc.data().reactions || {};
                    const uids = reactions[emoji] || [];
                    if (uids.includes(currentUser.uid)) {
                        t.update(messageRef, { [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
                    } else {
                        t.update(messageRef, { [`reactions.${emoji}`]: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
                    }
                });
            }
            messageContextMenu.classList.add('hidden');
        });
    });

    cancelEditBtn.addEventListener('click', closeEditModal);

    editMessageForm.addEventListener('submit', e => {
        e.preventDefault();
        const newContent = editMessageInput.value.trim();
        if (newContent && activeMessageId) {
            const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
            const collectionName = currentSubchatId ? `subchat_${currentSubchatId}` : 'messages';
            db.collection('chats').doc(chatId).collection(collectionName).doc(activeMessageId).update({
                conteudo: newContent,
                editado: true,
                hora_editado: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        closeEditModal();
    });
    
    cancelSubchatBtn.addEventListener('click', closeSubchatModal);

    // CORREÇÃO APLICADA: Esta função já lida com criar e editar.
    subchatForm.addEventListener('submit', e => {
        e.preventDefault();
        const name = subchatNameInput.value.trim();
        if (!name) return;
        const subchatId = subchatIdInput.value;
        const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
        const chatDocRef = db.collection('chats').doc(chatId);
        
        if (subchatId) { // Se existe um ID, atualiza o nome
            chatDocRef.update({ [`subchats.${subchatId}.name`]: name }).then(closeSubchatModal);
        } else { // Se não existe um ID, cria um novo tópico
            const newId = Date.now().toString();
            chatDocRef.set({ subchats: { [newId]: { name: name } } }, { merge: true }).then(closeSubchatModal);
        }
    });

    listenersInitialized = true;
}


function loadProfile() {
    db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
        if (doc.exists) profileUsernameInput.value = doc.data().username;
    });
}

function loadUsersForContactsPage() {
    db.collection('users').onSnapshot(snapshot => {
        mainContactsList.innerHTML = '';
        snapshot.forEach(doc => {
            if (doc.id === currentUser.uid) return;
            const user = doc.data();
            const li = document.createElement('li');
            li.textContent = user.username;
            li.addEventListener('click', () => {
                startChat(doc.id, user.username);
                showPage('chat-page');
            });
            mainContactsList.appendChild(li);
        });
    });
}

function startChat(uid, username) {
    currentChatPartner = { uid, username };
    currentSubchatId = null;
    welcomeScreen.classList.add('hidden');
    chatArea.classList.remove('hidden');
    chatWithUsername.textContent = username;
    chatWithUsername.onclick = () => selectSubchat(null);
    chatPage.classList.add('chat-view-active');
    loadSubchats();
    loadMessages();
}

function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }

function loadMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
    const collectionName = currentSubchatId ? `subchat_${currentSubchatId}` : 'messages';
    const messagesCollection = db.collection('chats').doc(chatId).collection(collectionName).orderBy('hora_enviado');
    
    unsubscribeMessages = messagesCollection.onSnapshot(snapshot => {
        messagesContainer.innerHTML = '';
        snapshot.forEach(doc => displayMessage(doc.data(), doc.id));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function displayMessage(message, messageId) {
    const messageWrapper = document.createElement('div');
    messageWrapper.classList.add('message', message.user_que_enviou === currentUser.uid ? 'sent' : 'received');
    messageWrapper.dataset.id = messageId;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const tipo = message.tipo || 'texto';
    switch (tipo) {
        case 'imagem': bubble.innerHTML = `<img src="${message.conteudo}" alt="${message.nomeFicheiro || 'Imagem'}">`; break;
        case 'ficheiro': bubble.innerHTML = `Ficheiro: <a href="${message.conteudo}" target="_blank" rel="noopener noreferrer">${message.nomeFicheiro}</a>`; break;
        default:
            const messageContent = document.createElement('div');
            messageContent.className = 'message-content';
            messageContent.textContent = message.conteudo;
            if (message.editado) {
                const editedIndicator = document.createElement('span');
                editedIndicator.className = 'edited-indicator';
                editedIndicator.textContent = ' (editado)';
                messageContent.appendChild(editedIndicator);
            }
            bubble.appendChild(messageContent);
            break;
    }
    messageWrapper.appendChild(bubble);

    if (message.reactions) {
        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'reactions-container';
        Object.entries(message.reactions).forEach(([emoji, uids]) => {
            if (uids.length > 0) {
                const reactionDiv = document.createElement('div');
                reactionDiv.className = 'reaction';
                reactionDiv.textContent = `${emoji} ${uids.length}`;
                reactionsContainer.appendChild(reactionDiv);
            }
        });
        messageWrapper.appendChild(reactionsContainer);
    }
    const openMenu = (event) => { openContextMenu(event, messageId, message.conteudo, message.user_que_enviou, tipo); };
    bubble.addEventListener('dblclick', openMenu);
    bubble.addEventListener('contextmenu', openMenu);
    bubble.addEventListener('touchstart', e => { longPressTimer = setTimeout(() => openMenu(e), 500); });
    bubble.addEventListener('touchend', () => clearTimeout(longPressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    messagesContainer.appendChild(messageWrapper);
}

function sendMessage(messageData) {
    const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
    const collectionName = currentSubchatId ? `subchat_${currentSubchatId}` : 'messages';
    const finalMessage = { ...messageData, user_que_enviou: currentUser.uid, user_que_recebeu: currentChatPartner.uid, hora_enviado: firebase.firestore.FieldValue.serverTimestamp() };
    db.collection('chats').doc(chatId).collection(collectionName).add(finalMessage);
}

function sendFileMessage(file) {
    const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
    const filePath = `chat_files/${chatId}/${Date.now()}_${file.name}`;
    const uploadTask = storage.ref(filePath).put(file);
    uploadTask.on('state_changed', null, err => console.error(err), () => {
        uploadTask.snapshot.ref.getDownloadURL().then(url => {
            sendMessage({ tipo: file.type.startsWith('image/') ? 'imagem' : 'ficheiro', conteudo: url, nomeFicheiro: file.name });
        });
    });
}

function selectSubchat(subchatId) {
    currentSubchatId = subchatId;
    document.querySelectorAll('.subchat-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.id === String(subchatId));
    });
    loadMessages();
}

function loadSubchats() {
    if (unsubscribeSubchats) unsubscribeSubchats();
    const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
    const chatDocRef = db.collection('chats').doc(chatId);

    unsubscribeSubchats = chatDocRef.onSnapshot(doc => {
        subchatsList.innerHTML = '';
        
        const generalPill = document.createElement('div');
        generalPill.className = 'subchat-pill';
        generalPill.textContent = 'Geral';
        generalPill.dataset.id = 'null';
        subchatsList.appendChild(generalPill);

        if (doc.exists && doc.data().subchats) {
            const subchats = doc.data().subchats;
            for (const id in subchats) {
                const subchat = subchats[id];
                const pill = document.createElement('div');
                pill.className = 'subchat-pill';
                pill.textContent = subchat.name;
                pill.dataset.id = id;
                subchatsList.appendChild(pill);
            }
        }
        
        const activeId = currentSubchatId === null ? 'null' : String(currentSubchatId);
        document.querySelector(`.subchat-pill[data-id="${activeId}"]`)?.classList.add('active');
    });
}

function openContextMenu(event, messageId, content, senderUID, type) {
    event.preventDefault();
    activeMessageId = messageId;
    messageContextMenu.classList.remove('hidden');
    const menuWidth = messageContextMenu.offsetWidth;
    const menuHeight = messageContextMenu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    let x = event.pageX || event.touches[0].pageX;
    let y = event.pageY || event.touches[0].pageY;
    if (x + menuWidth > windowWidth) x = windowWidth - menuWidth - 10;
    if (y + menuHeight > windowHeight) y = windowHeight - menuHeight - 10;
    messageContextMenu.style.top = `${y}px`;
    messageContextMenu.style.left = `${x}px`;
    
    const ownerOptions = document.querySelector('.context-menu-options');
    if (senderUID === currentUser.uid) {
        ownerOptions.style.display = 'flex';
        editMessageBtn.style.display = type === 'texto' ? 'block' : 'none';
        editMessageBtn.onclick = () => openEditModal(content);
    } else {
        ownerOptions.style.display = 'none';
    }
}

function openEditModal(content) {
    editMessageModal.classList.remove('hidden');
    editMessageInput.value = content;
    editMessageInput.focus();
    messageContextMenu.classList.add('hidden');
}

function closeEditModal() { editMessageModal.classList.add('hidden'); }

// CORREÇÃO APLICADA: Esta função já preenche o nome para edição.
function openSubchatModal(id = null, name = '') {
    if (subchatModal) {
        subchatModal.classList.remove('hidden');
        subchatIdInput.value = id;
        subchatNameInput.value = name; // Preenche o nome do tópico na caixa de texto
        document.getElementById('subchat-modal-title').textContent = id ? 'Editar Tópico' : 'Criar Tópico';
    } else {
        console.error('ERRO: O elemento com id "subchat-modal" não foi encontrado no HTML!');
    }
}

function closeSubchatModal() { subchatModal.classList.add('hidden'); }
