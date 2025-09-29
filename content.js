// Content script cho tính năng chụp ảnh
const isInFrame = window !== window.top;
const frameInfo = isInFrame ? ' (in frame)' : ' (main page)';
console.log('📸 Screenshot Extension content script loaded!' + frameInfo);

let lastSelectedElement = null;
let lastSelection = null;
let lastFocusedElement = null;
let lastActiveElement = null;

// Quản lý vùng chọn thủ công
let manualSelectedElement = null;
let lastClickTime = 0;

// Theo dõi vị trí chuột
let lastMousePosition = null;
let mousePositionTime = 0;

// Điều khiển kích hoạt extension
let isExtensionActive = false;
let activationTimeout = null;
let eventListenersAdded = false;

// Thông tin debug
console.log('📍 URL trang:', window.location.href);
console.log('📍 Trạng thái document:', document.readyState);

// Hiển thị thông báo sử dụng
if (document.readyState === 'complete') {
    showUsageNotification();
} else {
    document.addEventListener('DOMContentLoaded', showUsageNotification);
}

function showUsageNotification() {
    // Chỉ hiển thị một lần mỗi lần tải trang
    if (sessionStorage.getItem('screenshot-notification-shown')) return;
    sessionStorage.setItem('screenshot-notification-shown', 'true');

    setTimeout(() => {
        console.log('📸 Screenshot Extension sẵn sàng! Click chuột phải để chụp ảnh.');
    }, 2000);
}

// Kích hoạt extension
function activateExtension() {
    if (isExtensionActive) return;
    
    console.log('🟢 KÍCH HOẠT extension cho chụp ảnh...');
    isExtensionActive = true;
    
    // Kiểm tra text selection tại thời điểm kích hoạt
    const currentSelection = window.getSelection();
    if (currentSelection && currentSelection.rangeCount > 0 && !currentSelection.isCollapsed) {
        console.log('📝 Phát hiện text selection khi kích hoạt:', currentSelection.toString().substring(0, 50));
        
        if (!lastSelection || lastSelection.text !== currentSelection.toString()) {
            console.log('🔄 CẬP NHẬT lastSelection với selection hiện tại');
            const rawRect = currentSelection.getRangeAt(0).getBoundingClientRect();
            lastSelection = {
                text: currentSelection.toString(),
                rect: {
                    left: rawRect.left + window.scrollX,
                    top: rawRect.top + window.scrollY,
                    width: rawRect.width,
                    height: rawRect.height
                },
                range: currentSelection.getRangeAt(0).cloneRange()
            };
        }
    } else {
        console.log('📝 KHÔNG có text selection khi kích hoạt');
    }
    
    // Thêm event listeners khi cần
    if (!eventListenersAdded) {
        addEventListeners();
        eventListenersAdded = true;
    }
    
    // Tự động hủy kích hoạt sau 30 giây
    if (activationTimeout) {
        clearTimeout(activationTimeout);
    }
    
    activationTimeout = setTimeout(() => {
        deactivateExtension('timeout');
    }, 30000);
}

// Hủy kích hoạt extension
function deactivateExtension(reason = 'screenshot_taken') {
    if (!isExtensionActive) return;
    
    console.log('🔴 HỦY KÍCH HOẠT extension:', reason);
    isExtensionActive = false;
    
    // Clear timeout
    if (activationTimeout) {
        clearTimeout(activationTimeout);
        activationTimeout = null;
    }
    
    // Reset dữ liệu tracking
    manualSelectedElement = null;
    lastSelection = null;
    lastSelectedElement = null;
    lastClickTime = 0;
    mousePositionTime = 0;
    
    // Xóa visual highlights
    document.querySelectorAll('.screenshot-highlight').forEach(el => {
        el.classList.remove('screenshot-highlight');
    });
    
    console.log('✅ Extension KHÔNG HOẠT ĐỘNG cho đến lần click chuột phải tiếp theo');
}

// Thêm event listeners
function addEventListeners() {
    console.log('📝 Thêm event listeners cho tracking...');
    
    // Theo dõi click element
    document.addEventListener('click', handleElementClick, true);
    
    // Theo dõi text selection
    document.addEventListener('selectionchange', handleSelectionChange);
    
    // Theo dõi focus
    document.addEventListener('focus', handleFocusChange, true);
    
    console.log('✅ Đã thêm event listeners');
}

// Xử lý click element
function handleElementClick(e) {
    if (!isExtensionActive) return;
    
    manualSelectedElement = e.target;
    lastClickTime = Date.now();
    console.log('🎯 Chọn thủ công:', e.target.tagName, e.target.type, e.target.className);
    
    // Highlight visual cho người dùng
    addVisualHighlight(e.target);
}

// Xử lý thay đổi selection
function handleSelectionChange() {
    if (!isExtensionActive) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const rawRect = selection.getRangeAt(0).getBoundingClientRect();
        lastSelection = {
            text: selection.toString(),
            rect: {
                left: rawRect.left + window.scrollX,
                top: rawRect.top + window.scrollY,
                width: rawRect.width,
                height: rawRect.height
            },
            range: selection.getRangeAt(0).cloneRange()
        };
        console.log('📝 Phát hiện text selection:', lastSelection.text.substring(0, 50));
        console.log('📐 Raw rect:', rawRect);
        console.log('📐 Scroll offset:', { scrollX: window.scrollX, scrollY: window.scrollY });
        console.log('📐 Final rect:', lastSelection.rect);
        console.log('📐 Window size:', { innerWidth: window.innerWidth, innerHeight: window.innerHeight });
        console.log('📐 Screen size:', { width: screen.width, height: screen.height });
        console.log('📐 DPR:', window.devicePixelRatio);
        console.log('📐 Zoom level:', Math.round(window.devicePixelRatio * window.screen.width / window.innerWidth * 100) / 100);
    } else {
        lastSelection = null;
    }
}

// Xử lý thay đổi focus
function handleFocusChange(event) {
    if (!isExtensionActive) return;
    
    if (isInteractiveElement(event.target)) {
        lastFocusedElement = event.target;
        console.log('🎯 Focus trên element tương tác:', event.target.tagName, event.target.type);
    }
}

// Lưu trữ context menu info nhưng KHÔNG kích hoạt extension
document.addEventListener('contextmenu', (event) => {
    console.log('🖱️ Phát hiện click chuột phải...');
    
    // Bảo tồn text selection trong lúc click chuột phải
    const currentSelection = window.getSelection();
    if (currentSelection && currentSelection.rangeCount > 0 && !currentSelection.isCollapsed) {
        console.log('🔒 BẢO TỒN text selection trong lúc click chuột phải:', currentSelection.toString().substring(0, 50));
    }
    
    // Lưu context ngay lập tức
    lastSelectedElement = event.target;
    lastMousePosition = {
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY
    };
    mousePositionTime = Date.now();
    
    console.log('🖱️ Đã lưu context:', lastSelectedElement.tagName, lastMousePosition);
});

// Thêm visual highlight
function addVisualHighlight(element) {
    // Xóa highlights trước đó
    document.querySelectorAll('.screenshot-highlight').forEach(el => {
        el.classList.remove('screenshot-highlight');
    });
    
    // Thêm highlight cho element hiện tại
    element.classList.add('screenshot-highlight');
    
    // Thêm CSS nếu chưa có
    if (!document.getElementById('screenshot-highlight-style')) {
        const style = document.createElement('style');
        style.id = 'screenshot-highlight-style';
        style.textContent = `
            .screenshot-highlight {
                outline: 3px solid #00ff00 !important;
                outline-offset: 2px !important;
                background-color: rgba(0, 255, 0, 0.1) !important;
                transition: all 0.2s ease !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Tự động xóa highlight sau 5 giây
    setTimeout(() => {
        element.classList.remove('screenshot-highlight');
    }, 5000);
}

// Kiểm tra element có tương tác được không
function isInteractiveElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const type = element.type?.toLowerCase();
    
    // Form elements
    if (['input', 'select', 'textarea', 'button', 'option'].includes(tagName)) return true;
    
    // Links
    if (tagName === 'a' && element.href) return true;
    
    // Elements với thuộc tính tương tác
    if (element.contentEditable === 'true') return true;
    if (element.hasAttribute('onclick')) return true;
    if (element.hasAttribute('role')) return true;
    if (element.hasAttribute('tabindex') && element.tabIndex >= 0) return true;
    
    // ARIA roles
    const role = element.getAttribute('role');
    if (['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab', 'option'].includes(role)) return true;
    
    // Classes phổ biến
    const classList = element.className.toLowerCase();
    if (classList.includes('btn') || classList.includes('button') || 
        classList.includes('clickable') || classList.includes('interactive')) return true;
    
    return false;
}

// Lắng nghe messages từ background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ACTIVATE_EXTENSION') {
        console.log('🟢 KÍCH HOẠT extension thông qua background script...');
        activateExtension();
        sendResponse({ success: true });
        return true;
    } else if (message.type === 'FORCE_DEACTIVATE_EXTENSION') {
        console.log('🔴 BẮT BUỘC HỦY KÍCH HOẠT extension:', message.reason);
        deactivateExtension(message.reason || 'force_deactivated');
        sendResponse({ success: true });
        return true;
    } else if (message.type === 'GET_SELECTION_INFO') {
        // Đảm bảo extension được kích hoạt khi lấy thông tin selection
        if (!isExtensionActive) {
            console.log('🟢 Tự động kích hoạt extension cho selection info...');
            activateExtension();
        }

        const selectionInfo = getSelectionInfo(message.useMouseFallback);
        console.log('📤 Gửi selection info:', selectionInfo);

        // Hủy kích hoạt extension sau khi cung cấp thông tin screenshot
        setTimeout(() => {
            deactivateExtension('screenshot_taken');
        }, 1000);

        sendResponse(selectionInfo);
        return true;
    } else if (message.type === 'GET_VIEWPORT_SIZE') {
        console.log('📐 Lấy kích thước viewport...');
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight,
            dpr: window.devicePixelRatio || 1
        };
        console.log('📐 Viewport dimensions:', viewport);
        sendResponse(viewport);
        return true;
    } else if (message.type === 'COPY_TO_CLIPBOARD') {
        console.log('📋 Content script nhận yêu cầu copy clipboard...');
        
        (async () => {
            try {
                const result = await copyImageToClipboard(message.dataUrl);
                sendResponse({ success: true, result: result });
            } catch (error) {
                console.error('❌ Content script copy failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    } else if (message.type === 'ACTIVATE_REGION_SELECTOR') {
        console.log('🎯 Kích hoạt region selector cho:', message.purpose);
        
        (async () => {
            try {
                console.log('📋 Document state:', document.readyState);
                console.log('📋 Document body:', !!document.body);
                
                // Đợi DOM ready nếu cần
                if (document.readyState !== 'complete') {
                    console.log('⏳ Đợi DOM complete...');
                    await new Promise(resolve => {
                        if (document.readyState === 'complete') {
                            resolve();
                        } else {
                            document.addEventListener('DOMContentLoaded', resolve, { once: true });
                        }
                    });
                }
                
                // Tải region selector script
                if (!window.RegionSelector) {
                    await loadRegionSelectorScript();
                }
                
                console.log('🔍 Kiểm tra RegionSelector sau khi tải:', typeof window.RegionSelector);
                
                // Nếu vẫn không tải được, thử method khác
                if (!window.RegionSelector) {
                    console.log('🔄 Thử method inject script khác...');
                    await injectRegionSelectorDirect();
                }
                
                // Kiểm tra lần cuối
                if (!window.RegionSelector) {
                    throw new Error('Không thể tải RegionSelector class sau nhiều lần thử');
                }
                
                // Tạo region selector mới
                console.log('🔨 Đang tạo instance RegionSelector...');
                const regionSelector = new window.RegionSelector((selection) => {
                    console.log('📤 Gửi kết quả chọn vùng về background:', selection);
                    
                    // Gửi kết quả về background script
                    chrome.runtime.sendMessage({
                        type: 'REGION_SELECTED',
                        selection: selection,
                        purpose: message.purpose
                    });
                });
                
                console.log('✅ RegionSelector được tạo thành công:', regionSelector);
                sendResponse({ success: true });
            } catch (error) {
                console.error('❌ Lỗi kích hoạt region selector:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

// Lấy thông tin selection
function getSelectionInfo(useMouseFallback = false) {
    const dpr = window.devicePixelRatio || 1;
    
    console.log('🔍 Lấy thông tin selection...');
    console.log('📍 useMouseFallback:', useMouseFallback);
    console.log('📍 lastSelection:', lastSelection);
    console.log('📍 manualSelectedElement:', manualSelectedElement?.tagName);
    
    // PRIORITY 1: TEXT SELECTION - ưu tiên cao nhất
    if (lastSelection && lastSelection.rect.width > 0 && lastSelection.rect.height > 0) {
        console.log('✅ Sử dụng TEXT SELECTION (ƯU TIÊN CAO NHẤT)');
        console.log('📝 Text đã chọn:', lastSelection.text.substring(0, 100));
        return {
            type: 'selection',
            text: lastSelection.text,
            rect: {
                x: lastSelection.rect.left,
                y: lastSelection.rect.top,
                width: lastSelection.rect.width,
                height: lastSelection.rect.height
            },
            dpr: dpr
        };
    }
    
    // PRIORITY 2: Manual element selection
    if (manualSelectedElement && (Date.now() - lastClickTime) < 3000) {
        const rawRect = manualSelectedElement.getBoundingClientRect();
        if (rawRect.width > 0 && rawRect.height > 0) {
            console.log('✅ Sử dụng manual selection:', manualSelectedElement.tagName);
            
            const rect = {
                x: rawRect.left + window.scrollX,
                y: rawRect.top + window.scrollY,
                width: rawRect.width,
                height: rawRect.height
            };
            
            return {
                type: 'element',
                tagName: manualSelectedElement.tagName,
                elementType: manualSelectedElement.type || '',
                isInteractive: true,
                text: getElementDisplayText(manualSelectedElement),
                method: 'manual-selection',
                rect: rect,
                dpr: dpr
            };
        }
    }
    
    console.log('❌ Không tìm thấy element - sẽ mở công cụ vẽ');
    return null;
}

// Lấy text hiển thị của element
function getElementDisplayText(element) {
    if (!element) return '';
    
    if (element.tagName.toLowerCase() === 'input') {
        return element.placeholder || element.value || element.name || element.id || '';
    }
    
    if (element.tagName.toLowerCase() === 'select') {
        const selected = element.selectedOptions[0];
        return selected ? selected.textContent : element.name || element.id || '';
    }
    
    return element.textContent?.substring(0, 50) || element.title || element.alt || '';
}

// Copy ảnh vào clipboard từ content script
async function copyImageToClipboard(dataUrl) {
    console.log('📋 Content script: Bắt đầu copy ảnh vào clipboard...');
    console.log('📊 DataUrl length:', dataUrl.length);
    
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        throw new Error('DataUrl không hợp lệ');
    }
    
    // Always use clipboard API method
    return await clipboardApiMethod(dataUrl);
}

// Clipboard API method (shows permission popup)
async function clipboardApiMethod(dataUrl) {
    try {
        // Focus window để có user activation
        window.focus();
        if (document.body) {
            document.body.focus();
        }
        
        // Delay nhỏ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Convert dataUrl to blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Check clipboard API
        if (!navigator.clipboard) {
            throw new Error('Clipboard API not available');
        }
        
        // Copy to clipboard
        const clipboardItem = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([clipboardItem]);
        console.log('✅ Successfully copied to clipboard via API!');
        
        // Show success notification
        showCopyNotification('✅ Ảnh đã được copy vào clipboard!\nBạn có thể paste (Ctrl+V) vào ứng dụng khác.');
        
        return { method: 'clipboard_api', success: true };
        
    } catch (clipboardError) {
        console.error('❌ Clipboard API method failed:', clipboardError);
        throw new Error(`Clipboard API failed: ${clipboardError.message}`);
    }
}

// Show copy notification
function showCopyNotification(message) {
    const notification = document.createElement('div');
    
    // Handle multiline messages
    if (message.includes('\n')) {
        const lines = message.split('\n');
        notification.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
    } else {
        notification.textContent = message;
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        background: #2196F3;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        border-left: 4px solid #1976D2;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation CSS
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds với animation
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// Tải region selector script
async function loadRegionSelectorScript() {
    return new Promise((resolve, reject) => {
        console.log('🔄 Đang tải region selector script...');
        
        // Kiểm tra xem script đã được tải chưa
        if (document.querySelector('#region-selector-script')) {
            console.log('⚡ Script đã tồn tại, bỏ qua việc tải lại');
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.id = 'region-selector-script';
        const scriptUrl = chrome.runtime.getURL('modules/ocr/region-selector.js');
        console.log('📂 Script URL:', scriptUrl);
        
        script.src = scriptUrl;
        script.async = true;
        
        script.onload = () => {
            console.log('✅ Region selector script đã được tải thành công');
            console.log('🔍 Kiểm tra window.RegionSelector:', typeof window.RegionSelector);
            
            // Đợi một chút để script được execute hoàn toàn
            setTimeout(() => {
                console.log('🔍 Kiểm tra lại window.RegionSelector:', typeof window.RegionSelector);
                resolve();
            }, 100);
        };
        
        script.onerror = (error) => {
            console.error('❌ Không thể tải region selector script:', error);
            console.error('❌ Error event:', error);
            reject(new Error('Không thể tải region selector script'));
        };
        
        console.log('📝 Thêm script vào head...');
        try {
            document.head.appendChild(script);
            console.log('✅ Script element đã được thêm vào DOM');
        } catch (appendError) {
            console.error('❌ Lỗi thêm script vào DOM:', appendError);
            reject(appendError);
        }
    });
}

// Method inject trực tiếp script content
async function injectRegionSelectorDirect() {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('🔄 Đang fetch script content trực tiếp...');
            
            const scriptUrl = chrome.runtime.getURL('modules/ocr/region-selector.js');
            const response = await fetch(scriptUrl);
            const scriptContent = await response.text();
            
            console.log('✅ Đã fetch script content, length:', scriptContent.length);
            
            // Tạo script element với content trực tiếp
            const script = document.createElement('script');
            script.id = 'region-selector-direct';
            script.textContent = scriptContent;
            
            document.head.appendChild(script);
            console.log('✅ Đã inject script trực tiếp');
            
            // Đợi một chút để script execute
            setTimeout(() => {
                console.log('🔍 Kiểm tra window.RegionSelector sau inject:', typeof window.RegionSelector);
                resolve();
            }, 200);
            
        } catch (error) {
            console.error('❌ Lỗi inject script trực tiếp:', error);
            reject(error);
        }
    });
}
