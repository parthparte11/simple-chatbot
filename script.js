// ============================================
// LOAD API KEY FROM .ENV FILE
// ============================================

// For local development, we need to load the .env file
// This requires a simple local server (explained in Step 6)

// We'll use a fallback approach - you'll manually set this for now
// Later we'll use a proper server
const GEMINI_API_KEY = 'YOUR_KEY_HERE'; // You'll replace this manually for now

// ============================================
// API CONFIGURATION
// ============================================

const API = {
    name: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    availableModels: [],
    currentModelIndex: 0,
    status: 'online',
    latency: 0
};

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are a helpful, friendly, and knowledgeable AI assistant. Follow these guidelines:
1. Be conversational and natural - Write like you're talking to a friend
2. Provide detailed, helpful responses
3. Use emojis occasionally 😊
4. Ask clarifying questions when needed
5. Format responses nicely - Use bullet points for lists
6. Be honest - If you don't know something, say so`;

// Conversation history
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
    },
    {
        role: "model",
        parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant. What would you like to chat about today?" }]
    }
];

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

// ============================================
// DISCOVER AVAILABLE MODELS
// ============================================

async function discoverAvailableModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (response.ok) {
            const data = await response.json();
            API.availableModels = data.models
                .filter(model => model.name.includes('gemini'))
                .map(model => model.name.replace('models/', ''));
            console.log('✅ Available models:', API.availableModels);
        }
    } catch (error) {
        console.error('Model discovery failed:', error);
        API.availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];
    }
}

// ============================================
// API CALL FUNCTION
// ============================================

async function callGeminiAPI(userMessage) {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - (now - lastRequestTime)));
    }
    
    const startTime = Date.now();
    
    conversationHistory.push({
        role: "user",
        parts: [{ text: userMessage }]
    });

    const modelsToTry = API.availableModels.length > 0 ? API.availableModels : ['gemini-1.5-flash'];

    for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
        const currentModel = modelsToTry[attempt];
        
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: conversationHistory,
                    generationConfig: {
                        temperature: 0.9,
                        maxOutputTokens: 800,
                        topP: 0.95
                    }
                })
            });

            API.latency = Date.now() - startTime;
            lastRequestTime = Date.now();

            if (response.ok) {
                const data = await response.json();
                const botResponse = data.candidates[0].content.parts[0].text;

                conversationHistory.push({
                    role: "model",
                    parts: [{ text: botResponse }]
                });

                if (conversationHistory.length > 20) {
                    conversationHistory = [
                        conversationHistory[0],
                        conversationHistory[1],
                        ...conversationHistory.slice(-16)
                    ];
                }

                return botResponse;
            }
        } catch (error) {
            console.log(`Model ${currentModel} failed:`, error);
        }
    }
    
    throw new Error('All models failed');
}

// ============================================
// DOM EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const startChatBtn = document.getElementById('startChatBtn');
    const homeBtn = document.getElementById('homeBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');

    if (GEMINI_API_KEY === 'YOUR_KEY_HERE') {
        alert('⚠️ Please add your Gemini API key to script.js first!\n\n1. Get a key from: https://aistudio.google.com/apikey\n2. Replace "YOUR_KEY_HERE" with your actual key');
        return;
    }

    discoverAvailableModels();

    if (startChatBtn) startChatBtn.addEventListener('click', startChat);
    if (homeBtn) homeBtn.addEventListener('click', goHome);
    if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (userInput) {
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !this.disabled) sendMessage();
        });
    }
});

// ============================================
// CHAT FUNCTIONS
// ============================================

function startChat() {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'block';
    document.getElementById('userInput').focus();
}

function goHome() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatContainer').style.display = 'none';
}

function clearChat() {
    conversationHistory = [
        conversationHistory[0],
        {
            role: "model",
            parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant. What would you like to chat about today?" }]
        }
    ];
    
    document.getElementById('chatMessages').innerHTML = `
        <div class="message bot">
            <div class="message-content">👋 Chat cleared! I'm ready for our new conversation.</div>
            <div class="timestamp">Just now</div>
        </div>
    `;
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    
    if (message === '') return;
    
    addMessage(message, 'user');
    userInput.value = '';
    
    userInput.disabled = true;
    document.getElementById('sendButton').disabled = true;
    document.getElementById('typingIndicator').style.display = 'block';
    
    try {
        const botResponse = await callGeminiAPI(message);
        document.getElementById('typingIndicator').style.display = 'none';
        addMessage(botResponse, 'bot');
    } catch (error) {
        document.getElementById('typingIndicator').style.display = 'none';
        addMessage('⚠️ Error: Could not get response. Please try again.', 'bot');
    }
    
    userInput.disabled = false;
    document.getElementById('sendButton').disabled = false;
    userInput.focus();
}

function addMessage(message, sender) {
    const chatMessages = document.getElementById('chatMessages');
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.innerHTML = `
        <div class="message-content">${message.replace(/\n/g, '<br>')}</div>
        <div class="timestamp">${timestamp}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}