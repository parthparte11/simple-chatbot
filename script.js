// ============================================
// API CONFIGURATION - ADD YOUR GEMINI API KEY HERE
// ============================================

const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

// Available Gemini Models
const GEMINI_MODELS = {
    FLASH: 'gemini-1.5-flash',           // Fast, efficient for chat
    PRO: 'gemini-1.5-pro',               // Most capable reasoning
    FLASH_8B: 'gemini-1.5-flash-8b'      // Smallest, fastest
};

// API Configuration
const API = {
    name: 'Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: [
        GEMINI_MODELS.FLASH,      // Try Flash first (fastest)
        GEMINI_MODELS.PRO,        // Then Pro (most capable)
        GEMINI_MODELS.FLASH_8B    // Then Flash-8B (fallback)
    ],
    currentModelIndex: 0,
    status: 'offline',
    latency: 0
};

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

    // Check if API key is configured
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        showApiKeyWarning();
    } else {
        // Test the API connection
        setTimeout(testAPIConnection, 1000);
        // Enable start button
        if (startChatBtn) {
            startChatBtn.disabled = false;
            startChatBtn.style.opacity = '1';
            startChatBtn.style.cursor = 'pointer';
        }
    }

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

// Test API connection on load
async function testAPIConnection() {
    console.log('🔍 Testing API connection...');
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API connected successfully');
            
            // Filter for available Gemini models
            const availableModels = data.models
                .filter(model => model.name.includes('gemini'))
                .map(model => model.name.replace('models/', ''));
            
            console.log('📋 Available models:', availableModels);
            
            // Update API models with actually available ones
            if (availableModels.length > 0) {
                API.models = availableModels;
            }
            
            API.status = 'online';
            updateApiStatus();
            updateApiStats('✅ Connected', 'online');
        } else {
            console.warn('⚠️ API connection issue:', response.status);
            API.status = 'degraded';
            updateApiStatus();
            updateApiStats('⚠️ Connection Issue', 'degraded');
        }
    } catch (error) {
        console.error('❌ API connection failed:', error);
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
            <h4>API Status</h4>
            <div class="status">${message}</div>
            <div class="latency">⏱️ ${API.latency}ms</div>
        </div>
    `;
}

function showApiKeyWarning() {
    const statsContainer = document.getElementById('apiStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card offline">
                <h4>🔑 API Key Required</h4>
                <div class="status">Please add your Gemini API key</div>
                <div class="latency">1. Get a key at: aistudio.google.com/apikey</div>
                <div class="latency">2. Edit script.js</div>
                <div class="latency">3. Replace YOUR_GEMINI_API_KEY</div>
            </div>
        `;
    }
    
    // Disable chat button
    const startBtn = document.getElementById('startChatBtn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
        startBtn.style.cursor = 'not-allowed';
    }
}

// ============================================
// API CALL
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

    // Try each model in sequence
    for (let attempt = 0; attempt < API.models.length; attempt++) {
        const currentModel = API.models[attempt];
        
        try {
            console.log(`Attempting with model: ${currentModel}`);
            
            const response = await fetch(`${API.endpoint}/${currentModel}:generateContent?key=${GEMINI_API_KEY}`, {
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
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_ONLY_HIGH"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_ONLY_HIGH"
                        }
                    ]
                })
            });

            API.latency = Date.now() - startTime;
            lastRequestTime = Date.now();

            if (response.ok) {
                const data = await response.json();
                
                if (data.candidates && data.candidates.length > 0) {
                    if (data.candidates[0].finishReason === 'SAFETY') {
                        console.log('Response blocked by safety filters');
                        continue;
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
                    API.currentModelIndex = attempt;
                    updateApiStatus();
                    return botResponse;
                }
            } else {
                const errorData = await response.json();
                console.log(`Model ${currentModel} failed:`, errorData.error?.message || response.status);
                
                if (attempt === API.models.length - 1) {
                    throw new Error(errorData.error?.message || 'All models failed');
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.log(`Error with model ${currentModel}:`, error.message);
            
            if (attempt === API.models.length - 1) {
                throw error;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    throw new Error('No models could generate a response');
}

// ============================================
// API STATUS
// ============================================

function updateApiStatus() {
    const statusElement = document.getElementById('activeApiStatus');
    if (!statusElement) return;
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        statusElement.innerHTML = '🔴 No API Key';
        statusElement.style.background = '#ef4444';
    } else if (API.status === 'online') {
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
    
    const isKeyValid = GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';
    const statusColor = !isKeyValid ? '#ef4444' : API.status === 'online' ? '#10b981' : '#f59e0b';
    const statusText = !isKeyValid ? 'No API Key' : API.status === 'online' ? 'Online' : 'Issues Detected';
    const currentModel = API.models[API.currentModelIndex] || 'None';
    
    let modelsList = '';
    API.models.forEach((model, index) => {
        const isCurrent = index === API.currentModelIndex;
        modelsList += `<div style="margin: 5px 0; padding: 5px; background: ${isCurrent ? '#e8f0fe' : 'transparent'}; border-radius: 5px;">
            ${isCurrent ? '➡️ ' : ''}${model} ${isCurrent ? '(active)' : ''}
        </div>`;
    });
    
    detailsList.innerHTML = `
        <div style="padding: 15px;">
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
                <h3 style="margin-bottom: 10px;">🤖 Google Gemini API</h3>
                <p><strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
                <p><strong>Latency:</strong> ${API.latency}ms</p>
                <p><strong>Active Model:</strong> ${currentModel}</p>
                <p><strong>API Key:</strong> ${isKeyValid ? '✅ Configured' : '❌ Not configured'}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">🔄 Available Models:</h4>
                ${modelsList}
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
    
    // Check if API key is configured
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        addMessage('⚠️ **API Key Required**\n\nPlease add your Gemini API key to use the chatbot.\n\n1. Get a free key at: https://aistudio.google.com/apikey\n2. Open script.js\n3. Replace `YOUR_GEMINI_API_KEY` with your actual key', 'bot');
        userInput.value = '';
        return;
    }
    
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
        if (error.message.includes('API key') || error.message.includes('API_KEY_INVALID')) {
            errorMessage += 'Your API key is invalid. Please check your configuration.';
        } else if (error.message.includes('quota') || error.message.includes('exceeded')) {
            errorMessage += 'You have exceeded your API quota. Please try again later.';
        } else if (error.message.includes('not found')) {
            errorMessage += 'The model was not found. Trying alternative models...';
        } else {
            errorMessage += 'An error occurred. Please try again.';
        }
        
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

// Test function
async function testAvailableModels() {
    console.log('🔍 Testing available models...');
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Available models:');
            data.models.forEach(model => {
                console.log(`  - ${model.name}`);
            });
            return data.models;
        }
    } catch (error) {
        console.log('❌ Error testing models:', error);
    }
}

// Make test function available in console
window.testAvailableModels = testAvailableModels;

// Initial status update
setTimeout(() => updateApiStatus(), 1000);