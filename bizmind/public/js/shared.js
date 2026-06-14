// Shared utilities and API functions
const API_BASE = '/api';

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'API call failed');
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showNotification(error.message, 'error');
        throw error;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#EF4444' : type === 'success' ? '#10B981' : '#0078D4'};
        color: white;
        border-radius: 8px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN');
}

// Load and initialize AI Chat on all pages
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        loadDashboard();
    } else if (window.location.pathname === '/warehouse.html') {
        loadWarehouse();
    } else if (window.location.pathname === '/transactions.html') {
        loadTransactions();
    }
    
    // Initialize AI Chat
    initAIChat();
});

function initAIChat() {
    if (document.querySelector('.chat-widget')) return;
    
    const chatHTML = `
        <div class="chat-widget">
            <div class="chat-toggle" onclick="toggleChat()">
                <div class="chat-icon">🤖</div>
            </div>
            <div class="chat-container" id="chatContainer">
                <div class="chat-header">
                    🤖 BizMind AI Assistant
                    <small style="display: block; font-size: 11px;">Multi-language | Reasoning Agent</small>
                </div>
                <div class="chat-messages" id="chatMessages">
                    <div class="chat-message assistant">
                        Hello! I'm BizMind AI. I can help you manage your business. Try:
                        <br/>• "Add expense 500 for cleaning"
                        <br/>• "Reduce stock of rice by 10 units"
                        <br/>• "Show me last month profit"
                        <br/><br/>I understand Hindi, English & Hinglish!
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" class="chat-input" id="chatInput" placeholder="Type your command here..." onkeypress="if(event.key==='Enter') sendChatMessage()">
                    <button class="voice-btn" onclick="startVoiceInput()">🎤</button>
                    <button class="btn btn-primary" style="padding: 8px 16px;" onclick="sendChatMessage()">Send</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', chatHTML);
}

let currentReasoningSteps = null;

function toggleChat() {
    const container = document.getElementById('chatContainer');
    container.classList.toggle('active');
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    addChatMessage(message, 'user');
    input.value = '';
    
    const loadingMsg = addChatMessage('Thinking... 🤔', 'assistant', true);
    
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, sessionId: Date.now().toString() })
        });
        
        const data = await response.json();
        loadingMsg.remove();
        
        if (data.needsConfirmation) {
            addChatMessage(data.message + ' (Type "confirm" or "cancel")', 'assistant');
            window.pendingCommand = message;
            return;
        }
        
        let responseText = data.message;
        if (data.reasoningSteps) {
            responseText += '\n\n📋 Reasoning Steps:\n';
            data.reasoningSteps.forEach(step => {
                responseText += `${step.step}. ${step.action} ✓\n`;
            });
        }
        
        addChatMessage(responseText, 'assistant');
        
        // Refresh data if needed
        if (window.location.pathname === '/' && typeof loadDashboard === 'function') {
            loadDashboard();
        } else if (window.location.pathname === '/warehouse.html' && typeof loadWarehouse === 'function') {
            loadWarehouse();
        } else if (window.location.pathname === '/transactions.html' && typeof loadTransactions === 'function') {
            loadTransactions();
        }
        
    } catch (error) {
        loadingMsg.remove();
        addChatMessage('Sorry, I encountered an error. Please try again.', 'assistant');
    }
}

function addChatMessage(text, sender, isLoading = false) {
    const container = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    messageDiv.style.whiteSpace = 'pre-wrap';
    
    if (isLoading) {
        messageDiv.innerHTML = '<div class="loading"></div>';
        messageDiv.id = 'loading-message';
    } else {
        messageDiv.textContent = text;
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    return messageDiv;
}

function startVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showNotification('Voice input not supported in this browser', 'error');
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'hi-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.start();
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chatInput').value = transcript;
        sendChatMessage();
    };
    
    recognition.onerror = (event) => {
        showNotification('Voice recognition error: ' + event.error, 'error');
    };
}