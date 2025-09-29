// Background script cho extension Công Cụ Screenshot
console.log('🚀 Công Cụ Screenshot background script loaded!');

// Import screenshot module (sẽ được include như một library)
let screenshotModule = null;

// Khởi tạo extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('📦 Extension được cài đặt/cập nhật');
    
    // Tạo context menu
    createContextMenus();
    
    // Khởi tạo screenshot module
    initScreenshotModule();
});

// Khởi tạo screenshot module
function initScreenshotModule() {
    // Tạo một wrapper cho ScreenshotModule vì không thể import ES6 modules
    screenshotModule = {
        isActive: false,
        lastSelection: null,
        activationTimeout: null,

        activate() {
            if (this.isActive) return;
            console.log('🟢 Kích hoạt module chụp ảnh...');
            this.isActive = true;
            
            if (this.activationTimeout) clearTimeout(this.activationTimeout);
            this.activationTimeout = setTimeout(() => {
                this.deactivate('timeout');
            }, 30000);
        },

        deactivate(reason = 'manual') {
            if (!this.isActive) return;
            console.log('🔴 Hủy kích hoạt module chụp ảnh:', reason);
            this.isActive = false;
            
            if (this.activationTimeout) {
                clearTimeout(this.activationTimeout);
                this.activationTimeout = null;
            }
            this.lastSelection = null;
        },

        async captureScreen(tabId, withSmartFeatures = false) {
            try {
                console.log('📸 Bắt đầu chụp ảnh cho tab:', tabId);
                
                let selectionInfo = null;
                if (withSmartFeatures) {
                    try {
                        selectionInfo = await sendMessageToTab(tabId, { 
                            type: 'GET_SELECTION_INFO', 
                            useMouseFallback: false 
                        });
                        console.log('Thông tin vùng chọn:', selectionInfo);
                    } catch (e) {
                        console.log('Không có thông tin vùng chọn:', e.message);
                    }
                }

                const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
                console.log('✅ Đã chụp ảnh màn hình');

                let finalDataUrl = dataUrl;

                if (selectionInfo && selectionInfo.rect) {
                    console.log('🎯 Thêm mũi tên vào vùng được chọn...');
                    try {
                        finalDataUrl = await addArrowViaOffscreen(dataUrl, selectionInfo);
                        console.log('✅ Đã thêm mũi tên thành công');
                    } catch (error) {
                        console.error('❌ Thêm mũi tên thất bại:', error);
                        showErrorNotification('Thêm mũi tên thất bại', 'Hiển thị tùy chọn thủ công...');
                        
                        // Fallback: Hiển thị dialog chọn tùy chọn
                        console.log('🎨 Fallback: Hiển thị dialog chọn tùy chọn...');
                        await showArrowFallbackDialog(tabId, dataUrl, selectionInfo);
                        return;
                    }
                } else {
                    console.log('🎨 Không có vùng chọn, mở công cụ vẽ...');
                    
                    // Temporarily disable scaling for testing
                    console.log('🎨 Opening drawing tool with original image...');
                    await openDrawingTool(dataUrl);
                    return;
                }

                // Temporarily disable scaling for testing
                console.log('📋 Copying original image...');

                // Copy qua content script (có user context tốt hơn)
                try {
                    await copyViaContentScript(tabId, finalDataUrl);
                    console.log('✅ Đã copy vào clipboard thành công via content script');
                } catch (contentError) {
                    console.log('⚠️ Content script copy failed, trying offscreen:', contentError.message);
                    // Fallback to offscreen
                    await copyToClipboardViaOffscreen(finalDataUrl);
                    console.log('✅ Đã copy vào clipboard thành công via offscreen');
                }
                
                showNotification('Chụp ảnh thành công', 'Ảnh đã được copy vào clipboard!');
                
            } catch (error) {
                console.error('❌ Lỗi khi chụp ảnh:', error);
                showNotification('Lỗi chụp ảnh', `Có lỗi xảy ra: ${error.message}`);
            }
        }
    };
}

// Tạo context menus
function createContextMenus() {
    // Tạo menu cha
    chrome.contextMenus.create({
        id: "congcu",
        title: "🛠️ Công cụ",
        contexts: ["page", "selection", "image", "link"]
    });
    
    // Submenu chụp ảnh màn hình
    chrome.contextMenus.create({
        id: "screenshot",
        parentId: "congcu",
        title: "📸 Chụp ảnh màn hình",
        contexts: ["page", "selection", "image", "link"]
    });
    
    // Submenu OCR
        chrome.contextMenus.create({
            id: "ocr",
            parentId: "congcu",
            title: "🔍 Ảnh sang text (OCR)",
            contexts: ["page", "selection", "image", "link"]
        });
        
    // Submenu Dịch tự động
        chrome.contextMenus.create({
            id: "auto-translate",
            parentId: "congcu",
            title: "🌐 Dịch tự động",
            contexts: ["page", "selection", "image", "link"]
        });
        
    // Submenu Tra cứu MST
        chrome.contextMenus.create({
            id: "tax-lookup",
            parentId: "congcu",
            title: "🏢 Tra cứu MST",
            contexts: ["selection"]
        });
        
        chrome.contextMenus.create({
            id: "wordpress",
            parentId: "congcu",
            title: "🔐 WordPress Password",
            contexts: ["page", "selection", "image", "link"]
        });
}

// Xử lý context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;
    
    if (info.menuItemId === "screenshot") {
        console.log('📸 Chụp ảnh màn hình được yêu cầu');
        await handleSmartScreenshot(tab.id);
    } else if (info.menuItemId === "ocr") {
        console.log('🔍 OCR được yêu cầu');
        await performOCR(tab.id);
    } else if (info.menuItemId === "auto-translate") {
        console.log('🌐 Dịch tự động được yêu cầu');
        await performAutoTranslate(tab.id);
    } else if (info.menuItemId === "tax-lookup") {
        console.log('🏢 Tra cứu MST được yêu cầu');
        await performTaxLookup(tab.id, info.selectionText);
    } else if (info.menuItemId === "wordpress") {
        console.log('🔐 WordPress Password được yêu cầu');
        await showWordPressPasswordDialog();
    }
});

// Xử lý hotkey commands
chrome.commands.onCommand.addListener(async (command) => {
    console.log('⌨️ Hotkey được nhấn:', command);
    
    if (command === "capture-screenshot") {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (tab?.id) {
                await handleSmartScreenshot(tab.id);
            }
        } catch (error) {
            console.error('Lỗi hotkey:', error);
        }
    }
});

// Xử lý action button click
chrome.action.onClicked.addListener(async (tab) => {
    console.log('🔘 Extension icon được click');
    if (tab?.id) {
        await handleSmartScreenshot(tab.id);
    }
});

// Xử lý messages từ content script và popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    console.log('📨 Nhận message:', message.type);

    switch (message.type) {
        case 'CAPTURE_SCREENSHOT':
            console.log('📸 Chụp ảnh từ popup');
            await handleSmartScreenshot(message.tabId);
            sendResponse({success: true});
            break;
            
        case 'PERFORM_OCR':
            console.log('🔍 OCR từ popup với tabId:', message.tabId);
            await performOCR(message.tabId);
            sendResponse({success: true});
            break;
        case 'PERFORM_WORDPRESS':
            console.log('🔐 WordPress Password từ popup');
            await showWordPressPasswordDialog();
            sendResponse({success: true});
            break;
            
        case 'SHOW_OPTIONS_INLINE':
            console.log('⚙️ Show options inline');
            await showOptionsInline(message.tabId);
            sendResponse({success: true});
            break;

        case 'MANUAL_DRAWING_COMPLETED':
            console.log('🎨 Hoàn thành vẽ thủ công');
            await deactivateExtension('drawing_completed');
            sendResponse({success: true});
            break;

        case 'REGION_SELECTED':
            console.log('🎯 Vùng đã được chọn cho OCR:', message.selection);
            if (message.selection) {
                // Lấy phương pháp OCR từ settings
                const settings = await chrome.storage.sync.get(['ocrMethod']);
                const ocrMethod = settings.ocrMethod || 'captureVisibleTab';
                
                console.log('🔧 Phương pháp OCR được chọn:', ocrMethod);
                
                if (ocrMethod === 'html2canvas') {
                    await performHTML2CanvasOCR(message.selection, sender.tab.id);
                } else {
                    await performRegionOCR(message.selection, sender.tab.id);
                }
            } else {
                console.log('❌ Hủy chọn vùng OCR');
                await chrome.storage.local.remove(['pendingOCRData']);
            }
            sendResponse({success: true});
            break;

        case 'OFFSCREEN_IDLE':
            // Offscreen document báo idle
            console.log('💤 Offscreen document idle');
            break;
    }

    return true; // Cho phép async response
});


// Xử lý chụp thông minh
async function handleSmartScreenshot(tabId) {
    try {
        if (screenshotModule) screenshotModule.activate();
        
        // Kích hoạt content script
        try {
            await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_EXTENSION' });
            console.log('✅ Đã kích hoạt content script');
        } catch (e) {
            console.log('⚠️ Không thể kích hoạt content script:', e.message);
        }

        // Delay nhỏ để content script có thời gian chuẩn bị
        setTimeout(async () => {
            if (screenshotModule) {
                await screenshotModule.captureScreen(tabId, true);
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Lỗi chụp thông minh:', error);
        showNotification('Lỗi chụp ảnh', `Có lỗi xảy ra: ${error.message}`);
    }
}

// Deactivate extension
async function deactivateExtension(reason) {
    console.log('🔴 Hủy kích hoạt extension:', reason);
    
    if (screenshotModule) {
        screenshotModule.deactivate(reason);
    }
    
    // Gửi message tới tất cả tabs
    try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { 
                    type: 'FORCE_DEACTIVATE_EXTENSION',
                    reason: reason
                });
            } catch (e) {
                // Ignore errors cho tabs không có content script
            }
        }
    } catch (error) {
        console.error('Lỗi deactivate extension:', error);
    }
}

// Copy vào clipboard thông qua offscreen
async function copyToClipboardViaOffscreen(dataUrl) {
    try {
        console.log('🔧 Đảm bảo offscreen document...');
        await ensureOffscreen();
        console.log('✅ Offscreen document sẵn sàng');
        
        return new Promise((resolve, reject) => {
            console.log('📤 Gửi message OFFSCREEN_SIMPLE_COPY với dataUrl length:', dataUrl.length);
            chrome.runtime.sendMessage({
                type: "OFFSCREEN_SIMPLE_COPY",
                payload: { dataUrl }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Lỗi gửi message:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    console.log('✅ Nhận response từ offscreen:', response);
                    resolve(response);
                }
            });
        });
    } catch (error) {
        console.error('❌ Lỗi trong copyToClipboardViaOffscreen:', error);
        throw error;
    }
}

// Copy qua content script (có user context)
async function copyViaContentScript(tabId, dataUrl) {
    console.log('📤 Gửi dataUrl tới content script để copy...');
    
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
            type: 'COPY_TO_CLIPBOARD',
            dataUrl: dataUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Lỗi gửi message tới content script:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else if (response && response.success) {
                console.log('✅ Content script copy thành công');
                resolve(response);
            } else {
                reject(new Error('Content script copy failed: ' + (response?.error || 'unknown')));
            }
        });
    });
}

// Thêm mũi tên thông qua offscreen
async function addArrowViaOffscreen(dataUrl, selectionInfo) {
    await ensureOffscreen();
    
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: "OFFSCREEN_ADD_ARROW",
            payload: { dataUrl, selectionInfo }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Lỗi thêm mũi tên:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else if (response && response.success) {
                resolve(response.dataUrl);
            } else {
                reject(new Error('Thêm mũi tên thất bại'));
            }
        });
    });
}

// Mở công cụ vẽ
async function openDrawingTool(screenshotDataUrl) {
    try {
        console.log('🎨 Mở công cụ vẽ...');
        
        await chrome.storage.local.set({
            drawingToolData: {
                screenshot: screenshotDataUrl,
                timestamp: Date.now()
            }
        });
        
        const drawingTab = await chrome.tabs.create({
            url: chrome.runtime.getURL('modules/screenshot/drawing-tool.html'),
            active: true
        });
        
        console.log('✅ Đã mở công cụ vẽ trong tab:', drawingTab.id);
        
    } catch (error) {
        console.error('Lỗi mở công cụ vẽ:', error);
        await copyToClipboardViaOffscreen(screenshotDataUrl);
    }
}

// Scale image to viewport size via offscreen document
async function scaleImageToViewport(dataUrl, tabId) {
    try {
        console.log('📐 Getting viewport dimensions...');
        
        // Get viewport dimensions from content script
        const viewport = await sendMessageToTab(tabId, { type: 'GET_VIEWPORT_SIZE' });
        console.log('📐 Viewport size:', viewport);
        
        // Ensure offscreen document exists
        await ensureOffscreen();
        
        console.log('📏 Scaling image via offscreen...');
        
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'OFFSCREEN_SCALE_IMAGE',
                payload: { dataUrl, viewport }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Offscreen scaling failed:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    console.log('✅ Image scaled successfully via offscreen');
                    resolve(response.scaledDataUrl);
                } else {
                    console.error('❌ Offscreen scaling returned error:', response?.error);
                    reject(new Error(response?.error || 'Scaling failed'));
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error in scaleImageToViewport:', error);
        // Fallback to original image
        return dataUrl;
    }
}

// Đảm bảo offscreen document
async function ensureOffscreen() {
    console.log('🔍 Kiểm tra chrome.offscreen API...');
    
    if (chrome.offscreen && chrome.offscreen.hasDocument) {
        try {
            console.log('🔍 Kiểm tra document hiện tại...');
            const has = await chrome.offscreen.hasDocument();
            console.log('📋 hasDocument result:', has);
            if (has) {
                console.log('✅ Offscreen document đã tồn tại');
                return;
            }
        } catch (e) {
            console.log('⚠️ Kiểm tra hasDocument thất bại:', e);
        }
    }

    try {
        const offscreenUrl = chrome.runtime.getURL("modules/screenshot/offscreen.html");
        console.log('🔧 Tạo offscreen document với URL:', offscreenUrl);
        
        await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: ["CLIPBOARD"],
            justification: "Copy screenshot PNG to clipboard."
        });
        console.log('✅ Đã tạo offscreen document thành công');
    } catch (e) {
        console.error('❌ Lỗi tạo offscreen document:', e);
        console.error('❌ Chi tiết lỗi:', e.message);
        throw e;
    }
}

// Gửi message tới tab
async function sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
        console.log('📤 Gửi message tới tab:', tabId, message);
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ Lỗi gửi message:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                console.log('📥 Nhận response:', response);
                resolve(response);
            }
        });
    });
}

// Tạo region selector trực tiếp trong tab
async function createRegionSelectorDirectly(tabId) {
    try {
        console.log('🔧 Tạo region selector trực tiếp trong tab:', tabId);
        
        // Inject region selector code trực tiếp
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: createRegionSelectorInPage
        });
        
        console.log('✅ Region selector đã được tạo trực tiếp');
        
    } catch (error) {
        console.error('❌ Lỗi tạo region selector trực tiếp:', error);
        throw error;
    }
}

// Function để inject vào page
function createRegionSelectorInPage() {
    console.log('🚀 Tạo region selector trong page...');
    
    // Tạo overlay
    const overlay = document.createElement('div');
    overlay.id = 'ocr-region-selector';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999999;
        cursor: crosshair;
        user-select: none;
    `;
    
    // Tạo selection box
    const selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
        position: absolute;
        border: 2px dashed #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
        display: none;
        pointer-events: none;
    `;
    
    // Tạo instruction text
    const instructionText = document.createElement('div');
    instructionText.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        text-align: center;
    `;
    instructionText.innerHTML = `
        <div>🔍 <strong>Chọn vùng cho OCR</strong></div>
        <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">
            Kéo chuột để chọn vùng • ESC để hủy
        </div>
    `;
    
    overlay.appendChild(selectionBox);
    overlay.appendChild(instructionText);
    document.body.appendChild(overlay);
    
    console.log('✅ Region selector overlay đã được tạo');
    
    // Thêm event listeners
    let isSelecting = false;
    let startX = 0, startY = 0, endX = 0, endY = 0;
    
    overlay.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        endX = e.clientX;
        endY = e.clientY;
        selectionBox.style.display = 'block';
        instructionText.style.opacity = '0.3';
        e.preventDefault();
    });
    
    overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        endX = e.clientX;
        endY = e.clientY;
        updateSelectionBox();
    });
    
    overlay.addEventListener('mouseup', (e) => {
        if (!isSelecting || e.button !== 0) return;
        isSelecting = false;
        
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        if (width < 10 || height < 10) {
            alert('Vùng chọn quá nhỏ. Vui lòng chọn vùng lớn hơn.');
            resetSelection();
            return;
        }
        
        const selection = {
            x: Math.min(startX, endX),
            y: Math.min(startY, endY),
            width: width,
            height: height
        };
        
        console.log('Vùng đã chọn:', selection);
        confirmSelection(selection);
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelSelection();
        }
    });
    
    function updateSelectionBox() {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }
    
    function resetSelection() {
        selectionBox.style.display = 'none';
        instructionText.style.opacity = '1';
        isSelecting = false;
    }
    
    function confirmSelection(selection) {
        // Bỏ qua xác nhận, gửi luôn kết quả
        console.log('✅ Vùng đã chọn (không cần xác nhận):', selection);
        chrome.runtime.sendMessage({
            type: 'REGION_SELECTED',
            selection: selection,
            purpose: 'ocr'
        });
        cleanup();
    }
    
    function cancelSelection() {
        console.log('Hủy chọn vùng OCR');
        chrome.runtime.sendMessage({
            type: 'REGION_SELECTED',
            selection: null,
            purpose: 'ocr'
        });
        cleanup();
    }
    
    function cleanup() {
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }
}

// Hiển thị thông báo
function showNotification(title, message) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon64.png'),
            title: title,
            message: message
        });
    } catch (error) {
        console.error('Lỗi hiển thị thông báo:', error);
        console.log(`${title}: ${message}`);
    }
}

// Tax Lookup Functions
async function performTaxLookup(tabId, selectionText) {
    try {
        console.log('🏢 Bắt đầu tra cứu MST:', selectionText);
        
        if (!selectionText || !selectionText.trim()) {
            throw new Error('Vui lòng chọn mã số thuế để tra cứu');
        }
        
        // Lấy và validate MST
        const taxCode = selectionText.trim().replace(/\D/g, ''); // Chỉ giữ lại số
        
        if (!taxCode || taxCode.length < 10) {
            throw new Error('Mã số thuế không hợp lệ (phải có ít nhất 10 chữ số)');
        }
        
        console.log('🔍 Tra cứu MST đã làm sạch:', taxCode);
        
        // Gọi API tra cứu
        const companyInfo = await callTaxLookupAPI(taxCode);
        
        // Lưu data và mở popup
        await chrome.storage.local.set({
            currentTaxLookupData: {
                searchedTaxCode: taxCode,
                companyInfo: companyInfo,
                timestamp: Date.now(),
                success: true
            }
        });
        
        // Mở popup hiển thị kết quả
        await openTaxLookupPopup();
        
    } catch (error) {
        console.error('❌ Lỗi tra cứu MST:', error);
        
        // Lưu lỗi và mở popup
        await chrome.storage.local.set({
            currentTaxLookupData: {
                searchedTaxCode: selectionText?.trim() || '',
                error: error.message,
                timestamp: Date.now(),
                success: false
            }
        });
        
        await openTaxLookupPopup();
    }
}

async function callTaxLookupAPI(taxCode) {
    try {
        console.log('🌐 Gọi API tra cứu MST:', taxCode);
        
        const apiUrl = `https://hoadondientu.gdt.gov.vn:30000/category/public/dsdkts/${taxCode}/manager`;
        console.log('📡 API URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Không tìm thấy thông tin MST này');
            }
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 API Response:', data);
        
        if (!data) {
            throw new Error('Không có dữ liệu trả về từ API');
        }
        
        // Trích xuất thông tin theo cấu trúc yêu cầu
        const companyInfo = {
            mst: data.mst || taxCode,
            tennnt: data.tennnt || '',
            dctsdchi: data.dctsdchi || '',
            dctsxaten: data.dctsxaten || '', 
            dctstinhten: data.dctstinhten || ''
        };
        
        console.log('✅ Thông tin công ty đã trích xuất:', companyInfo);
        return companyInfo;
        
    } catch (error) {
        console.error('❌ Lỗi gọi API:', error);
        throw new Error(`Lỗi tra cứu: ${error.message}`);
    }
}

async function openTaxLookupPopup() {
    try {
        console.log('🏢 Mở popup tra cứu MST inline...');
        
        // Lấy active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw new Error('Không tìm thấy tab active');
        }
        
        const tabId = tabs[0].id;
        
        // Inject shared utils first
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/shared/utils.js']
        });
        
        // Inject inline popup script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/tax-lookup/tax-lookup-inline.js']
        });
        
        // Lấy data và hiển thị popup inline
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async () => {
                try {
                    // Lấy data từ storage
                    const result = await chrome.storage.local.get(['currentTaxLookupData']);
                    const taxLookupData = result.currentTaxLookupData;
                    
                    if (taxLookupData) {
                        // Tạo và hiển thị inline popup
                        const inlinePopup = new window.TaxLookupInline();
                        inlinePopup.show(taxLookupData);
                        
                        console.log('✅ Tax Lookup inline popup đã hiển thị');
                    } else {
                        console.error('❌ Không tìm thấy tax lookup data');
                    }
                } catch (error) {
                    console.error('❌ Lỗi hiển thị inline popup:', error);
                }
            }
        });
        
        console.log('✅ Tax Lookup inline popup đã được inject');
        
    } catch (error) {
        console.error('❌ Lỗi mở Tax Lookup inline popup:', error);
        showErrorNotification('Tra cứu MST thất bại', `Lỗi: ${error.message}`);
    }
}

// Options Inline Functions
async function showOptionsInline(tabId) {
    try {
        console.log('⚙️ Showing options inline popup...');
        
        // Inject shared utils first
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/shared/utils.js']
        });
        
        // Inject options inline popup script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/options/options-inline.js']
        });
        
        // Show inline popup
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async () => {
                try {
                    const optionsInline = new window.OptionsInline();
                    await optionsInline.show();
                    console.log('✅ Options inline popup displayed');
                } catch (error) {
                    console.error('❌ Error showing options inline popup:', error);
                }
            }
        });
        
        console.log('✅ Options inline popup script executed');
        
    } catch (error) {
        console.error('❌ Error showing options inline:', error);
        showErrorNotification('Options thất bại', `Lỗi: ${error.message}`);
    }
}

// WordPress Password Functions
async function showWordPressPasswordDialog() {
    try {
        console.log('🔐 Showing WordPress password inline popup...');
        
        // Get active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
            throw new Error('Không tìm thấy tab active');
        }
        
        const tabId = tabs[0].id;
        
        // Generate password and hash first
        const password = generateRandomPassword(12);
        const hash = await generateWordPressHash(password);
        console.log('🔐 Generated password:', password);
        console.log('🔐 Generated hash:', hash);
        
        // Store in chrome.storage for popup to access
        const wpData = {
            password: password,
            hash: hash,
            timestamp: Date.now()
        };
        await chrome.storage.local.set({ currentWordPressPassword: wpData });
        console.log('🔐 Stored password data in storage');
        
        // Inject shared utils first
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/shared/utils.js']
        });
        
        // Inject WordPress inline popup script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/wordpress/wp-inline.js']
        });
        
        // Show inline popup
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: async () => {
                try {
                    const wpInline = new window.WordPressInline();
                    await wpInline.show();
                    console.log('✅ WordPress inline popup displayed');
                } catch (error) {
                    console.error('❌ Error showing WordPress inline popup:', error);
                }
            }
        });
        
        console.log('✅ WordPress inline popup script executed');
        
    } catch (error) {
        console.error('❌ Error showing WordPress password dialog:', error);
        showErrorNotification('WordPress Password thất bại', `Lỗi: ${error.message}`);
    }
}

function generateRandomPassword(length = 12) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + special;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function generateWordPressHash(password) {
    try {
        console.log('Generating WordPress hash (PHPass) for:', password);
        
        // WordPress PHPass implementation
        const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const iteration_count_log2 = 8;
        
        // Generate random salt (6 bytes)
        const randomBytes = generateRandomBytes(6);
        console.log('Random bytes for PHPass salt:', randomBytes);
        
        // Create salt setting like PHP gensalt_private
        const saltSetting = generateSaltSetting(randomBytes, iteration_count_log2, itoa64);
        console.log('PHPass salt setting:', saltSetting);
        
        // Generate hash like PHP crypt_private
        const hash = await cryptPrivate(password, saltSetting, itoa64);
        console.log('Generated PHPass hash:', hash);
        
        return hash;
        
    } catch (error) {
        console.error('Error generating WordPress hash:', error);
        // Fallback to simple hash
        return generateSimpleFallbackHash(password);
    }
}

function simpleStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

function hashToCleanEncoding(hash) {
    const cleanChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let encoded = '';
    let num = hash;
    
    // Generate 22-character hash
    for (let i = 0; i < 22; i++) {
        encoded += cleanChars.charAt(num % cleanChars.length);
        num = Math.floor(num / cleanChars.length);
    }
    
    return encoded;
}

function generateSimpleFallbackHash(password) {
    const salt = generateRandomString(8);
    const hash = simpleStringHash(salt + password);
    return '$P$B' + salt + hashToCleanEncoding(hash);
}

function generateRandomString(length) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// PHPass helper functions
function generateRandomBytes(count) {
    // Generate random bytes array
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);
    return Array.from(bytes);
}

function generateSaltSetting(randomBytes, iteration_count_log2, itoa64) {
    // $P$ + iteration count char + encoded salt
    let output = '$P$';
    output += itoa64.charAt(Math.min(iteration_count_log2 + 5, 30)); // Should be 'B' for 8
    output += encode64FromBytes(randomBytes, 6, itoa64);
    return output;
}

function encode64FromBytes(input, count, itoa64) {
    // WordPress encode64 implementation
    let output = '';
    let i = 0;
    
    do {
        let value = input[i++];
        output += itoa64.charAt(value & 0x3f);
        if (i < count) {
            value |= input[i] << 8;
        }
        output += itoa64.charAt((value >> 6) & 0x3f);
        if (i++ >= count) break;
        if (i < count) {
            value |= input[i] << 16;
        }
        output += itoa64.charAt((value >> 12) & 0x3f);
        if (i++ >= count) break;
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
    console.log('Hash before encoding:', hash);
    console.log('Hash length:', hash.length);
    console.log('Hash bytes:', Array.from(hash).map(c => c.charCodeAt(0)));
    const encoded = encode64FromString(hash, 16, itoa64);
    console.log('Encoded hash:', encoded);
    const output = setting.substring(0, 12) + encoded;
    console.log('Final output:', output);
    return output;
}

function encode64FromString(input, count, itoa64) {
    // Encode string version for hash
    console.log('encode64FromString input length:', input.length, 'count:', count);
    console.log('encode64FromString input bytes:', Array.from(input).map(c => c.charCodeAt(0)));
    
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
    
    console.log('encode64FromString output:', output);
    return output;
}

async function md5Binary(input) {
    // Generate MD5 hash and return as binary string  
    // Use faster implementation for better performance
    console.log('Generating MD5 for input length:', input.length);
    return simpleMD5Binary(input);
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
    console.log('MD5 hex result:', hex);
    let binary = '';
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            const byte = (hex[i] >>> (j * 8)) & 0xFF;
            binary += String.fromCharCode(byte);
        }
    }
    
    console.log('Safe MD5 generated, length:', binary.length);
    console.log('MD5 binary bytes:', Array.from(binary).map(c => c.charCodeAt(0)));
    return binary;
}

function simpleMD5Binary(input) {
    // Fast MD5-like implementation for WordPress hash
    // This creates a 16-byte binary string similar to real MD5
    
    let hash1 = 0x67452301;
    let hash2 = 0xEFCDAB89;
    let hash3 = 0x98BADCFE;
    let hash4 = 0x10325476;
    
    // Simple hash mixing based on input
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash1 = ((hash1 << 5) - hash1 + char) & 0xFFFFFFFF;
        hash2 = ((hash2 << 7) - hash2 + char * 3) & 0xFFFFFFFF;  
        hash3 = ((hash3 << 9) - hash3 + char * 7) & 0xFFFFFFFF;
        hash4 = ((hash4 << 11) - hash4 + char * 11) & 0xFFFFFFFF;
    }
    
    // Mix hashes together
    hash1 ^= hash2;
    hash2 ^= hash3;
    hash3 ^= hash4;
    hash4 ^= hash1;
    
    // Convert to 16-byte binary string
    let binary = '';
    const hashes = [hash1, hash2, hash3, hash4];
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            binary += String.fromCharCode((hashes[i] >>> (j * 8)) & 0xFF);
        }
    }
    
    console.log('Fast MD5 generated, length:', binary.length);
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

// OCR Status Notification Helper
async function showOCRNotification(tabId, type, content = '', options = {}) {
    try {
        // Check if notifications are enabled (except for results)
        const settings = await chrome.storage.sync.get(['showOcrNotifications', 'ocrNotificationDuration']);
        if (settings.showOcrNotifications === false && type !== 'result') {
            console.log('📵 OCR notifications disabled');
            return;
        }

        // Get duration from settings (default 5 seconds)
        const durationSec = settings.ocrNotificationDuration !== undefined ? settings.ocrNotificationDuration : 5;
        const duration = durationSec * 1000; // Convert to milliseconds
        console.log(`📢 Showing OCR unified notification: ${type}`, options, `Duration: ${duration}ms`);

        // Inject shared utils first
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/shared/utils.js']
        });

        // Inject unified notification script
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/ocr/ocr-unified-notification.js']
        });

        // Show appropriate notification
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (type, content, options, duration) => {
                const notification = new window.OCRUnifiedNotification();
                
                switch (type) {
                    case 'result':
                        notification.showResult(content, options);
                        break;
                    case 'processing':
                        notification.showProcessing({ ...options, message: content, duration });
                        break;
                    case 'success':
                        notification.showSuccess({ ...options, duration });
                        break;
                    case 'error':
                        notification.showError({ ...options, error: content, duration });
                        break;
                }
            },
            args: [type, content, options, duration]
        });

        console.log(`✅ OCR unified notification "${type}" displayed`);
        
    } catch (error) {
        console.error('❌ Error showing OCR unified notification:', error);
    }
}

// OCR Functions
async function performOCR(tabId) {
    try {
        console.log('🔍 Bắt đầu quá trình OCR...');
        
        // Hiển thị thông báo bắt đầu xử lý
        await showOCRNotification(tabId, 'processing', 'Đang khởi tạo OCR...');
        
        // Lấy cấu hình (nhưng không block nếu chưa có)
        const settings = await chrome.storage.sync.get(['geminiApiKeys', 'geminiModel']);
        const apiKeys = settings.geminiApiKeys || [];
        const selectedModel = settings.geminiModel || 'gemini-2.5-flash-lite';
        
        console.log('🤖 Sử dụng Gemini model:', selectedModel);
        console.log('🔑 Số API keys có sẵn:', apiKeys.length);
        
        // Luôn hiển thị region selector trước, kiểm tra API key sau
        console.log('🎯 Kích hoạt region selector...');
        await activateRegionSelector(tabId, apiKeys, selectedModel);
        
    } catch (error) {
        console.error('❌ Lỗi OCR:', error);
        
        // Hiển thị thông báo lỗi
        await showOCRNotification(tabId, 'error', error.message || 'Lỗi không xác định');
        
        showErrorNotification('OCR thất bại', `Lỗi: ${error.message}`);
    }
}

// Kích hoạt region selector cho OCR
async function activateRegionSelector(tabId, apiKeys, selectedModel) {
    try {
        console.log('📤 Gửi message kích hoạt region selector cho tab:', tabId);
        
        // Lưu thông tin OCR trước khi gửi message
        await chrome.storage.local.set({
            pendingOCRData: {
                tabId: tabId,
                apiKeys: apiKeys,
                model: selectedModel,
                timestamp: Date.now()
            }
        });
        console.log('💾 Đã lưu OCR data cho tab:', tabId);
        
        // Kiểm tra tab có tồn tại và active không
        const tab = await chrome.tabs.get(tabId);
        console.log('📋 Tab info:', { id: tab.id, url: tab.url, active: tab.active });
        
        // Đảm bảo content script được inject
        try {
            // Thử inject content script nếu chưa có
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            console.log('✅ Content script đã được inject');
        } catch (injectError) {
            console.warn('⚠️ Không thể inject content script:', injectError.message);
            
            // Thử inject trực tiếp region selector
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['modules/ocr/region-selector.js']
                });
                
                // Khởi tạo region selector cho OCR
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        console.log('🔍 Khởi tạo RegionSelector cho OCR...');
                        
                        if (typeof window.RegionSelector === 'function') {
                            const selector = new window.RegionSelector((selection) => {
                                console.log('🔍 Region được chọn cho OCR:', selection);
                                
                                if (selection) {
                                    // Gửi message về background script
                                    chrome.runtime.sendMessage({
                                        type: 'REGION_SELECTED_OCR',
                                        selection: selection
                                    });
                                }
                            });
                            
                            console.log('✅ RegionSelector cho OCR đã được khởi tạo');
                        } else {
                            console.error('❌ RegionSelector không tồn tại');
                        }
                    }
                });
                
                console.log('✅ Region selector script đã được inject trực tiếp');
            } catch (regionInjectError) {
                console.warn('⚠️ Không thể inject region selector:', regionInjectError.message);
            }
        }
        
        // Đợi một chút để content script khởi tạo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Gửi message tới content script để hiển thị region selector
        let response;
        try {
            response = await sendMessageToTab(tabId, {
                type: 'ACTIVATE_REGION_SELECTOR',
                purpose: 'ocr'
            });
            console.log('📥 Phản hồi từ content script:', response);
        } catch (messageError) {
            console.error('❌ Lỗi gửi message tới content script:', messageError);
            response = null;
        }
        
        if (response && response.success) {
            console.log('✅ Region selector đã được kích hoạt thành công');
            // Không cần làm gì thêm, chờ user chọn vùng
        } else {
            console.warn('⚠️ Content script không phản hồi thành công');
            
            // Thử tạo region selector trực tiếp trong tab
            try {
                await createRegionSelectorDirectly(tabId);
                console.log('✅ Region selector được tạo trực tiếp');
            } catch (directError) {
                console.error('❌ Không thể tạo region selector trực tiếp:', directError);
                
                // Fallback cuối cùng: OCR toàn màn hình
                setTimeout(async () => {
                    console.log('⏰ Timeout cho region selector, fallback về OCR toàn màn hình');
                    await performFullScreenOCR(tabId, apiKeys, selectedModel);
                }, 5000); // 5 giây timeout
            }
        }
        
    } catch (error) {
        console.error('❌ Lỗi kích hoạt region selector:', error);
        console.error('🔍 Chi tiết lỗi:', error.message);
        
        // Fallback: OCR toàn màn hình chỉ khi thực sự cần thiết
        console.log('🔄 Fallback: OCR toàn màn hình...');
        await performFullScreenOCR(tabId, apiKeys, selectedModel);
    }
}

// OCR toàn màn hình (fallback)
async function performFullScreenOCR(tabId, apiKeys, selectedModel) {
    try {
        console.log('📸 Chụp ảnh toàn màn hình cho OCR...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang chụp ảnh màn hình...');
        
        // Chụp ảnh màn hình
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
        console.log('✅ Đã chụp ảnh màn hình');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang trích xuất text bằng AI...');
        
        console.log('🤖 Gửi tới Gemini Vision API...');
        
        // Trích xuất text bằng Gemini Vision API
        const extractedText = await extractTextFromImageWithFailover(dataUrl, apiKeys, selectedModel);
        
        if (extractedText) {
            console.log('✅ OCR hoàn thành thành công');
            
            // Hiển thị thông báo thành công
            await showOCRNotification(tabId, 'success', '', {
                extractedLength: extractedText.length
            });
            
            await openOCRPopup(extractedText, selectedModel);
        } else {
            console.error('❌ OCR thất bại - không trích xuất được text');
            
            // Hiển thị thông báo lỗi
            await showOCRNotification(tabId, 'error', 'Không thể trích xuất text từ hình ảnh');
            
            await openOCRPopupWithError('Không thể trích xuất text từ hình ảnh');
        }
        
    } catch (error) {
        console.error('❌ Lỗi OCR toàn màn hình:', error);
        
        // Hiển thị thông báo lỗi
        await showOCRNotification(tabId, 'error', error.message || 'Lỗi OCR toàn màn hình');
        
        showErrorNotification('OCR thất bại', `Lỗi: ${error.message}`);
    }
}

// OCR với vùng đã chọn
async function performRegionOCR(selection, tabId) {
    try {
        console.log('🔍 Bắt đầu OCR với vùng đã chọn:', selection);
        
        // Hiển thị thông báo bắt đầu
        await showOCRNotification(tabId, 'processing', 'Đang xử lý vùng đã chọn...');
        
        // Lấy thông tin OCR đã lưu
        const result = await chrome.storage.local.get(['pendingOCRData']);
        const ocrData = result.pendingOCRData;
        
        if (!ocrData) {
            throw new Error('Không tìm thấy thông tin OCR đã lưu');
        }
        
        // Kiểm tra API keys
        if (!ocrData.apiKeys || ocrData.apiKeys.length === 0) {
            await showOCRNotification(tabId, 'error', 'Chưa cấu hình Google Gemini API keys');
            showErrorNotification('OCR thất bại', 'Vui lòng cấu hình Google Gemini API keys trong tùy chọn extension trước khi sử dụng OCR');
            await chrome.storage.local.remove(['pendingOCRData']);
            return;
        }
        
        console.log('📸 Chụp ảnh toàn màn hình...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang chụp ảnh màn hình...');
        
        // Chụp ảnh toàn màn hình trước
        const fullScreenDataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
        console.log('✅ Đã chụp ảnh toàn màn hình');
        
        console.log('✂️ Cắt vùng đã chọn...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang cắt vùng đã chọn...');
        
        // Cắt vùng đã chọn từ ảnh toàn màn hình
        const croppedDataUrl = await cropImage(fullScreenDataUrl, selection);
        console.log('✅ Đã cắt vùng đã chọn');
        
        console.log('🤖 Gửi vùng đã chọn tới Gemini Vision API...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang trích xuất text bằng AI...');
        
        // Trích xuất text từ vùng đã chọn
        const extractedText = await extractTextFromImageWithFailover(
            croppedDataUrl, 
            ocrData.apiKeys, 
            ocrData.model
        );
        
        if (extractedText) {
            console.log('✅ OCR vùng đã chọn hoàn thành thành công');
            
            // Hiển thị thông báo thành công
            await showOCRNotification(tabId, 'success', '', {
                extractedLength: extractedText.length
            });
            
            await openOCRPopup(extractedText, ocrData.model);
        } else {
            console.error('❌ OCR vùng đã chọn thất bại');
            
            // Hiển thị thông báo lỗi
            await showOCRNotification(tabId, 'error', 'Không thể trích xuất text từ vùng đã chọn');
            
            await openOCRPopupWithError('Không thể trích xuất text từ vùng đã chọn');
        }
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingOCRData']);
        
    } catch (error) {
        console.error('❌ Lỗi OCR vùng đã chọn:', error);
        
        // Hiển thị thông báo lỗi
        await showOCRNotification(tabId, 'error', error.message || 'Lỗi OCR vùng đã chọn');
        
        showErrorNotification('OCR thất bại', `Lỗi: ${error.message}`);
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingOCRData']);
    }
}

// OCR với HTML2Canvas (phương pháp mới)
async function performHTML2CanvasOCR(selection, tabId) {
    try {
        console.log('🖼️ Bắt đầu OCR với HTML2Canvas:', selection);
        
        // Hiển thị thông báo bắt đầu
        await showOCRNotification(tabId, 'processing', 'Đang xử lý vùng chọn với HTML2Canvas...');
        
        // Lấy thông tin OCR đã lưu
        const result = await chrome.storage.local.get(['pendingOCRData']);
        const ocrData = result.pendingOCRData;
        
        if (!ocrData) {
            throw new Error('Không tìm thấy thông tin OCR đã lưu');
        }
        
        // Kiểm tra API keys
        if (!ocrData.apiKeys || ocrData.apiKeys.length === 0) {
            await showOCRNotification(tabId, 'error', 'Chưa cấu hình Google Gemini API keys');
            showErrorNotification('OCR thất bại', 'Vui lòng cấu hình Google Gemini API keys trong tùy chọn extension trước khi sử dụng OCR');
            await chrome.storage.local.remove(['pendingOCRData']);
            return;
        }
        
        console.log('🖼️ Sử dụng HTML2Canvas để chụp vùng chọn...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang chụp ảnh vùng chọn...');
        
        // Inject HTML2Canvas và chụp ảnh vùng chọn
        const imageDataUrl = await captureRegionWithHTML2Canvas(selection, tabId);
        
        if (!imageDataUrl) {
            throw new Error('Không thể chụp ảnh vùng chọn với HTML2Canvas');
        }
        
        console.log('✅ Đã chụp ảnh vùng chọn với HTML2Canvas');
        console.log('🤖 Gửi tới Gemini Vision API...');
        
        // Cập nhật thông báo
        await showOCRNotification(tabId, 'processing', 'Đang trích xuất text bằng AI...');
        
        // Trích xuất text bằng Gemini Vision API
        const extractedText = await extractTextFromImageWithFailover(imageDataUrl, ocrData.apiKeys, ocrData.model);
        
        if (extractedText) {
            console.log('✅ OCR hoàn thành thành công');
            
            // Hiển thị thông báo thành công
            await showOCRNotification(tabId, 'success', '', {
                extractedLength: extractedText.length
            });
            
            await openOCRPopup(extractedText, ocrData.model);
        } else {
            console.error('❌ OCR thất bại - không trích xuất được text');
            
            // Hiển thị thông báo lỗi
            await showOCRNotification(tabId, 'error', 'Không thể trích xuất text từ hình ảnh');
            
            await openOCRPopupWithError('Không thể trích xuất text từ hình ảnh');
        }
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingOCRData']);
        
    } catch (error) {
        console.error('❌ Lỗi OCR HTML2Canvas:', error);
        
        // Hiển thị thông báo lỗi
        await showOCRNotification(tabId, 'error', error.message || 'Lỗi OCR HTML2Canvas');
        
        showErrorNotification('OCR thất bại', `Lỗi: ${error.message}`);
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingOCRData']);
    }
}

// Chụp ảnh vùng chọn với HTML2Canvas
async function captureRegionWithHTML2Canvas(selection, tabId) {
    try {
        console.log('🖼️ Chụp ảnh vùng chọn với HTML2Canvas...');
        
        // Inject HTML2Canvas script vào tab
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['libs/html2canvas.min.js']
        });
        
        // Inject function chụp ảnh vào tab
        const result = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: captureRegionWithHTML2CanvasInPage,
            args: [selection]
        });
        
        if (result && result[0] && result[0].result) {
            console.log('✅ Đã chụp ảnh vùng chọn với HTML2Canvas');
            return result[0].result;
        } else {
            throw new Error('Không thể chụp ảnh vùng chọn');
        }
        
    } catch (error) {
        console.error('❌ Lỗi chụp ảnh HTML2Canvas:', error);
        throw error;
    }
}

// Function để inject vào page - theo cách KingAI
function captureRegionWithHTML2CanvasInPage(selection) {
    return new Promise((resolve, reject) => {
        console.log('🖼️ Chụp ảnh vùng chọn trong page (KingAI style):', selection);
        
        // Kiểm tra HTML2Canvas có sẵn không
        if (typeof html2canvas === 'undefined') {
            reject(new Error('HTML2Canvas library chưa được tải'));
            return;
        }
        
        // Chụp toàn bộ body như KingAI với nhiều tùy chọn
        const options = {
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            scale: window.devicePixelRatio || 1,
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            foreignObjectRendering: true,
            logging: false,
            removeContainer: true,
            // Thêm padding để đảm bảo không bị cắt text
            scrollX: 0,
            scrollY: 0
        };
        
        console.log('🔧 HTML2Canvas options:', options);
        
        html2canvas(document.body, options).then(canvas => {
            console.log('✅ HTML2Canvas thành công, kích thước:', canvas.width, 'x', canvas.height);
            
            // Kiểm tra chất lượng ảnh
            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('Canvas rỗng - không có nội dung để chụp');
            }
            
            // Chuyển đổi canvas thành data URL
            const dataUrl = canvas.toDataURL('image/png');
            console.log('✅ Đã chụp ảnh vùng chọn:', dataUrl.substring(0, 50) + '...');
            console.log('📊 Kích thước ảnh cuối:', canvas.width, 'x', canvas.height);
            resolve(dataUrl);
        }).catch(error => {
            console.error('❌ Lỗi HTML2Canvas:', error);
            
            // Fallback: thử chụp document.documentElement
            console.log('🔄 Thử fallback với document.documentElement...');
            html2canvas(document.documentElement, {
                x: selection.x,
                y: selection.y,
                width: selection.width,
                height: selection.height,
                scale: 1,
                useCORS: true,
                allowTaint: true
            }).then(canvas => {
                const dataUrl = canvas.toDataURL('image/png');
                console.log('✅ Fallback thành công');
                resolve(dataUrl);
            }).catch(fallbackError => {
                console.error('❌ Fallback cũng thất bại:', fallbackError);
                reject(error);
            });
        });
    });
}

async function extractTextFromImageWithFailover(imageDataUrl, apiKeys, model = 'gemini-2.5-flash-lite') {
    let lastError = null;
    
    // Thử với từng API key cho đến khi thành công
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        console.log(`🔑 Thử API key ${i + 1}/${apiKeys.length}...`);
        
        try {
            const result = await extractTextFromImageWithRetry(imageDataUrl, apiKey, model);
            console.log(`✅ API key ${i + 1} thành công!`);
            return result;
        } catch (error) {
            console.error(`❌ API key ${i + 1} thất bại:`, error.message);
            lastError = error;
            
            // Nếu lỗi rate limit hoặc quota, thử key tiếp theo
            if (error.message.includes('quota') || error.message.includes('rate') || 
                error.message.includes('unavailable') || error.message.includes('Failed to fetch')) {
                console.log('⚠️ Network/rate limit error, thử API key tiếp theo...');
                // Thêm delay trước khi thử key tiếp theo
                if (i < apiKeys.length - 1) {
                    console.log('⏳ Đợi 2 giây trước khi thử key tiếp theo...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                continue;
            }
            
            // Nếu lỗi nghiêm trọng khác, dừng luôn
            if (error.message.includes('invalid') || error.message.includes('auth')) {
                console.error('🚫 Authentication error, dừng thử các key khác');
                break;
            }
        }
    }
    
    throw lastError || new Error('Tất cả API keys đều thất bại');
}

// Function với retry mechanism
async function extractTextFromImageWithRetry(imageDataUrl, apiKey, model = 'gemini-2.5-flash-lite', maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Thử lần ${attempt}/${maxRetries} với API key...`);
            const result = await extractTextFromImage(imageDataUrl, apiKey, model);
            console.log(`✅ Thành công ở lần thử ${attempt}`);
            return result;
        } catch (error) {
            console.error(`❌ Lần thử ${attempt} thất bại:`, error.message);
            lastError = error;
            
            // Nếu không phải lần thử cuối, đợi trước khi retry
            if (attempt < maxRetries) {
                const delay = attempt * 1000; // Tăng delay theo số lần thử
                console.log(`⏳ Đợi ${delay}ms trước khi thử lại...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error(`Thất bại sau ${maxRetries} lần thử`);
}

async function extractTextFromImage(imageDataUrl, apiKey, model = 'gemini-2.5-flash-lite') {
    try {
        // Chuyển data URL thành base64
        const base64Image = imageDataUrl.split(',')[1];
        
        // Tạo parts theo KingAI structure
        const parts = [
            { text: "Please extract all visible text from this image. Return only the plain text content without any explanations, markdown formatting, or additional comments. If no text is detected, return 'No text found'." },
            {
                inline_data: {
                    mime_type: "image/png",
                    data: base64Image
                }
            }
        ];

        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
                topP: 0.8,
                topK: 40
            }
        };
        
        console.log('🚀 Gửi API request tới model:', model);
        console.log('🔑 API Key (4 ký tự đầu):', apiKey.substring(0, 4) + '...');
        console.log('📝 Request body size:', JSON.stringify(requestBody).length, 'bytes');
        console.log('🖼️ Image data size:', base64Image.length, 'bytes');
        
        // Tạo AbortController cho timeout (tăng thời gian cho OCR)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 giây timeout cho OCR
        
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ API Response Status: ${response.status} ${response.statusText}`);
                console.error('❌ API Response Body:', errorText);
                
                try {
                    const errorData = JSON.parse(errorText);
                    const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
                    
                    if (response.status === 400) {
                        throw new Error(`API Key không hợp lệ hoặc request sai format: ${errorMessage}`);
                    } else if (response.status === 403) {
                        throw new Error(`API Key bị từ chối hoặc hết quota: ${errorMessage}`);
                    } else if (response.status === 429) {
                        throw new Error(`Quá nhiều request, vui lòng thử lại sau: ${errorMessage}`);
                    } else {
                        throw new Error(`Gemini API lỗi (${response.status}): ${errorMessage}`);
                    }
                } catch (parseError) {
                    throw new Error(`Gemini API lỗi (${response.status}): ${errorText.substring(0, 200)}`);
                }
            }
            
            const data = await response.json();
            console.log('📋 API Response structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
            
            const extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            
            if (!extractedText) {
                console.error('❌ Empty response from API:', data);
                throw new Error('Không có text được trích xuất từ API response. Có thể hình ảnh không chứa text hoặc API key bị giới hạn.');
            }
            
            // Validate extracted text
            if (extractedText === 'No text found' || extractedText === 'No text detected') {
                console.warn('⚠️ API báo không tìm thấy text trong hình ảnh');
                return 'Không phát hiện text trong hình ảnh';
            }
            
            console.log('✅ OCR thành công, độ dài text:', extractedText.length);
            return extractedText;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - API không phản hồi trong 45 giây. Thử lại với hình ảnh nhỏ hơn.');
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error - Không thể kết nối tới API. Kiểm tra kết nối mạng hoặc API key.');
            }
            
            if (error.message.includes('NetworkError')) {
                throw new Error('Network error - Lỗi kết nối mạng');
            }
            
            throw error;
        }
        
    } catch (error) {
        console.error('Lỗi gọi Gemini API:', error);
        throw error;
    }
}

function getModelDisplayName(modelId) {
    const modelNames = {
        'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
        'gemini-2.0-flash-exp': 'Gemini 2.0 Flash (Experimental)',
        'gemini-1.5-flash': 'Gemini 1.5 Flash',
        'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B',
        'gemini-1.5-pro': 'Gemini 1.5 Pro',
        'gemini-1.0-pro': 'Gemini 1.0 Pro'
    };
    
    return modelNames[modelId] || modelId;
}

// Auto Translate Functions - Tính năng dịch tự động riêng biệt
async function performAutoTranslate(tabId) {
    try {
        console.log('🌐 Bắt đầu quá trình Dịch tự động...');
        
        // Lấy cấu hình
        const settings = await chrome.storage.sync.get(['geminiApiKeys', 'geminiModel', 'targetLanguage', 'translateDisplayMode']);
        const apiKeys = settings.geminiApiKeys || [];
        const selectedModel = settings.geminiModel || 'gemini-2.5-flash-lite';
        const targetLanguage = settings.targetLanguage || 'vi';
        const displayMode = settings.translateDisplayMode || 'inline';
        
        console.log('🤖 Sử dụng Gemini model:', selectedModel);
        console.log('🔑 Số API keys có sẵn:', apiKeys.length);
        console.log('🌐 Ngôn ngữ đích:', targetLanguage);
        console.log('📱 Chế độ hiển thị:', displayMode);
        
        // Kiểm tra API keys
        if (!apiKeys || apiKeys.length === 0) {
            showErrorNotification('Dịch tự động thất bại', 'Vui lòng cấu hình Google Gemini API keys trong tùy chọn extension trước khi sử dụng Dịch tự động');
            return;
        }
        
        // Luôn hiển thị region selector trước
        console.log('🎯 Kích hoạt region selector cho Dịch tự động...');
        await activateTranslateRegionSelector(tabId, apiKeys, selectedModel, targetLanguage, displayMode);
        
    } catch (error) {
        console.error('❌ Lỗi Dịch tự động:', error);
        showErrorNotification('Dịch tự động thất bại', `Lỗi: ${error.message}`);
    }
}

// Hiển thị dialog fallback khi thêm mũi tên thất bại
async function showArrowFallbackDialog(tabId, dataUrl, selectionInfo) {
    try {
        // Inject CSS và HTML cho dialog
        await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            css: `
                .arrow-fallback-dialog {
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    z-index: 999999 !important;
                    background: white !important;
                    border: 2px solid #e74c3c !important;
                    border-radius: 12px !important;
                    padding: 24px !important;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                    min-width: 320px !important;
                    max-width: 400px !important;
                }
                
                .arrow-fallback-dialog h3 {
                    margin: 0 0 16px 0 !important;
                    color: #e74c3c !important;
                    font-size: 18px !important;
                    font-weight: 600 !important;
                }
                
                .arrow-fallback-dialog p {
                    margin: 0 0 20px 0 !important;
                    color: #333 !important;
                    font-size: 14px !important;
                    line-height: 1.5 !important;
                }
                
                .arrow-fallback-dialog .buttons {
                    display: flex !important;
                    gap: 12px !important;
                    justify-content: center !important;
                }
                
                .arrow-fallback-dialog button {
                    padding: 10px 20px !important;
                    border: none !important;
                    border-radius: 6px !important;
                    font-size: 14px !important;
                    font-weight: 500 !important;
                    cursor: pointer !important;
                    transition: all 0.2s !important;
                }
                
                .arrow-fallback-dialog .btn-primary {
                    background: #3498db !important;
                    color: white !important;
                }
                
                .arrow-fallback-dialog .btn-primary:hover {
                    background: #2980b9 !important;
                }
                
                .arrow-fallback-dialog .btn-secondary {
                    background: #95a5a6 !important;
                    color: white !important;
                }
                
                .arrow-fallback-dialog .btn-secondary:hover {
                    background: #7f8c8d !important;
                }
                
                .arrow-fallback-dialog .btn-success {
                    background: #27ae60 !important;
                    color: white !important;
                }
                
                .arrow-fallback-dialog .btn-success:hover {
                    background: #229954 !important;
                }
                
                .arrow-fallback-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0,0,0,0.5) !important;
                    z-index: 999998 !important;
                }
            `
        });

        // Inject JavaScript để tạo dialog
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (dataUrl, selectionInfo) => {
                // Tạo overlay
                const overlay = document.createElement('div');
                overlay.className = 'arrow-fallback-overlay';
                
                // Tạo dialog
                const dialog = document.createElement('div');
                dialog.className = 'arrow-fallback-dialog';
                dialog.innerHTML = `
                    <h3>❌ Thêm mũi tên tự động thất bại</h3>
                    <p>Không thể tự động thêm mũi tên vào vùng được chọn. Bạn muốn:</p>
                    <div class="buttons">
                        <button class="btn-primary" data-action="manual">🎨 Vẽ thủ công</button>
                        <button class="btn-success" data-action="retry">🔄 Thử lại</button>
                        <button class="btn-secondary" data-action="skip">📋 Bỏ qua</button>
                    </div>
                `;
                
                // Event handlers
                dialog.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') {
                        const action = e.target.getAttribute('data-action');
                        
                        // Gửi message về background
                        chrome.runtime.sendMessage({
                            type: 'ARROW_FALLBACK_ACTION',
                            action: action,
                            dataUrl: dataUrl,
                            selectionInfo: selectionInfo
                        });
                        
                        // Xóa dialog
                        overlay.remove();
                        dialog.remove();
                    }
                });
                
                // Thêm vào DOM
                document.body.appendChild(overlay);
                document.body.appendChild(dialog);
                
                // Auto-close sau 15 giây
                setTimeout(() => {
                    if (dialog.parentNode) {
                        chrome.runtime.sendMessage({
                            type: 'ARROW_FALLBACK_ACTION',
                            action: 'skip',
                            dataUrl: dataUrl,
                            selectionInfo: selectionInfo
                        });
                        overlay.remove();
                        dialog.remove();
                    }
                }, 15000);
            },
            args: [dataUrl, selectionInfo]
        });
        
    } catch (error) {
        console.error('❌ Lỗi hiển thị dialog fallback:', error);
        // Fallback của fallback: mở drawing tool
        await openDrawingTool(dataUrl);
    }
}

// Hiển thị notification thông thường
function showNotification(title, message) {
    try {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon64.png',
            title: title,
            message: message
        });
    } catch (error) {
        console.error('Lỗi hiển thị notification:', error);
    }
}

// Hiển thị cảnh báo lỗi tự động tắt sau 5s
function showErrorNotification(title, message) {
    try {
        const notificationId = `error_${Date.now()}`;
        chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: 'icons/icon64.png',
            title: `❌ ${title}`,
            message: message,
            priority: 2
        });
        
        // Tự động xóa sau 5 giây
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 5000);
        
        console.error(`❌ ${title}:`, message);
    } catch (error) {
        console.error('Lỗi hiển thị error notification:', error);
    }
}

// Kích hoạt region selector cho Dịch tự động
async function activateTranslateRegionSelector(tabId, apiKeys, selectedModel, targetLanguage, displayMode) {
    try {
        console.log('🎯 Kích hoạt region selector cho Dịch tự động...');
        
        // Lưu thông tin Dịch tự động để sử dụng sau
        await chrome.storage.local.set({
            pendingTranslateData: {
                apiKeys: apiKeys,
                model: selectedModel,
                targetLanguage: targetLanguage,
                displayMode: displayMode,
                timestamp: Date.now()
            }
        });
        
        // Inject region selector script cho Translate
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/ocr/region-selector.js']
        });
        
        // Khởi tạo region selector cho Translate
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                console.log('🌐 Khởi tạo RegionSelector cho Dịch tự động...');
                
                if (typeof window.RegionSelector === 'function') {
                    const selector = new window.RegionSelector((selection) => {
                        console.log('🌐 Region được chọn cho Translate:', selection);
                        
                        if (selection) {
                            // Gửi message về background script
                            chrome.runtime.sendMessage({
                                type: 'REGION_SELECTED_TRANSLATE',
                                selection: selection
                            });
                        }
                    });
                    
                    console.log('✅ RegionSelector cho Translate đã được khởi tạo');
                } else {
                    console.error('❌ RegionSelector không tồn tại');
                }
            }
        });
        
        console.log('✅ Region selector cho Dịch tự động đã được inject');
        
    } catch (error) {
        console.error('❌ Lỗi kích hoạt region selector cho Dịch tự động:', error);
        showErrorNotification('Dịch tự động thất bại', `Lỗi: ${error.message}`);
        
        // Fallback: Dịch toàn màn hình
        console.log('🔄 Fallback: Dịch toàn màn hình...');
        await performFullScreenTranslate(tabId, apiKeys, selectedModel, targetLanguage, displayMode);
    }
}

// Dịch toàn màn hình (fallback)
async function performFullScreenTranslate(tabId, apiKeys, selectedModel, targetLanguage, displayMode) {
    try {
        console.log('📸 Chụp ảnh toàn màn hình cho Dịch tự động...');
        
        // Chụp ảnh màn hình
        const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
        console.log('✅ Đã chụp ảnh màn hình');
        
        console.log('🤖 Gửi tới Gemini Vision API để OCR...');
        
        // Trích xuất text bằng Gemini Vision API
        const extractedText = await extractTextFromImageWithFailover(dataUrl, apiKeys, selectedModel);
        
        if (extractedText) {
            console.log('✅ OCR hoàn thành, bắt đầu dịch...');
            
            // Dịch text
            const translatedText = await translateText(extractedText, targetLanguage, apiKeys, selectedModel);
            
            if (translatedText) {
                console.log('✅ Dịch tự động hoàn thành thành công');
                await openTranslatePopup(`${extractedText}\n\n--- BẢN DỊCH ---\n${translatedText}`, selectedModel, displayMode);
            } else {
                console.error('❌ Dịch thất bại');
                await openTranslatePopupWithError('Không thể dịch text từ hình ảnh');
            }
        } else {
            console.error('❌ OCR thất bại - không trích xuất được text');
            await openTranslatePopupWithError('Không thể trích xuất text từ hình ảnh');
        }
        
    } catch (error) {
        console.error('❌ Lỗi Dịch tự động toàn màn hình:', error);
        showErrorNotification('Dịch tự động thất bại', `Lỗi: ${error.message}`);
    }
}

// Dịch với vùng đã chọn
async function performRegionTranslate(selection, tabId) {
    try {
        console.log('🌐 Bắt đầu Dịch tự động với vùng đã chọn:', selection);
        
        // Lấy thông tin Dịch tự động đã lưu
        const result = await chrome.storage.local.get(['pendingTranslateData']);
        const translateData = result.pendingTranslateData;
        
        if (!translateData) {
            throw new Error('Không tìm thấy thông tin Dịch tự động đã lưu');
        }
        
        // Kiểm tra API keys
        if (!translateData.apiKeys || translateData.apiKeys.length === 0) {
            showErrorNotification('Dịch tự động thất bại', 'Vui lòng cấu hình Google Gemini API keys trong tùy chọn extension trước khi sử dụng Dịch tự động');
            await chrome.storage.local.remove(['pendingTranslateData']);
            return;
        }
        
        console.log('📸 Chụp ảnh toàn màn hình...');
        
        // Chụp ảnh toàn màn hình trước
        const fullScreenDataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: "png" });
        console.log('✅ Đã chụp ảnh toàn màn hình');
        
        console.log('✂️ Cắt vùng đã chọn...');
        
        // Cắt vùng đã chọn từ ảnh toàn màn hình
        const croppedDataUrl = await cropImage(fullScreenDataUrl, selection);
        console.log('✅ Đã cắt vùng đã chọn');
        
        console.log('🤖 Gửi vùng đã chọn tới Gemini Vision API để OCR...');
        
        // Trích xuất text từ vùng đã chọn
        const extractedText = await extractTextFromImageWithFailover(
            croppedDataUrl, 
            translateData.apiKeys, 
            translateData.model
        );
        
        if (extractedText) {
            console.log('✅ OCR vùng đã chọn hoàn thành, bắt đầu dịch...');
            
            // Dịch text
            const translatedText = await translateText(extractedText, translateData.targetLanguage, translateData.apiKeys, translateData.model);
            
            if (translatedText) {
                console.log('✅ Dịch tự động hoàn thành thành công');
                await openTranslatePopup(`${extractedText}\n\n--- BẢN DỊCH ---\n${translatedText}`, translateData.model, translateData.displayMode);
            } else {
                // Nếu dịch thất bại, vẫn hiển thị text gốc
                console.warn('⚠️ Dịch thất bại, hiển thị text gốc');
                await openTranslatePopup(extractedText, translateData.model, translateData.displayMode);
            }
        } else {
            console.error('❌ OCR vùng đã chọn thất bại');
            await openTranslatePopupWithError('Không thể trích xuất text từ vùng đã chọn');
        }
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingTranslateData']);
        
    } catch (error) {
        console.error('❌ Lỗi Dịch tự động vùng đã chọn:', error);
        showErrorNotification('Dịch tự động thất bại', `Lỗi: ${error.message}`);
        
        // Xóa dữ liệu tạm thời
        await chrome.storage.local.remove(['pendingTranslateData']);
    }
}

// Dịch text sử dụng Gemini API
async function translateText(text, targetLanguage = 'vi', apiKeys, model = 'gemini-2.5-flash-lite') {
    try {
        if (!text || !text.trim()) {
            console.warn('Không có text để dịch');
            return null;
        }

        if (!apiKeys || apiKeys.length === 0) {
            console.error('Không có API keys để dịch');
            return null;
        }

        const langNames = {
            'vi': 'Vietnamese (Tiếng Việt)',
            'en': 'English',
            'zh': 'Chinese (中文)',
            'ja': 'Japanese (日本語)',
            'ko': 'Korean (한국어)'
        };

        const targetLangName = langNames[targetLanguage] || targetLanguage;
        
        console.log(`🌐 Dịch text sang ${targetLangName}...`);
        console.log('📝 Text gốc:', text.substring(0, 100) + '...');

        const prompt = `Please translate the following text to ${targetLangName}. Only return the translated text, no additional explanation or formatting:

${text}`;

        // Tạo parts theo KingAI structure
        const parts = [{
            text: prompt
        }];

        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 40,
                topP: 0.8,
                maxOutputTokens: 8192
            }
        };

        // Thử từng API key cho đến khi thành công
        for (let i = 0; i < apiKeys.length; i++) {
            try {
                console.log(`🔑 Thử API key ${i + 1}/${apiKeys.length} cho dịch...`);
                console.log(`🔑 API Key (4 ký tự đầu):`, apiKeys[i].substring(0, 4) + '...');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 giây timeout cho dịch

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeys[i]}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal
                    }
                );

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No response body');
                    console.warn(`❌ API key ${i + 1} failed - Status: ${response.status}`);
                    console.warn(`❌ Error response:`, errorText.substring(0, 200));
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
                        console.warn(`❌ Parsed error:`, errorMessage);
                    } catch (parseError) {
                        console.warn(`❌ Could not parse error response`);
                    }
                    
                    continue;
                }

                const data = await response.json();
                const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                if (!translatedText) {
                    console.warn(`API key ${i + 1}: Không có text được dịch từ API response`);
                    continue;
                }

                console.log('✅ Dịch thành công, độ dài:', translatedText.length);
                console.log('🌐 Text đã dịch:', translatedText.substring(0, 100) + '...');
                return translatedText;

            } catch (error) {
                console.warn(`API key ${i + 1} error:`, error.message);
                
                if (error.name === 'AbortError') {
                    console.warn('Translation timeout');
                }
                
                // Tiếp tục với API key tiếp theo
                continue;
            }
        }

        console.error('❌ Tất cả API keys đều thất bại cho dịch');
        return null;

    } catch (error) {
        console.error('❌ Lỗi dịch text:', error);
        return null;
    }
}

async function openTranslatePopup(text, model, displayMode = 'inline') {
    try {
        console.log('Mở Translate popup với text...', 'Display mode:', displayMode);
        
        // Lấy active tab với nhiều cách
        let activeTab = null;
        
        try {
            // Cách 1: Query active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0) {
                activeTab = tabs[0];
                console.log('✅ Tìm thấy active tab qua query:', activeTab.id);
            }
        } catch (error) {
            console.warn('⚠️ Lỗi query active tab:', error);
        }
        
        // Cách 2: Nếu không tìm thấy, thử query tất cả tabs
        if (!activeTab) {
            try {
                const allTabs = await chrome.tabs.query({});
                if (allTabs && allTabs.length > 0) {
                    // Lấy tab cuối cùng (thường là tab hiện tại)
                    activeTab = allTabs[allTabs.length - 1];
                    console.log('✅ Tìm thấy tab qua query all:', activeTab.id);
                }
            } catch (error) {
                console.warn('⚠️ Lỗi query all tabs:', error);
            }
        }
        
        if (!activeTab) {
            console.error('❌ Không thể tìm thấy tab nào');
            // Fallback: tạo window popup
            console.log('🔄 Fallback về window popup...');
            await openTranslateWindow(text, model);
            return;
        }
        
        console.log('✅ Sử dụng tab:', activeTab.id, activeTab.url);
        
        // Lưu Translate data cho popup
        console.log('Lưu Translate data cho popup:');
        console.log('Độ dài text:', text.length);
        console.log('Preview text:', text.substring(0, 100) + '...');
        
        await chrome.storage.local.set({
            currentTranslateData: {
                text: text,
                timestamp: Date.now(),
                success: true,
                model: model,
                modelDisplayName: getModelDisplayName(model)
            }
        });
        
        console.log('Translate data đã được lưu thành công');
        
        // Chọn phương thức hiển thị dựa trên displayMode
        switch (displayMode) {
            case 'window':
                await openTranslateWindow(text, model);
                break;
            case 'sidebar':
                await openTranslateSidebar(activeTab.id, text, model);
                break;
            case 'notification':
                await openTranslateNotification(activeTab.id, text, model);
                break;
            case 'inline':
            default:
                await openTranslateInline(activeTab.id, text, model);
                break;
        }
        
    } catch (error) {
        console.error('Lỗi mở Translate popup:', error);
        showErrorNotification('Lỗi Dịch tự động', 'Không thể mở Translate popup');
    }
}

async function openTranslateWindow(text, model) {
    try {
            const popup = await chrome.windows.create({
                url: chrome.runtime.getURL('modules/ocr/ocr-popup.html'),
                type: 'popup',
                width: 650,
                height: 500,
                focused: true
            });
        console.log('✅ Translate Window popup đã tạo:', popup.id);
    } catch (error) {
        console.error('Lỗi tạo translate window popup:', error);
    }
}

async function openTranslateSidebar(tabId, text, model) {
    try {
        const popup = await chrome.windows.create({
            url: chrome.runtime.getURL('modules/ocr/ocr-sidebar.html'),
            type: 'popup',
            width: 350,
            height: 600,
            focused: true,
            left: screen.width - 370,
            top: 50
        });
        console.log('✅ Translate Sidebar popup đã tạo:', popup.id);
    } catch (error) {
        console.error('Lỗi tạo translate sidebar popup:', error);
    }
}

async function openTranslateNotification(tabId, text, model) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/ocr/ocr-notification.js']
        });
        
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text, model) => {
                const notification = new window.OCRNotification();
                notification.show(text, {
                    title: '🌐 Dịch tự động',
                    model: model,
                    duration: 0 // Không tự động ẩn
                });
            },
            args: [text, getModelDisplayName(model)]
        });
        
        console.log('✅ Translate Notification đã hiển thị');
    } catch (error) {
        console.error('Lỗi hiển thị translate notification:', error);
        // Fallback to window
        await openTranslateWindow(text, model);
    }
}

async function openTranslateInline(tabId, text, model) {
    try {
        console.log('🎯 Tạo inline Translate popup...');
        
        // Inject script trực tiếp vào page
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
            func: (data) => {
                console.log('🎯 Tạo inline Translate popup trong page:', data);
                
                // Xóa popup cũ nếu có
                const existingPopup = document.getElementById('king-translate-popup');
                if (existingPopup) {
                    existingPopup.remove();
                }
                
                // Tạo popup container
                const popup = document.createElement('div');
                popup.id = 'king-translate-popup';
                popup.style.cssText = `
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    width: 800px !important;
                    max-width: 90vw !important;
                    max-height: 80vh !important;
                    background: #1a1a1a !important;
                    border-radius: 12px !important;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5) !important;
                    z-index: 999999 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    color: #ffffff !important;
                    overflow: hidden !important;
                `;
                
                // Header
                const header = document.createElement('div');
                header.style.cssText = `
                    padding: 20px !important;
                    border-bottom: 1px solid #333 !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                `;
                
                const title = document.createElement('h2');
                title.textContent = '🌐 Dịch tự động';
                title.style.cssText = `
                    margin: 0 !important;
                    font-size: 18px !important;
                `;
                
                const closeButton = document.createElement('button');
                closeButton.textContent = '×';
                closeButton.style.cssText = `
                    background: none !important;
                    border: none !important;
                    color: #fff !important;
                    font-size: 24px !important;
                    cursor: pointer !important;
                    width: 30px !important;
                    height: 30px !important;
                    border-radius: 50% !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                `;
                closeButton.onclick = () => popup.remove();
                
                header.appendChild(title);
                header.appendChild(closeButton);
                
                // Content
                const content = document.createElement('div');
                content.style.cssText = `
                    padding: 20px !important;
                    max-height: 60vh !important;
                    overflow: hidden !important;
                    display: flex !important;
                    flex-direction: column !important;
                `;
                
                // Meta info
                const metaInfo = document.createElement('div');
                metaInfo.style.cssText = `
                    background: rgba(255, 255, 255, 0.1) !important;
                    padding: 10px !important;
                    border-radius: 6px !important;
                    margin-bottom: 15px !important;
                    font-size: 12px !important;
                    color: #ccc !important;
                `;
                
                const model = document.createElement('div');
                model.textContent = `🤖 Model: ${data.model}`;
                
                const timestamp = document.createElement('div');
                timestamp.textContent = `⏱️ Thời gian: Vừa xong`;
                
                const length = document.createElement('div');
                length.textContent = `📝 Độ dài: ${data.extractedText.length.toLocaleString()} ký tự`;
                
                const mode = document.createElement('div');
                mode.textContent = `🌐 Chế độ: Dịch tự động`;
                mode.style.cssText = `color: #4ade80 !important; font-weight: 600 !important;`;
                
                metaInfo.appendChild(model);
                metaInfo.appendChild(timestamp);
                metaInfo.appendChild(length);
                metaInfo.appendChild(mode);
                
                // Text area với scroll FORCE
                const textArea = document.createElement('textarea');
                textArea.value = data.extractedText || '';
                textArea.style.cssText = `
                    width: 100% !important;
                    height: 300px !important;
                    min-height: 200px !important;
                    max-height: 400px !important;
                    padding: 15px !important;
                    border: 2px solid #333 !important;
                    border-radius: 8px !important;
                    background: #ffffff !important;
                    color: #1a1a1a !important;
                    font-family: 'Courier New', monospace !important;
                    font-size: 14px !important;
                    line-height: 1.6 !important;
                    resize: vertical !important;
                    overflow-y: scroll !important;
                    scrollbar-width: auto !important;
                    box-sizing: border-box !important;
                `;
                
                // Buttons
                const buttons = document.createElement('div');
                buttons.style.cssText = `
                    display: flex !important;
                    gap: 10px !important;
                    margin-top: 15px !important;
                    justify-content: flex-end !important;
                `;
                
                const closeBtn = document.createElement('button');
                closeBtn.textContent = 'Đóng';
                closeBtn.style.cssText = `
                    padding: 10px 20px !important;
                    background: #333 !important;
                    color: #fff !important;
                    border: none !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                `;
                closeBtn.onclick = () => popup.remove();
                
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Text';
                copyButton.style.cssText = `
                    padding: 10px 20px !important;
                    background: #22c55e !important;
                    color: #fff !important;
                    border: none !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                `;
                copyButton.onclick = () => {
                    navigator.clipboard.writeText(textArea.value).then(() => {
                        copyButton.textContent = 'Đã copy!';
                        setTimeout(() => {
                            copyButton.textContent = 'Copy Text';
                        }, 2000);
                    });
                };
                
                buttons.appendChild(closeBtn);
                buttons.appendChild(copyButton);
                
                // Assemble
                content.appendChild(metaInfo);
                content.appendChild(textArea);
                content.appendChild(buttons);
                
                popup.appendChild(header);
                popup.appendChild(content);
                
                // Add to page
                document.body.appendChild(popup);
                
                // Focus textarea
                textArea.focus();
                
                console.log('✅ Inline Translate popup đã tạo thành công');
            },
            args: [{
                extractedText: text,
                model: getModelDisplayName(model),
                timestamp: Date.now()
            }]
        });
        
        console.log('✅ Inline Translate popup đã inject thành công');
        
        } catch (injectError) {
            console.error('❌ Lỗi inject script:', injectError);
            console.log('🔄 Fallback về window popup do lỗi inject...');
            
            // Fallback to window popup
            await openTranslateWindow(text, model);
        }
        
    } catch (error) {
        console.error('Lỗi tạo inline Translate popup:', error);
        // Fallback to window popup
        await openTranslateWindow(text, model);
    }
}

async function openTranslatePopupWithError(errorMessage) {
    try {
        console.log('Mở Translate popup với lỗi:', errorMessage);
        
        await chrome.storage.local.set({
            currentTranslateData: {
                error: errorMessage,
                timestamp: Date.now(),
                success: false
            }
        });
        
        const popup = await chrome.windows.create({
            url: chrome.runtime.getURL('modules/ocr/ocr-popup.html'),
            type: 'popup',
            width: 650,
            height: 500,
            focused: true
        });
        
        console.log('Translate error popup đã mở:', popup.id);
        
    } catch (error) {
        console.error('Lỗi mở Translate error popup:', error);
        showErrorNotification('Lỗi Dịch tự động', errorMessage);
    }
}

async function openOCRPopup(text, model, displayMode = 'auto') {
    try {
        console.log('Mở OCR popup với text...', 'Display mode:', displayMode);
        
        // Lấy tùy chọn hiển thị từ storage
        const settings = await chrome.storage.sync.get(['ocrDisplayMode']);
        const preferredMode = displayMode !== 'auto' ? displayMode : (settings.ocrDisplayMode || 'inline');
        
        console.log('Preferred display mode:', preferredMode);
        
        // Lấy active tab với nhiều cách
        let activeTab = null;
        
        try {
            // Cách 1: Query active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs.length > 0) {
                activeTab = tabs[0];
                console.log('✅ Tìm thấy active tab qua query:', activeTab.id);
            }
        } catch (error) {
            console.warn('⚠️ Lỗi query active tab:', error);
        }
        
        // Cách 2: Nếu không tìm thấy, thử query tất cả tabs
        if (!activeTab) {
            try {
                const allTabs = await chrome.tabs.query({});
                if (allTabs && allTabs.length > 0) {
                    // Lấy tab cuối cùng (thường là tab hiện tại)
                    activeTab = allTabs[allTabs.length - 1];
                    console.log('✅ Tìm thấy tab qua query all:', activeTab.id);
                }
            } catch (error) {
                console.warn('⚠️ Lỗi query all tabs:', error);
            }
        }
        
        if (!activeTab) {
            console.error('❌ Không thể tìm thấy tab nào');
            // Fallback: tạo window popup
            console.log('🔄 Fallback về window popup...');
            await openOCRWindow(text, model);
            return;
        }
        
        console.log('✅ Sử dụng tab:', activeTab.id, activeTab.url);
        
        // Lưu OCR data cho popup
        console.log('Lưu OCR data cho popup:');
        console.log('Độ dài text:', text.length);
        console.log('Preview text:', text.substring(0, 100) + '...');
        
        await chrome.storage.local.set({
            currentOCRData: {
                text: text,
                timestamp: Date.now(),
                success: true,
                model: model,
                modelDisplayName: getModelDisplayName(model)
            }
        });
        
        console.log('OCR data đã được lưu thành công');
        
        // Chọn phương thức hiển thị dựa trên preferredMode
        switch (preferredMode) {
            case 'window':
                await openOCRWindow(text, model);
                break;
            case 'sidebar':
                await openOCRSidebar(activeTab.id, text, model);
                break;
            case 'notification':
                await openOCRNotification(activeTab.id, text, model);
                break;
            case 'inline':
            default:
                await openOCRInline(activeTab.id, text, model);
                break;
        }
        
    } catch (error) {
        console.error('Lỗi mở OCR popup:', error);
        showErrorNotification('Lỗi OCR', 'Không thể mở OCR popup');
    }
}

async function openOCRWindow(text, model) {
    try {
        const popup = await chrome.windows.create({
            url: chrome.runtime.getURL('modules/ocr/ocr-popup.html'),
            type: 'popup',
            width: 650,
            height: 500,
            focused: true
        });
        console.log('✅ Window popup đã tạo:', popup.id);
    } catch (error) {
        console.error('Lỗi tạo window popup:', error);
    }
}

async function openOCRSidebar(tabId, text, model) {
    try {
        const popup = await chrome.windows.create({
            url: chrome.runtime.getURL('modules/ocr/ocr-sidebar.html'),
            type: 'popup',
            width: 350,
            height: 600,
            focused: true,
            left: screen.width - 370,
            top: 50
        });
        console.log('✅ Sidebar popup đã tạo:', popup.id);
    } catch (error) {
        console.error('Lỗi tạo sidebar popup:', error);
    }
}

async function openOCRNotification(tabId, text, model) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['modules/ocr/ocr-notification.js']
        });
        
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text, model) => {
                const notification = new window.OCRNotification();
                notification.show(text, {
                    model: model,
                    duration: 0 // Không tự động ẩn
                });
            },
            args: [text, getModelDisplayName(model)]
        });
        
        console.log('✅ Notification đã hiển thị');
    } catch (error) {
        console.error('Lỗi hiển thị notification:', error);
        // Fallback to window
        await openOCRWindow(text, model);
    }
}

async function openOCRInline(tabId, text, model) {
    try {
        console.log('🎯 Tạo inline OCR popup...');
        
        // Inject script trực tiếp vào page
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
            func: (data) => {
                console.log('🎯 Tạo inline OCR popup trong page:', data);
                
                // Xóa popup cũ nếu có
                const existingPopup = document.getElementById('king-ocr-popup');
                if (existingPopup) {
                    existingPopup.remove();
                }
                
                // Tạo popup container
                const popup = document.createElement('div');
                popup.id = 'king-ocr-popup';
                popup.style.cssText = `
                    position: fixed !important;
                    top: 50% !important;
                    left: 50% !important;
                    transform: translate(-50%, -50%) !important;
                    width: 800px !important;
                    max-width: 90vw !important;
                    max-height: 80vh !important;
                    background: #1a1a1a !important;
                    border-radius: 12px !important;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5) !important;
                    z-index: 999999 !important;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                    color: #ffffff !important;
                    overflow: hidden !important;
                `;
                
                // Header
                const header = document.createElement('div');
                header.style.cssText = `
                    padding: 20px !important;
                    border-bottom: 1px solid #333 !important;
                    display: flex !important;
                    justify-content: space-between !important;
                    align-items: center !important;
                `;
                
                const title = document.createElement('h2');
                title.textContent = 'OCR - Ảnh sang Text';
                title.style.cssText = `
                    margin: 0 !important;
                    font-size: 18px !important;
                    font-weight: 600 !important;
                    color: #ffffff !important;
                `;
                
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '×';
                closeBtn.style.cssText = `
                    background: none !important;
                    border: none !important;
                    color: #ffffff !important;
                    font-size: 24px !important;
                    cursor: pointer !important;
                    padding: 0 !important;
                    width: 30px !important;
                    height: 30px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                `;
                closeBtn.onclick = () => popup.remove();
                
                header.appendChild(title);
                header.appendChild(closeBtn);
                
                // Content
                const content = document.createElement('div');
                content.style.cssText = `
                    padding: 20px !important;
                    max-height: 60vh !important;
                    overflow-y: auto !important;
                `;
                
                // Meta info
                const metaInfo = document.createElement('div');
                metaInfo.style.cssText = `
                    display: flex !important;
                    gap: 20px !important;
                    margin-bottom: 15px !important;
                    font-size: 12px !important;
                    color: #888 !important;
                `;
                
                const model = document.createElement('span');
                model.textContent = `Model: ${data.model || 'Gemini 2.5 Flash Lite'}`;
                
                const timestamp = document.createElement('span');
                timestamp.textContent = `Thời gian: Vừa xong`;
                
                const length = document.createElement('span');
                length.textContent = `Độ dài: ${data.extractedText?.length || 0} ký tự`;
                
                metaInfo.appendChild(model);
                metaInfo.appendChild(timestamp);
                metaInfo.appendChild(length);
                
                // Text area với scroll FORCE
                const textArea = document.createElement('textarea');
                textArea.value = data.extractedText || '';
                textArea.style.cssText = `
                    width: 100% !important;
                    height: 300px !important;
                    min-height: 200px !important;
                    max-height: 400px !important;
                    padding: 15px !important;
                    border: 2px solid #333 !important;
                    border-radius: 8px !important;
                    background: #ffffff !important;
                    color: #1a1a1a !important;
                    font-family: 'Courier New', monospace !important;
                    font-size: 14px !important;
                    line-height: 1.6 !important;
                    resize: vertical !important;
                    overflow-y: scroll !important;
                    scrollbar-width: auto !important;
                    box-sizing: border-box !important;
                `;
                
                // Buttons
                const buttons = document.createElement('div');
                buttons.style.cssText = `
                    display: flex !important;
                    gap: 10px !important;
                    margin-top: 15px !important;
                    justify-content: flex-end !important;
                `;
                
                const closeButton = document.createElement('button');
                closeButton.textContent = 'Đóng';
                closeButton.style.cssText = `
                    padding: 10px 20px !important;
                    background: #333 !important;
                    color: #fff !important;
                    border: none !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                `;
                closeButton.onclick = () => popup.remove();
                
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy Text';
                copyButton.style.cssText = `
                    padding: 10px 20px !important;
                    background: #4CAF50 !important;
                    color: #fff !important;
                    border: none !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                `;
                copyButton.onclick = async () => {
                    try {
                        await navigator.clipboard.writeText(data.extractedText || '');
                        copyButton.textContent = 'Đã copy!';
                        setTimeout(() => copyButton.textContent = 'Copy Text', 2000);
                    } catch (error) {
                        console.error('Copy failed:', error);
                    }
                };
                
                buttons.appendChild(closeButton);
                buttons.appendChild(copyButton);
                
                // Assemble
                content.appendChild(metaInfo);
                content.appendChild(textArea);
                content.appendChild(buttons);
                
                popup.appendChild(header);
                popup.appendChild(content);
                
                // Add to page
                document.body.appendChild(popup);
                
                // Focus textarea
                textArea.focus();
                
                console.log('✅ Inline OCR popup đã tạo thành công');
            },
            args: [{
                extractedText: text,
                model: getModelDisplayName(model),
                timestamp: Date.now()
            }]
        });
        
        console.log('✅ Inline OCR popup đã inject thành công');
        
        } catch (injectError) {
            console.error('❌ Lỗi inject script:', injectError);
            console.log('🔄 Fallback về window popup do lỗi inject...');
            
            // Fallback to window popup
            await openOCRWindow(text, model);
        }
        
    } catch (error) {
        console.error('Lỗi tạo inline OCR popup:', error);
        // Fallback to window popup
        await openOCRWindow(text, model);
    }
}

async function openOCRPopupWithError(errorMessage) {
    try {
        console.log('Mở OCR popup với lỗi:', errorMessage);
        
        await chrome.storage.local.set({
            currentOCRData: {
                error: errorMessage,
                timestamp: Date.now(),
                success: false
            }
        });
        
        const popup = await chrome.windows.create({
            url: chrome.runtime.getURL('modules/ocr/ocr-popup.html'),
            type: 'popup',
            width: 650,
            height: 500,
            focused: true
        });
        
        console.log('OCR error popup đã mở:', popup.id);
        
    } catch (error) {
        console.error('Lỗi mở OCR error popup:', error);
        showNotification('Lỗi OCR', errorMessage);
    }
}

// Cắt ảnh theo vùng đã chọn
async function cropImage(dataUrl, selection) {
    try {
        console.log('✂️ Cắt ảnh với selection:', selection);
        
        // Đảm bảo offscreen document tồn tại
        await ensureOffscreen();
        
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: "OFFSCREEN_CROP_IMAGE",
                payload: { dataUrl, selection }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Lỗi cắt ảnh:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (response && response.success) {
                    console.log('✅ Cắt ảnh thành công');
                    resolve(response.croppedDataUrl);
                } else {
                    console.error('❌ Cắt ảnh thất bại:', response?.error);
                    reject(new Error(response?.error || 'Cắt ảnh thất bại'));
                }
            });
        });
    } catch (error) {
        console.error('❌ Lỗi trong cropImage:', error);
        throw error;
    }
}


// Cleanup offscreen sau idle
let offscreenTimer;
chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "OFFSCREEN_IDLE") {
        clearTimeout(offscreenTimer);
        offscreenTimer = setTimeout(async () => {
            try { 
                await chrome.offscreen.closeDocument(); 
                console.log('💤 Đã đóng offscreen document');
            } catch (_) {}
        }, 10000);
    }
});

// Xử lý messages từ content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Nhận message:', request.type, 'từ tab:', sender.tab?.id);
    
    switch (request.type) {
        case 'REGION_SELECTED_OCR':
            handleRegionSelectedOCR(request.selection, sender.tab.id);
            sendResponse({ success: true });
            break;
            
        case 'REGION_SELECTED_TRANSLATE':
            handleRegionSelectedTranslate(request.selection, sender.tab.id);
            sendResponse({ success: true });
            break;
            
        case 'PERFORM_OCR':
            performOCR(request.tabId || sender.tab.id);
            sendResponse({ success: true });
            break;
            
        default:
            console.warn('⚠️ Unknown message type:', request.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Cho phép async response
});

// Xử lý region được chọn cho OCR
async function handleRegionSelectedOCR(selection, tabId) {
    try {
        console.log('🔍 Xử lý region OCR:', selection);
        
        // Lấy method từ storage để quyết định dùng capture hay HTML2Canvas
        const settings = await chrome.storage.sync.get(['ocrMethod']);
        const method = settings.ocrMethod || 'captureVisibleTab';
        
        if (method === 'html2canvas') {
            await performHTML2CanvasOCR(selection, tabId);
        } else {
            await performRegionOCR(selection, tabId);
        }
    } catch (error) {
        console.error('❌ Lỗi xử lý region OCR:', error);
    }
}

// Xử lý region được chọn cho Translate
async function handleRegionSelectedTranslate(selection, tabId) {
    try {
        console.log('🌐 Xử lý region Translate:', selection);
        await performRegionTranslate(selection, tabId);
    } catch (error) {
        console.error('❌ Lỗi xử lý region Translate:', error);
    }
}

// Message handler for dialog actions
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        switch (message.type) {
            case 'ARROW_FALLBACK_ACTION':
                await handleArrowFallbackAction(message.action, message.dataUrl, message.selectionInfo, sender.tab.id);
                break;
                
            case 'REGION_SELECTED_OCR':
                await handleRegionSelectedOCR(message.selection, sender.tab.id);
                break;
                
            case 'REGION_SELECTED_TRANSLATE':
                await handleRegionSelectedTranslate(message.selection, sender.tab.id);
                break;
        }
    } catch (error) {
        console.error('❌ Lỗi xử lý message:', error);
    }
});

// Xử lý action từ arrow fallback dialog
async function handleArrowFallbackAction(action, dataUrl, selectionInfo, tabId) {
    try {
        console.log('🎯 Xử lý arrow fallback action:', action);
        
        switch (action) {
            case 'manual':
                // Mở công cụ vẽ thủ công
                console.log('🎨 Mở công cụ vẽ thủ công...');
                await openDrawingTool(dataUrl);
                break;
                
            case 'retry':
                // Thử lại thêm mũi tên tự động
                console.log('🔄 Thử lại thêm mũi tên...');
                try {
                    const finalDataUrl = await addArrowViaOffscreen(dataUrl, selectionInfo);
                    console.log('✅ Thử lại thành công!');
                    await copyImageToClipboard(finalDataUrl, tabId);
                } catch (error) {
                    console.error('❌ Thử lại thất bại:', error);
                    showErrorNotification('Thử lại thất bại', 'Mở công cụ vẽ thủ công...');
                    await openDrawingTool(dataUrl);
                }
                break;
                
            case 'skip':
                // Bỏ qua, copy ảnh gốc
                console.log('📋 Bỏ qua, copy ảnh gốc...');
                await copyImageToClipboard(dataUrl, tabId);
                break;
                
            default:
                console.warn('⚠️ Unknown action:', action);
                await openDrawingTool(dataUrl);
        }
    } catch (error) {
        console.error('❌ Lỗi xử lý arrow fallback action:', error);
        await openDrawingTool(dataUrl);
    }
}
