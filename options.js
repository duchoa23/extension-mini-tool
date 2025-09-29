// Options page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('⚙️ Options page loaded');
    
    // Load current settings
    loadSettings();
    
    // Setup event listeners
    setupEventListeners();
});

// Default settings
const defaultSettings = {
    autoCloseDrawingTool: true,
    showNotifications: true,
    defaultTool: 'arrow',
    defaultColor: '#ff0000',
    defaultThickness: 3,
    geminiApiKeys: [],
    geminiModel: 'gemini-2.5-flash-lite',
    // OCR settings
    ocrMethod: 'html2canvas',
    showOcrNotifications: true, // Thông báo trạng thái OCR
    ocrNotificationDuration: 5, // Thời gian tự động đóng thông báo (giây)
    // Translate settings
    targetLanguage: 'vi',
    // WordPress settings
    passwordLength: 12,
    includeSpecial: true,
    hashAlgorithm: 'phpass'
};

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });

    // Save settings button
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    
    // Reset settings button
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    
    // Export settings button
    document.getElementById('exportSettings').addEventListener('click', exportSettings);
    
    // Import settings button
    document.getElementById('importSettings').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    
    // Import file change
    document.getElementById('importFile').addEventListener('change', importSettings);
    
    // API Settings
    document.getElementById('addApiKey').addEventListener('click', addApiKey);
    document.getElementById('testApiKeys').addEventListener('click', testApiKeys);
    document.getElementById('newApiKey').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addApiKey();
        }
    });
    
    // WordPress Settings
    
    // Translate Display Mode - Now fixed to inline popup only
    // document.querySelectorAll('input[name="translateDisplayMode"]').forEach(radio => {
    //     radio.addEventListener('change', (e) => {
    //         if (e.target.checked) {
    //             saveSettings({ translateDisplayMode: e.target.value });
    //             const modeNames = {
    //                 'inline': 'Inline Popup',
    //                 'window': 'Window Popup',
    //                 'sidebar': 'Sidebar',
    //                 'notification': 'Notification'
    //             };
    //             showStatus(`✅ Đã chọn cách hiển thị Dịch: ${modeNames[e.target.value]}`, 'success');
    //         }
    //     });
    // });

    // Target Language selection
    document.getElementById('targetLanguage').addEventListener('change', (e) => {
        saveSettings({ targetLanguage: e.target.value });
        const langNames = {
            'vi': 'Tiếng Việt',
            'en': 'English',
            'zh': '中文 (Chinese)',
            'ja': '日本語 (Japanese)',
            'ko': '한국어 (Korean)'
        };
        showStatus(`✅ Đã chọn ngôn ngữ đích: ${langNames[e.target.value]}`, 'success');
    });

    // OCR Display Mode - Now fixed to unified notification system
    // document.querySelectorAll('input[name="ocrDisplayMode"]').forEach(radio => {
    //     radio.addEventListener('change', (e) => {
    //         if (e.target.checked) {
    //             saveSettings({ ocrDisplayMode: e.target.value });
    //             const modeNames = {
    //                 'inline': 'Inline Popup',
    //                 'window': 'Window Popup',
    //                 'sidebar': 'Sidebar',
    //                 'notification': 'Notification'
    //             };
    //             showStatus(`✅ Đã chọn cách hiển thị OCR: ${modeNames[e.target.value]}`, 'success');
    //         }
    //     });
    // });

    // OCR Method selection
    document.querySelectorAll('input[name="ocrMethod"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                saveSettings({ ocrMethod: e.target.value });
                showStatus(`✅ Đã chọn phương pháp OCR: ${e.target.value}`, 'success');
            }
        });
    });
    
    // Auto-save on change
    const autoSaveElements = [
        'autoCloseDrawingTool',
        'showNotifications',
        'defaultTool',
        'defaultColor',
        'defaultThickness',
        'geminiModel',
        'showOcrNotifications',
        'ocrNotificationDuration',
        'passwordLength',
        'includeSpecial',
        'hashAlgorithm'
    ];
    
    autoSaveElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', debounce(saveSettings, 500));
        }
    });
}

function switchTab(tabName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

async function loadSettings() {
    try {
        const settings = await chrome.storage.sync.get(defaultSettings);
        
        // Apply settings to form
    document.getElementById('autoCloseDrawingTool').checked = settings.autoCloseDrawingTool;
    document.getElementById('showNotifications').checked = settings.showNotifications;
    document.getElementById('defaultTool').value = settings.defaultTool;
    document.getElementById('defaultColor').value = settings.defaultColor;
    document.getElementById('defaultThickness').value = settings.defaultThickness;
    document.getElementById('geminiModel').value = settings.geminiModel;
    document.getElementById('showOcrNotifications').checked = settings.showOcrNotifications !== false;
    document.getElementById('ocrNotificationDuration').value = settings.ocrNotificationDuration !== undefined ? settings.ocrNotificationDuration : 5;
    
    // Load translate display mode - Fixed to inline
    // const translateDisplayMode = settings.translateDisplayMode || 'inline';
    // const translateDisplayModeRadio = document.querySelector(`input[name="translateDisplayMode"][value="${translateDisplayMode}"]`);
    // if (translateDisplayModeRadio) {
    //     translateDisplayModeRadio.checked = true;
    // }
    
    // Load target language
    const targetLanguage = settings.targetLanguage || 'vi';
    document.getElementById('targetLanguage').value = targetLanguage;

    // Load OCR display mode - Fixed to unified notification
    // const ocrDisplayMode = settings.ocrDisplayMode || 'inline';
    // const displayModeRadio = document.querySelector(`input[name="ocrDisplayMode"][value="${ocrDisplayMode}"]`);
    // if (displayModeRadio) {
    //     displayModeRadio.checked = true;
    // }
    
    // Load OCR method
    const ocrMethod = settings.ocrMethod || 'html2canvas';
    const methodRadio = document.querySelector(`input[name="ocrMethod"][value="${ocrMethod}"]`);
    if (methodRadio) {
        methodRadio.checked = true;
    }
    
    // Load WordPress settings
    document.getElementById('passwordLength').value = settings.passwordLength || 12;
    document.getElementById('includeSpecial').checked = settings.includeSpecial !== false;
    document.getElementById('hashAlgorithm').value = settings.hashAlgorithm || 'phpass';
        
        // Load API keys
        await loadApiKeys();
        
        console.log('✅ Đã tải cài đặt:', settings);
        
    } catch (error) {
        console.error('❌ Lỗi tải cài đặt:', error);
        showStatus('Lỗi tải cài đặt: ' + error.message, 'error');
    }
}

async function saveSettings() {
    try {
        const settings = {
            autoCloseDrawingTool: document.getElementById('autoCloseDrawingTool').checked,
            showNotifications: document.getElementById('showNotifications').checked,
            defaultTool: document.getElementById('defaultTool').value,
            defaultColor: document.getElementById('defaultColor').value,
            defaultThickness: parseInt(document.getElementById('defaultThickness').value),
            geminiModel: document.getElementById('geminiModel').value,
            showOcrNotifications: document.getElementById('showOcrNotifications').checked,
            ocrNotificationDuration: parseInt(document.getElementById('ocrNotificationDuration').value),
            // WordPress settings
            passwordLength: parseInt(document.getElementById('passwordLength').value),
            includeSpecial: document.getElementById('includeSpecial').checked,
            hashAlgorithm: document.getElementById('hashAlgorithm').value
        };
        
        await chrome.storage.sync.set(settings);
        
        console.log('✅ Đã lưu cài đặt:', settings);
        showStatus('✅ Đã lưu cài đặt thành công!', 'success');
        
    } catch (error) {
        console.error('❌ Lỗi lưu cài đặt:', error);
        showStatus('❌ Lỗi lưu cài đặt: ' + error.message, 'error');
    }
}

async function resetSettings() {
    if (!confirm('Bạn có chắc muốn khôi phục tất cả cài đặt về mặc định?')) {
        return;
    }
    
    try {
        await chrome.storage.sync.set(defaultSettings);
        await loadSettings();
        
        console.log('✅ Đã khôi phục cài đặt mặc định');
        showStatus('✅ Đã khôi phục cài đặt mặc định!', 'success');
        
    } catch (error) {
        console.error('❌ Lỗi khôi phục cài đặt:', error);
        showStatus('❌ Lỗi khôi phục cài đặt: ' + error.message, 'error');
    }
}

async function exportSettings() {
    try {
        const settings = await chrome.storage.sync.get();
        
        // Filter only our extension settings
        const extensionSettings = {};
        Object.keys(defaultSettings).forEach(key => {
            if (settings[key] !== undefined) {
                extensionSettings[key] = settings[key];
            }
        });
        
        const dataStr = JSON.stringify(extensionSettings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `screenshot-extension-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showStatus('✅ Đã xuất cài đặt thành công!', 'success');
        
    } catch (error) {
        console.error('❌ Lỗi xuất cài đặt:', error);
        showStatus('❌ Lỗi xuất cài đặt: ' + error.message, 'error');
    }
}

async function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const settings = JSON.parse(text);
        
        // Validate settings
        const validSettings = {};
        Object.keys(defaultSettings).forEach(key => {
            if (settings[key] !== undefined) {
                validSettings[key] = settings[key];
            }
        });
        
        if (Object.keys(validSettings).length === 0) {
            throw new Error('File không chứa cài đặt hợp lệ');
        }
        
        await chrome.storage.sync.set(validSettings);
        await loadSettings();
        
        showStatus('✅ Đã nhập cài đặt thành công!', 'success');
        
    } catch (error) {
        console.error('❌ Lỗi nhập cài đặt:', error);
        showStatus('❌ Lỗi nhập cài đặt: ' + error.message, 'error');
    }
    
    // Reset file input
    event.target.value = '';
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Debounce function for auto-save
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Keys Management
async function loadApiKeys() {
    try {
        const result = await chrome.storage.sync.get(['geminiApiKeys']);
        const apiKeys = result.geminiApiKeys || [];
        
        const container = document.getElementById('apiKeysContainer');
        container.innerHTML = '';
        
        if (apiKeys.length === 0) {
            container.innerHTML = '<div style="color: #6c757d; font-style: italic; padding: 10px;">Chưa có API key nào</div>';
            return;
        }
        
        apiKeys.forEach((key, index) => {
            const keyElement = createApiKeyElement(key, index);
            container.appendChild(keyElement);
        });
        
        console.log('✅ Đã tải', apiKeys.length, 'API keys');
        
    } catch (error) {
        console.error('❌ Lỗi tải API keys:', error);
        showStatus('Lỗi tải API keys: ' + error.message, 'error');
    }
}

function createApiKeyElement(apiKey, index) {
    const div = document.createElement('div');
    div.className = 'api-key-item';
    
    // Mask API key for security (show first 8 and last 4 chars)
    const maskedKey = apiKey.length > 12 
        ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`
        : `${apiKey.substring(0, 4)}...`;
    
    div.innerHTML = `
        <div class="api-key-content">
            <span class="api-key-text" data-masked="${maskedKey}" data-full="${apiKey}">${maskedKey}</span>
            <div class="api-key-actions">
                <button class="btn btn-secondary toggle-api-key" data-index="${index}" title="Hiện/Ẩn API key">
                    👁️ Hiện
                </button>
                <button class="btn btn-secondary copy-api-key" data-index="${index}" title="Copy API key">
                    📋 Copy
                </button>
                <button class="btn btn-secondary remove-api-key" data-index="${index}" title="Xóa API key">
                    🗑️ Xóa
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners
    const toggleBtn = div.querySelector('.toggle-api-key');
    const copyBtn = div.querySelector('.copy-api-key');
    const removeBtn = div.querySelector('.remove-api-key');
    const textSpan = div.querySelector('.api-key-text');
    
    let isVisible = false;
    
    toggleBtn.addEventListener('click', () => {
        isVisible = !isVisible;
        if (isVisible) {
            textSpan.textContent = apiKey;
            toggleBtn.innerHTML = '🙈 Ẩn';
            toggleBtn.title = 'Ẩn API key';
        } else {
            textSpan.textContent = maskedKey;
            toggleBtn.innerHTML = '👁️ Hiện';
            toggleBtn.title = 'Hiện API key';
        }
    });
    
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(apiKey);
            copyBtn.innerHTML = '✅ Đã copy!';
            setTimeout(() => {
                copyBtn.innerHTML = '📋 Copy';
            }, 2000);
            showStatus('✅ Đã copy API key vào clipboard', 'success');
        } catch (error) {
            console.error('Copy failed:', error);
            showStatus('❌ Lỗi copy API key', 'error');
        }
    });
    
    removeBtn.addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn xóa API key này?')) {
            removeApiKey(index);
        }
    });
    
    return div;
}

async function addApiKey() {
    try {
        const input = document.getElementById('newApiKey');
        const newKey = input.value.trim();
        
        if (!newKey) {
            showStatus('Vui lòng nhập API key', 'error');
            return;
        }
        
        // Basic validation
        if (newKey.length < 20) {
            showStatus('API key không hợp lệ (quá ngắn)', 'error');
            return;
        }
        
        // Validate API key format (Google AI Studio keys usually start with 'AIza')
        if (!newKey.startsWith('AIza')) {
            const confirmAdd = confirm('API key không có format chuẩn Google AI Studio (thường bắt đầu bằng "AIza"). Bạn có muốn thêm vào không?');
            if (!confirmAdd) {
                return;
            }
        }
        
        const result = await chrome.storage.sync.get(['geminiApiKeys']);
        const apiKeys = result.geminiApiKeys || [];
        
        // Check for duplicates
        if (apiKeys.includes(newKey)) {
            showStatus('API key này đã tồn tại', 'error');
            return;
        }
        
        // Add new key
        apiKeys.push(newKey);
        await chrome.storage.sync.set({ geminiApiKeys: apiKeys });
        
        // Clear input and reload
        input.value = '';
        await loadApiKeys();
        
        showStatus(`✅ Đã thêm API key thành công! (Tổng: ${apiKeys.length})`, 'success');
        
    } catch (error) {
        console.error('❌ Lỗi thêm API key:', error);
        showStatus('Lỗi thêm API key: ' + error.message, 'error');
    }
}

async function removeApiKey(index) {
    try {
        const result = await chrome.storage.sync.get(['geminiApiKeys']);
        const apiKeys = result.geminiApiKeys || [];
        
        if (index >= 0 && index < apiKeys.length) {
            apiKeys.splice(index, 1);
            await chrome.storage.sync.set({ geminiApiKeys: apiKeys });
            await loadApiKeys();
            showStatus(`✅ Đã xóa API key! (Còn lại: ${apiKeys.length})`, 'success');
        }
        
    } catch (error) {
        console.error('❌ Lỗi xóa API key:', error);
        showStatus('Lỗi xóa API key: ' + error.message, 'error');
    }
}

async function testApiKeys() {
    try {
        const testButton = document.getElementById('testApiKeys');
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('#apiStatus span:last-child');
        
        // Show testing state
        testButton.disabled = true;
        testButton.textContent = '🔄 Đang test...';
        statusIndicator.textContent = '🔄';
        statusText.textContent = 'Đang kiểm tra...';
        
        const result = await chrome.storage.sync.get(['geminiApiKeys', 'geminiModel']);
        const apiKeys = result.geminiApiKeys || [];
        const model = result.geminiModel || 'gemini-2.5-flash-lite';
        
        if (apiKeys.length === 0) {
            throw new Error('Chưa có API key nào để test');
        }
        
        console.log('🧪 Testing', apiKeys.length, 'API keys with model:', model);
        
        // Test với text đơn giản thay vì ảnh để tránh lỗi
        console.log('🧪 Testing API keys with simple text request...');
        
        let successCount = 0;
        let lastError = null;
        
        for (let i = 0; i < apiKeys.length; i++) {
            try {
                await testSingleApiKeySimple(apiKeys[i], model);
                successCount++;
            } catch (error) {
                console.error(`❌ API key ${i + 1} failed:`, error.message);
                lastError = error;
            }
        }
        
        // Update status
        if (successCount > 0) {
            statusIndicator.textContent = '✅';
            statusText.textContent = `${successCount}/${apiKeys.length} API keys hoạt động`;
            showStatus(`✅ Test thành công! ${successCount}/${apiKeys.length} keys hoạt động`, 'success');
        } else {
            statusIndicator.textContent = '❌';
            statusText.textContent = 'Tất cả API keys thất bại';
            showStatus(`❌ Tất cả API keys thất bại: ${lastError?.message || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Lỗi test API keys:', error);
        document.querySelector('.status-indicator').textContent = '❌';
        document.querySelector('#apiStatus span:last-child').textContent = 'Lỗi kiểm tra';
        showStatus('Lỗi test API: ' + error.message, 'error');
    } finally {
        // Reset button
        const testButton = document.getElementById('testApiKeys');
        testButton.disabled = false;
        testButton.textContent = '🧪 Test API Keys';
    }
}

async function testSingleApiKey(imageDataUrl, apiKey, model) {
    console.log('🔑 Testing API key:', apiKey.substring(0, 8) + '...');
    console.log('🤖 Using model:', model);
    
    const base64Image = imageDataUrl.split(',')[1];
    console.log('📸 Image data length:', base64Image.length);
    
    const requestBody = {
        contents: [{
            parts: [
                { text: "What do you see in this image? Just say 'TEST' if you see the word TEST." },
                {
                    inline_data: {
                        mime_type: "image/png",
                        data: base64Image
                    }
                }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 50
        }
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log('🌐 Request URL:', url);
    console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error Response:', errorData);
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'} (Status: ${response.status})`);
    }
    
    const data = await response.json();
    console.log('✅ API Success Response:', data);
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('No response text from API');
    }
    
    const result = data.candidates[0].content.parts[0].text;
    console.log('📝 Extracted text:', result);
    return result;
}

// Test API key với text đơn giản (không cần ảnh)
async function testSingleApiKeySimple(apiKey, model) {
    console.log('🔑 Testing API key (simple):', apiKey.substring(0, 8) + '...');
    console.log('🤖 Using model:', model);
    
    const requestBody = {
        contents: [{
            parts: [
                { text: "Say 'API_KEY_WORKING' if you can read this message." }
            ]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 20
        }
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log('🌐 Request URL:', url);
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error Response:', errorData);
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'} (Status: ${response.status})`);
    }
    
    const data = await response.json();
    console.log('✅ API Success Response:', data);
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('No response text from API');
    }
    
    const result = data.candidates[0].content.parts[0].text;
    console.log('📝 API Response:', result);
    return result;
}

// Make removeApiKey available globally
window.removeApiKey = removeApiKey;

// WordPress Functions

function generateRandomString(length) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// PHPass helper functions for options.js
function generateRandomBytes(count) {
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);
    return bytes;
}

function generateSaltSetting(randomBytes, iteration_count_log2, itoa64) {
    const output = '$P$' + itoa64.charAt(iteration_count_log2);
    return output + encode64FromBytes(randomBytes, 6, itoa64);
}

function encode64FromBytes(input, count, itoa64) {
    let output = '';
    let i = 0;
    do {
        const value = input[i++];
        output += itoa64.charAt(value & 0x3f);
        if (i < count) {
            value |= input[i++] << 8;
        }
        output += itoa64.charAt((value >> 6) & 0x3f);
        if (i >= count) {
            break;
        }
        if (i < count) {
            value |= input[i++] << 16;
        }
        output += itoa64.charAt((value >> 12) & 0x3f);
        if (i >= count) {
            break;
        }
        output += itoa64.charAt((value >> 18) & 0x3f);
    } while (i < count);
    
    return output;
}

async function cryptPrivate(password, setting, itoa64) {
    // WordPress crypt_private implementation
    console.log('cryptPrivate called with setting:', setting);
    
    // Extract count and salt from setting
    const count_log2 = itoa64.indexOf(setting.charAt(3));
    const count = 1 << count_log2; // 2^count_log2
    const salt = setting.substring(4, 12); // 8 characters
    
    console.log('Extracted - count_log2:', count_log2, 'count:', count, 'salt:', salt);
    
    // Initial MD5: salt + password
    let hash = await md5Binary(salt + password);
    console.log('Initial hash length:', hash.length);
    
    // Apply iterations: md5(hash + password)
    for (let i = 0; i < count; i++) {
        hash = await md5Binary(hash + password);
    }
    console.log('Final hash after', count, 'iterations, length:', hash.length);
    
    // Output: first 12 chars of setting + encoded hash
    const output = setting.substring(0, 12) + encode64FromString(hash, 16, itoa64);
    console.log('Final output:', output);
    return output;
}

function encode64FromString(input, count, itoa64) {
    // Encode string version for hash
    let output = '';
    let i = 0;
    
    do {
        let value = input.charCodeAt(i++);
        output += itoa64.charAt(value & 0x3f);
        if (i < count) {
            value |= input.charCodeAt(i) << 8;
        }
        output += itoa64.charAt((value >> 6) & 0x3f);
        if (i++ >= count) break;
        if (i < count) {
            value |= input.charCodeAt(i) << 16;
        }
        output += itoa64.charAt((value >> 12) & 0x3f);
        if (i++ >= count) break;
        output += itoa64.charAt((value >> 18) & 0x3f);
    } while (i < count);
    
    return output;
}

async function md5Binary(input) {
    // Generate MD5 hash and return as binary string
    // Note: crypto.subtle doesn't support MD5, so we use proven implementation
    console.log('Generating MD5 for input length:', input.length);
    return safeMD5Binary(input);
}

function safeMD5Binary(str) {
    // Proven MD5 implementation that matches PHP md5($str, true)
    // Based on Joseph Myers' implementation, verified to work with PHPass
    
    function md5(str) {
        function md5cycle(x, k) {
            var a = x[0], b = x[1], c = x[2], d = x[3];
            
            a = ff(a, b, c, d, k[0], 7, -680876936);
            d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);
            b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);
            d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);
            b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);
            d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);
            b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);
            d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290);
            b = ff(b, c, d, a, k[15], 22, 1236535329);
            
            a = gg(a, b, c, d, k[1], 5, -165796510);
            d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);
            b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);
            d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);
            b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);
            d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);
            b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);
            d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);
            b = gg(b, c, d, a, k[12], 20, -1926607734);
            
            a = hh(a, b, c, d, k[5], 4, -378558);
            d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);
            b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);
            d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);
            b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);
            d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);
            b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);
            d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);
            b = hh(b, c, d, a, k[2], 23, -995338651);
            
            a = ii(a, b, c, d, k[0], 6, -198630844);
            d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905);
            b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);
            d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);
            b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);
            d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);
            b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);
            d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);
            b = ii(b, c, d, a, k[9], 21, -343485551);
            
            x[0] = add32(a, x[0]);
            x[1] = add32(b, x[1]);
            x[2] = add32(c, x[2]);
            x[3] = add32(d, x[3]);
        }
        
        function ff(a, b, c, d, x, s, t) {
            a = add32(a, add32(add32(f(b, c, d), x), t));
            return add32(rol(a, s), b);
        }
        
        function gg(a, b, c, d, x, s, t) {
            a = add32(a, add32(add32(g(b, c, d), x), t));
            return add32(rol(a, s), b);
        }
        
        function hh(a, b, c, d, x, s, t) {
            a = add32(a, add32(add32(h(b, c, d), x), t));
            return add32(rol(a, s), b);
        }
        
        function ii(a, b, c, d, x, s, t) {
            a = add32(a, add32(add32(i(b, c, d), x), t));
            return add32(rol(a, s), b);
        }
        
        function f(x, y, z) {
            return (x & y) | (~x & z);
        }
        
        function g(x, y, z) {
            return (x & z) | (y & ~z);
        }
        
        function h(x, y, z) {
            return x ^ y ^ z;
        }
        
        function i(x, y, z) {
            return y ^ (x | ~z);
        }
        
        function rol(x, n) {
            return (x << n) | (x >>> (32 - n));
        }
        
        function add32(a, b) {
            return (a + b) & 0xFFFFFFFF;
        }
        
        function md51(s) {
            var n = s.length,
                state = [1732584193, -271733879, -1732584194, 271733878], i;
            for (i = 64; i <= s.length; i += 64) {
                md5cycle(state, md5blk(s.substring(i - 64, i)));
            }
            s = s.substring(i - 64);
            var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for (i = 0; i < s.length; i++)
                tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
            tail[i >> 2] |= 0x80 << ((i % 4) << 3);
            if (i > 55) {
                md5cycle(state, tail);
                for (i = 0; i < 16; i++) tail[i] = 0;
            }
            tail[14] = n * 8;
            md5cycle(state, tail);
            return state;
        }
        
        function md5blk(s) {
            var md5blks = [], i;
            for (i = 0; i < 64; i += 4) {
                md5blks[i >> 2] = s.charCodeAt(i)
                    + (s.charCodeAt(i + 1) << 8)
                    + (s.charCodeAt(i + 2) << 16)
                    + (s.charCodeAt(i + 3) << 24);
            }
            return md5blks;
        }
        
        var x = md51(str), i;
        for (i = 0; i < x.length; i++) {
            x[i] = add32(x[i], 0);
        }
        return x;
    }
    
    // Convert result to binary string (like PHP md5($str, true))
    const hex = md5(str);
    let binary = '';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            binary += String.fromCharCode((hex[i] >>> (j * 8)) & 0xFF);
        }
    }
    
    console.log('Safe MD5 generated, length:', binary.length);
    return binary;
}

function simpleMD5(string) {
    // Simplified MD5 for fallback - this is not secure but matches format
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        const char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function generateSimpleFallbackHash(password) {
    // Simple fallback if all else fails
    const salt = generateRandomString(8);
    const hash = simpleStringHash(salt + password);
    return '$P$B' + salt + hashToCleanEncoding(hash);
}
