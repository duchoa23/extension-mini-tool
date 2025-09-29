// Popup JavaScript cho Screenshot Extension
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📸 Screenshot popup loaded');
    
    // Lấy tab hiện tại
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab) {
        showStatus('Không thể truy cập tab hiện tại', 'error');
        return;
    }

    // Setup event listeners
    setupEventListeners(tab);
    
    // Hiển thị thông tin
    showStatus('Sẵn sàng chụp ảnh', 'success');
});

function setupEventListeners(tab) {
    // Screenshot button
    document.getElementById('takeScreenshot').addEventListener('click', async () => {
        console.log('📸 Screenshot requested');
        await handleScreenshot(tab.id);
    });
    
    document.getElementById('performOCR').addEventListener('click', async () => {
        console.log('🔍 OCR requested');
        await handleOCR(tab.id);
    });
    
    document.getElementById('performWordPress').addEventListener('click', async () => {
        console.log('🔐 WordPress Password requested');
        await handleWordPress();
    });

    // Options link - show inline options
    document.getElementById('openOptions').addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (!tab) {
                console.error('No active tab found');
                return;
            }

            // Send message to background to show options inline
            await chrome.runtime.sendMessage({
                type: 'SHOW_OPTIONS_INLINE',
                tabId: tab.id
            });
            
            window.close();
        } catch (error) {
            console.error('Error showing options inline:', error);
            // Fallback to regular options page
            chrome.runtime.openOptionsPage();
            window.close();
        }
    });
}

async function handleScreenshot(tabId) {
    try {
        showLoading(true);
        showStatus('Đang chụp ảnh màn hình...', 'loading');
        
        // Gửi message tới background script
        const response = await chrome.runtime.sendMessage({
            type: 'CAPTURE_SCREENSHOT',
            tabId: tabId
        });
        
        if (response.success) {
            showStatus('✅ Chụp ảnh thành công!', 'success');
            
            // Đóng popup sau 1 giây
            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            throw new Error('Screenshot failed');
        }
        
    } catch (error) {
        console.error('Screenshot error:', error);
        showStatus('❌ Lỗi chụp ảnh: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleOCR(tabId) {
    try {
        showLoading(true);
        showStatus('Chọn vùng để OCR...', 'loading');
        
        // Gửi message tới background script
        const response = await chrome.runtime.sendMessage({
            type: 'PERFORM_OCR',
            tabId: tabId
        });
        
        if (response.success) {
            showStatus('✅ Đã kích hoạt region selector!', 'success');
            
            // Đóng popup ngay để không che phủ region selector
            setTimeout(() => {
                window.close();
            }, 500);
        } else {
            throw new Error('OCR failed');
        }
        
    } catch (error) {
        console.error('OCR error:', error);
        showStatus('❌ Lỗi OCR: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleWordPress() {
    try {
        showLoading(true);
        showStatus('Đang tạo WordPress password...', 'loading');
        
        // Gửi message tới background script
        const response = await chrome.runtime.sendMessage({
            type: 'PERFORM_WORDPRESS'
        });
        
        if (response.success) {
            showStatus('✅ WordPress password đã được tạo!', 'success');
            
            // Đóng popup sau 1 giây
            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            throw new Error('WordPress password generation failed');
        }
        
    } catch (error) {
        console.error('WordPress error:', error);
        showStatus('❌ Lỗi WordPress: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.display = 'block';
    
    // Reset classes
    statusEl.className = 'status';
    
    // Add type class
    if (type === 'success') {
        statusEl.classList.add('success');
    } else if (type === 'error') {
        statusEl.classList.add('error');
    }
    
    // Auto hide sau 3 giây nếu không phải loading
    if (type !== 'loading') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    const buttons = document.querySelectorAll('.btn');
    
    if (show) {
        loadingEl.style.display = 'block';
        buttons.forEach(btn => btn.disabled = true);
    } else {
        loadingEl.style.display = 'none';
        buttons.forEach(btn => btn.disabled = false);
    }
}
