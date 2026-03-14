// ============================================
// CLOUDFLARE WORKER PROXY URL - YOUR SECURE ENDPOINT
// ============================================

const PROXY_URL = 'https://gemini-proxy.parthparte217.workers.dev';

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are a helpful, friendly, and knowledgeable AI assistant. Follow these guidelines:

1. Be conversational and natural - Write like you're talking to a friend
2. Provide detailed, helpful responses - Don't be too brief unless asked
3. Use emojis occasionally to make conversations engaging
4. Ask clarifying questions when needed
5. Format responses nicely - Use bullet points for lists
6. Be honest - If you don't know something, say so
7. Stay on topic but be willing to explore related subjects

Remember: You're here to have meaningful conversations and provide real value!`;

// Conversation history
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
    },
    {
        role: "model",
        parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant! I'm here to help with questions, creative tasks, analysis, or just to have an interesting conversation. What's on your mind today? 😊" }]
    }
];

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

// API status tracking
const API = {
    status: 'online',
    latency: 0,
    model: 'gemini-1.5-flash (via proxy)'
};

// ============================================
// DOM ELEMENTS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const homePage = document.getElementById('homePage');
    const chatContainer = document.getElementById('chatContainer');
    const startChatBtn = document.getElementById('startChatBtn');
    const homeBtn = document.getElementById('homeBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const statusBtn = document.getElementById('statusBtn');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const apiModal = document.getElementById('apiModal');

    // Test the proxy connection
    setTimeout(testProxyConnection, 1000);

    // Event Listeners
    if (startChatBtn) {
        startChatBtn.addEventListener('click', startChat);
    }

    if (homeBtn) {
        homeBtn.addEventListener('click', goHome);
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }

    if (statusBtn) {
        statusBtn.addEventListener('click', showApiStatus);
    }

    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    if (userInput) {
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !this.disabled) {
                sendMessage();
            }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeApiModal);
    }

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === apiModal) {
            closeApiModal();
        }
    });
});

// Test proxy connection on load
async function testProxyConnection() {
    console.log('🔍 Testing proxy connection...');
    
    try {
        // Simple test ping
        const testResponse = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: "Hello" }]
                }],
                generationConfig: {
                    maxOutputTokens: 10
                }
            })
        });
        
        if (testResponse.ok) {
            console.log('✅ Proxy connected successfully');
            API.status = 'online';
            updateApiStatus();
            updateApiStats('✅ Connected', 'online');
        } else {
            console.warn('⚠️ Proxy connection issue:', testResponse.status);
            API.status = 'degraded';
            updateApiStatus();
            updateApiStats('⚠️ Connection Issue', 'degraded');
        }
    } catch (error) {
        console.error('❌ Proxy connection failed:', error);
        API.status = 'offline';
        updateApiStatus();
        updateApiStats('❌ Disconnected', 'offline');
    }
}

function updateApiStats(message, status) {
    const statsContainer = document.getElementById('apiStats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stat-card ${status}">
            <h4>Proxy Status</h4>
            <div class="status">${message}</div>
            <div class="latency">⏱️ ${API.latency}ms</div>
            <div class="latency">🔒 Secure (Cloudflare)</div>
        </div>
    `;
}

// ============================================
// API CALL THROUGH PROXY
// ============================================

async function callGeminiAPI(userMessage) {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - (now - lastRequestTime)));
    }
    
    const startTime = Date.now();
    
    // Add user message to history
    const updatedHistory = [...conversationHistory, {
        role: "user",
        parts: [{ text: userMessage }]
    }];

    try {
        console.log('Sending request to proxy...');
        
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: updatedHistory,
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 800,
                    topP: 0.95,
                    topK: 40
                }
            })
        });

        API.latency = Date.now() - startTime;
        lastRequestTime = Date.now();

        if (response.ok) {
            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0) {
                if (data.candidates[0].finishReason === 'SAFETY') {
                    console.log('Response blocked by safety filters');
                    return "I apologize, but I couldn't generate a response due to safety guidelines. Could you please rephrase your question?";
                }

                const botResponse = data.candidates[0].content.parts[0].text;

                // Update conversation history
                conversationHistory = updatedHistory;
                conversationHistory.push({
                    role: "model",
                    parts: [{ text: botResponse }]
                });

                // Keep conversation history manageable
                if (conversationHistory.length > 20) {
                    conversationHistory = [
                        conversationHistory[0], // Keep system prompt
                        conversationHistory[1], // Keep first response
                        ...conversationHistory.slice(-16) // Keep last 8 exchanges
                    ];
                }

                API.status = 'online';
                updateApiStatus();
                return botResponse;
            } else {
                throw new Error('No response from API');
            }
        } else {
            const errorData = await response.json();
            console.error('Proxy error:', errorData);
            throw new Error(errorData.error || 'Proxy request failed');
        }
    } catch (error) {
        console.error('Error calling proxy:', error);
        API.status = 'degraded';
        updateApiStatus();
        throw error;
    }
}

// ============================================
// API STATUS
// ============================================

function updateApiStatus() {
    const statusElement = document.getElementById('activeApiStatus');
    if (!statusElement) return;
    
    if (API.status === 'online') {
        statusElement.innerHTML = `🟢 Online (${API.latency}ms)`;
        statusElement.style.background = '#10b981';
    } else if (API.status === 'degraded') {
        statusElement.innerHTML = '🟡 Connection Issue';
        statusElement.style.background = '#f59e0b';
    } else {
        statusElement.innerHTML = '🔴 Offline';
        statusElement.style.background = '#ef4444';
    }
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

function startChat() {
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'block';
    document.getElementById('userInput').focus();
    updateApiStatus();
}

function goHome() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('chatContainer').style.display = 'none';
}

function clearChat() {
    // Reset conversation history
    conversationHistory = [
        {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }]
        },
        {
            role: "model",
            parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant! What would you like to chat about today? 😊" }]
        }
    ];
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message bot">
            <div class="message-content">
                👋 Chat cleared! I'm ready for our new conversation. What would you like to talk about?
            </div>
            <div class="timestamp">Just now</div>
        </div>
    `;
}

function showApiStatus() {
    const modal = document.getElementById('apiModal');
    const detailsList = document.getElementById('apiDetailsList');
    
    detailsList.innerHTML = `
        <div style="padding: 15px;">
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
                <h3 style="margin-bottom: 10px;">🔒 Secure Proxy Setup</h3>
                <p><strong>Status:</strong> <span style="color: ${API.status === 'online' ? '#10b981' : '#f59e0b'};">${API.status === 'online' ? '✅ Online' : '⚠️ Issues'}</span></p>
                <p><strong>Latency:</strong> ${API.latency}ms</p>
                <p><strong>Model:</strong> ${API.model}</p>
                <p><strong>Proxy URL:</strong> ${PROXY_URL}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">🛡️ Security Features:</h4>
                <ul style="list-style: none; padding: 0;">
                    <li>✓ API key hidden on Cloudflare</li>
                    <li>✓ No key exposed to users</li>
                    <li>✓ Safe to share with friends</li>
                    <li>✓ CORS enabled for all origins</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">⚙️ Settings:</h4>
                <ul style="list-style: none; padding: 0;">
                    <li>✓ Temperature: 0.9 (Creative)</li>
                    <li>✓ Max Tokens: 800 (Long responses)</li>
                    <li>✓ Rate Limit: 1 second between requests</li>
                </ul>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeApiModal() {
    document.getElementById('apiModal').style.display = 'none';
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
        console.error('API Error:', error);
        
        document.getElementById('typingIndicator').style.display = 'none';
        
        let errorMessage = '⚠️ **Error**\n\n';
        errorMessage += 'Could not connect to the AI service. Please try again.\n\n';
        errorMessage += 'If this persists, the proxy might be temporarily unavailable.';
        
        addMessage(errorMessage, 'bot');
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
    
    // Format the message
    const formattedMessage = message
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/- (.*?)(<br>|$)/g, '• $1<br>');
    
    messageDiv.innerHTML = `
        <div class="message-content">
            ${formattedMessage}
        </div>
        <div class="timestamp">${timestamp}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initial status update
setTimeout(() => updateApiStatus(), 1000);