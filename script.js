// ============================================
// API CONFIGURATION - ADD YOUR GEMINI API KEY HERE
// ============================================

const GEMINI_API_KEY = 'AIzaSyDZYI8UU_eTNdFsgRroQOqP-XBaRquDq14'; // Your key

// Available Gemini Models (2026)
const GEMINI_MODELS = {
    FLASH_3: 'gemini-3-flash-preview',        // Fast, efficient for chat
    PRO_3: 'gemini-3.1-pro-preview',          // Most capable reasoning
    FLASH_25: 'gemini-2.5-flash',              // Balanced performance
};

// API Configuration
const API = {
    name: 'Gemini Flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: [
        GEMINI_MODELS.FLASH_3,      // Try Flash 3 first (fastest)
        GEMINI_MODELS.PRO_3,        // Then Pro 3 (most capable)
        GEMINI_MODELS.FLASH_25,      // Then Flash 2.5 (stable)
    ],
    currentModelIndex: 0,
    status: 'online',
    latency: 0
};

// ============================================
// IMPROVED SYSTEM PROMPT FOR BETTER RESPONSES
// ============================================

const SYSTEM_PROMPT = `You are a helpful, friendly, and knowledgeable AI assistant. Follow these guidelines:

1. **Be conversational and natural** - Write like you're talking to a friend
2. **Provide detailed, helpful responses** - Don't be too brief unless asked
3. **Use emojis occasionally** 😊 to make conversations engaging
4. **Ask clarifying questions** when needed
5. **Format responses nicely** - Use bullet points for lists, bold for emphasis
6. **Be honest** - If you don't know something, say so
7. **Stay on topic** but be willing to explore related subjects
8. **Adapt to the user's tone** - Match their formality level

Remember: You're here to have meaningful conversations and provide real value!`;

// Conversation history with better system prompt
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
    },
    {
        role: "model",
        parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant, and I'm really excited to chat with you! I'll do my best to provide helpful, detailed responses and make our conversation enjoyable. What's on your mind today? I'm here to help with questions, creative tasks, analysis, or just to have a interesting conversation! 😊" }]
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
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (listResponse.ok) {
            const data = await listResponse.json();
            console.log('✅ API connected successfully');
            updateApiStatus('online');
        } else {
            console.warn('⚠️ API connection issue');
            updateApiStatus('degraded');
        }
    } catch (error) {
        console.error('❌ API connection failed:', error);
        updateApiStatus('offline');
    }
}

function showApiKeyWarning() {
    const statsContainer = document.getElementById('apiStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card offline" style="background: rgba(239, 68, 68, 0.2); border-left: 4px solid #ef4444;">
                <h4>🔑 API Key Required</h4>
                <div class="status">Please add your Gemini API key</div>
                <div class="latency">1. Go to: aistudio.google.com/apikey</div>
                <div class="latency">2. Create an API key</div>
                <div class="latency">3. Add it to script.js</div>
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
// IMPROVED API CALL WITH BETTER PARAMETERS
// ============================================

async function callGeminiAPI(userMessage) {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - (now - lastRequestTime)));
    }
    
    const startTime = Date.now();
    
    // Add user message to history
    conversationHistory.push({
        role: "user",
        parts: [{ text: userMessage }]
    });

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
                    contents: conversationHistory,
                    generationConfig: {
                        temperature: 0.9,           // Increased for more creativity
                        maxOutputTokens: 800,        // Increased for longer responses
                        topP: 0.95,                  // Higher for more diverse responses
                        topK: 40,
                        candidateCount: 1
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

                    // Add bot response to history
                    conversationHistory.push({
                        role: "model",
                        parts: [{ text: botResponse }]
                    });

                    // Keep conversation history manageable (last 15 exchanges)
                    if (conversationHistory.length > 32) {
                        conversationHistory = [
                            conversationHistory[0], // Keep system prompt
                            conversationHistory[1], // Keep first response
                            ...conversationHistory.slice(-28) // Keep last 14 exchanges
                        ];
                    }

                    API.status = 'online';
                    API.currentModelIndex = attempt;
                    return botResponse;
                }
            } else {
                const errorData = await response.json();
                console.log(`Model ${currentModel} failed:`, errorData.error?.message || response.status);
                
                if (attempt === API.models.length - 1) {
                    throw new Error(`All models failed. Last error: ${errorData.error?.message || 'Unknown error'}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            console.log(`Error with model ${currentModel}:`, error.message);
            
            if (attempt === API.models.length - 1) {
                throw new Error('All available models failed. Please check your API key and internet connection.');
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    throw new Error('No models could generate a response');
}

// ============================================
// API STATUS
// ============================================

function updateApiStatus(status = null) {
    const statusElement = document.getElementById('activeApiStatus');
    if (!statusElement) return;
    
    if (status) {
        API.status = status;
    }
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        statusElement.innerHTML = '🔴 No API Key';
        statusElement.style.background = '#ef4444';
    } else if (API.status === 'online') {
        statusElement.innerHTML = `🟢 Gemini (${API.latency}ms)`;
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
    // Reset conversation history but keep improved system prompt
    conversationHistory = [
        {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }]
        },
        {
            role: "model",
            parts: [{ text: "Hi there! 👋 I'm your friendly AI assistant, and I'm really excited to chat with you! I'll do my best to provide helpful, detailed responses and make our conversation enjoyable. What's on your mind today? I'm here to help with questions, creative tasks, analysis, or just to have a interesting conversation! 😊" }]
        }
    ];
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="message bot">
            <div class="message-content">
                👋 Chat cleared! I'm ready for our new conversation. What would you like to talk about? I'm here to help with detailed answers and engaging discussions! 😊
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
    
    detailsList.innerHTML = `
        <div style="padding: 15px;">
            <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 10px;">
                <h3 style="margin-bottom: 10px; color: #333;">🤖 Google Gemini API</h3>
                <p><strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span></p>
                <p><strong>Latency:</strong> ${API.latency}ms</p>
                <p><strong>Active Model:</strong> ${currentModel}</p>
                <p><strong>API Key:</strong> ${isKeyValid ? '✅ Configured' : '❌ Not configured'}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #333;">⚙️ Current Settings:</h4>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 5px;">✓ Temperature: 0.9 (More creative)</li>
                    <li style="margin-bottom: 5px;">✓ Max Tokens: 800 (Longer responses)</li>
                    <li style="margin-bottom: 5px;">✓ Top P: 0.95 (Diverse responses)</li>
                </ul>
            </div>
            
            <div>
                <h4 style="margin-bottom: 10px; color: #333;">📝 Tips for Better Responses:</h4>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin-bottom: 8px;">• Ask detailed questions</li>
                    <li style="margin-bottom: 8px;">• Specify if you want longer answers</li>
                    <li style="margin-bottom: 8px;">• The more context, the better!</li>
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
        
        updateApiStatus();
        
    } catch (error) {
        console.error('API Error:', error);
        
        document.getElementById('typingIndicator').style.display = 'none';
        
        let errorMessage = '⚠️ **Error**\n\n';
        if (error.message.includes('API key')) {
            errorMessage += 'Your API key is invalid. Please check your configuration.';
        } else if (error.message.includes('quota')) {
            errorMessage += 'You have exceeded your API quota. Please try again later.';
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
    
    // Format the message with better styling
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
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        if (listResponse.ok) {
            const data = await listResponse.json();
            console.log('✅ Available models:');
            data.models.forEach(model => {
                console.log(`  - ${model.name}`);
            });
        }
    } catch (error) {
        console.log('❌ Error testing models:', error);
    }
}

// Make test function available
window.testAvailableModels = testAvailableModels;

// Initial status update
setTimeout(() => updateApiStatus(), 1000);
