class NotificationSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'notifications-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 3000) {
        const id = Date.now();
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.id = `notification-${id}`;

        const icon = this.getIcon(type);
        
        notification.innerHTML = `
            <i class="notification-icon fas ${icon}"></i>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.container.appendChild(notification);

        if (duration > 0) {
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => notification.remove(), 300);
            }, duration);
        }

        return id;
    }

    getIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    remove(id) {
        const notification = document.getElementById(`notification-${id}`);
        if (notification) {
            notification.remove();
        }
    }
}

class PresentationsManager {
    constructor() {
        this.maxPresentations = 50;
        this.currentPresentationId = null;
    }

    getAllPresentations() {
        const presentations = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('presentation_')) {
                presentations[key] = JSON.parse(localStorage.getItem(key));
            }
        }
        return presentations;
    }

    savePresentation(id, title, slides) {
        const presentationKey = `presentation_${id}`;
        const presentation = {
            id,
            title,
            slides,
            lastModified: Date.now()
        };
        localStorage.setItem(presentationKey, JSON.stringify(presentation));
    }

    loadPresentation(id) {
        const presentationKey = `presentation_${id}`;
        const data = localStorage.getItem(presentationKey);
        return data ? JSON.parse(data) : null;
    }

    deletePresentation(id) {
        const presentationKey = `presentation_${id}`;
        localStorage.removeItem(presentationKey);
    }

    canCreateNew() {
        return Object.keys(this.getAllPresentations()).length < this.maxPresentations;
    }
}

class SlideElement {
    constructor(type, x, y) {
        this.id = Date.now();
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = 100;
        this.height = type === 'circle' ? 100 : 50;
        this.content = '';
        this.color = '#2563eb';
        this.opacity = 100;
        this.zIndex = 1;
    }

    createElement() {
        const element = document.createElement('div');
        element.className = `slide-element ${this.type}-element`;
        element.id = `element-${this.id}`;
        element.style.left = `${this.x}px`;
        element.style.top = `${this.y}px`;
        element.style.width = `${this.width}px`;
        element.style.height = `${this.height}px`;
        element.style.zIndex = this.zIndex;
        
        if (this.type === 'text') {
            element.contentEditable = true;
            element.innerHTML = this.content || 'Double click to edit';
        } else {
            element.style.backgroundColor = this.color;
            element.style.opacity = this.opacity / 100;
        }

        this.addResizeHandles(element);
        return element;
    }

    addResizeHandles(element) {
        ['nw', 'ne', 'sw', 'se'].forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            element.appendChild(handle);
        });
    }

    resizeElement(e, handle, startRect) {
        const slideRect = this.currentSlide.getBoundingClientRect();
        const deltaX = e.clientX - startRect.x;
        const deltaY = e.clientY - startRect.y;
        
        switch(handle) {
            case 'se':
                this.width = Math.max(50, startRect.width + deltaX);
                this.height = Math.max(50, startRect.height + deltaY);
                break;
            case 'sw':
                this.x = Math.min(startRect.x + deltaX, startRect.x + startRect.width - 50);
                this.width = Math.max(50, startRect.width - deltaX);
                this.height = Math.max(50, startRect.height + deltaY);
                break;
            case 'ne':
                this.width = Math.max(50, startRect.width + deltaX);
                this.y = Math.min(startRect.y + deltaY, startRect.y + startRect.height - 50);
                this.height = Math.max(50, startRect.height - deltaY);
                break;
            case 'nw':
                this.x = Math.min(startRect.x + deltaX, startRect.x + startRect.width - 50);
                this.y = Math.min(startRect.y + deltaY, startRect.y + startRect.height - 50);
                this.width = Math.max(50, startRect.width - deltaX);
                this.height = Math.max(50, startRect.height - deltaY);
                break;
        }
    }
}

class Presentation {
    constructor() {
        this.notifications = new NotificationSystem();
        this.slides = [];
        this.currentSlideIndex = 0;
        this.id = Date.now();
        this.title = 'Untitled Presentation';
        this.manager = new PresentationsManager();
        this.selectedElement = null;
        this.isDragging = false;
        this.isResizing = false;
        this.dragOffset = { x: 0, y: 0 };
        this.lastNotificationTime = 0;
        this.notificationThrottle = 2000; // Minimum time between notifications
        this.gridEnabled = false;
        this.gridSize = 20;
        this.gridColor = '#e2e8f0';
        this.snapToGrid = false;
        this.isPresenting = false;
        this.presentationContainer = document.getElementById('presentationMode');
        this.presentationSlide = this.presentationContainer.querySelector('.presentation-slide');
        this.clipboard = null;
        this.slideContextMenu = document.getElementById('slideContextMenu');
        this.elementContextMenu = document.getElementById('elementContextMenu');
        this.contextMenuActive = false;
        this.showRulers = true;
        this.init();
        this.initToolbarDrag();
        this.initPanelToggles();
        this.initRulers();
    }

    init() {
        this.bindElements();
        this.bindEvents();
        this.setupPresentationList();
        this.createNewSlide();
        this.autoSave();
        this.initializeElementTools();
        this.initializeRichTextTools();
        this.notifications.show('Presentation loaded', 'success');
        this.initContextMenus();
    }

    initContextMenus() {
        // Close context menus on window click
        window.addEventListener('click', () => {
            if (this.contextMenuActive) {
                this.hideContextMenus();
            }
        });

        // Prevent default context menu
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Slide context menu
        this.slidesList.addEventListener('contextmenu', (e) => {
            const slideThumb = e.target.closest('.slide-thumbnail');
            if (slideThumb) {
                e.preventDefault();
                const index = Array.from(slideThumb.parentElement.children).indexOf(slideThumb);
                this.showSlideContextMenu(e.clientX, e.clientY, index);
            }
        });

        // Element context menu
        this.currentSlide.addEventListener('contextmenu', (e) => {
            const element = e.target.closest('.slide-element');
            if (element) {
                e.preventDefault();
                this.showElementContextMenu(e.clientX, e.clientY, element);
            }
        });

        // Handle context menu actions
        this.slideContextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                this.handleSlideContextMenuAction(action);
            }
        });

        this.elementContextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                this.handleElementContextMenuAction(action);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.contentEditable === 'true') return;
            
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'c': this.copySelected(); break;
                    case 'x': this.cutSelected(); break;
                    case 'v': this.paste(); break;
                    case 'd':
                        e.preventDefault();
                        this.duplicateSelected();
                        break;
                }
            } else if (e.key === 'Delete') {
                this.deleteSelected();
            }
        });
    }

    showSlideContextMenu(x, y) {
        this.hideContextMenus();
        this.contextMenuActive = true;
        document.body.classList.add('using-context-menu');
        
        this.slideContextMenu.classList.add('active');
        this.slideContextMenu.style.left = `${x}px`;
        this.slideContextMenu.style.top = `${y}px`;
        
        // Enable/disable paste option
        const pasteOption = this.slideContextMenu.querySelector('[data-action="paste"]');
        pasteOption.style.opacity = this.clipboard ? '1' : '0.5';
        pasteOption.style.pointerEvents = this.clipboard ? 'auto' : 'none';
    }

    showElementContextMenu(x, y, element) {
        this.hideContextMenus();
        this.contextMenuActive = true;
        document.body.classList.add('using-context-menu');
        
        this.elementContextMenu.classList.add('active');
        this.elementContextMenu.style.left = `${x}px`;
        this.elementContextMenu.style.top = `${y}px`;
        
        // Select the element if not already selected
        if (element !== this.selectedElement) {
            this.selectElement(element);
        }

        // Enable/disable paste option
        const pasteOption = this.elementContextMenu.querySelector('[data-action="paste"]');
        pasteOption.style.opacity = this.clipboard ? '1' : '0.5';
        pasteOption.style.pointerEvents = this.clipboard ? 'auto' : 'none';
    }

    hideContextMenus() {
        this.slideContextMenu.classList.remove('active');
        this.elementContextMenu.classList.remove('active');
        this.contextMenuActive = false;
        document.body.classList.remove('using-context-menu');
    }

    handleSlideContextMenuAction(action) {
        switch(action) {
            case 'duplicate': this.duplicateSlide(); break;
            case 'copy': this.copySlide(); break;
            case 'paste': this.pasteSlide(); break;
            case 'delete': this.deleteSlide(); break;
        }
        this.hideContextMenus();
    }

    handleElementContextMenuAction(action) {
        switch(action) {
            case 'cut': this.cutSelected(); break;
            case 'copy': this.copySelected(); break;
            case 'paste': this.paste(); break;
            case 'bringForward': this.updateElementZIndex(1); break;
            case 'sendBackward': this.updateElementZIndex(-1); break;
            case 'delete': this.deleteSelectedElement(); break;
        }
        this.hideContextMenus();
    }

    duplicateSlide() {
        const currentSlide = this.slides[this.currentSlideIndex];
        const newSlide = JSON.parse(JSON.stringify(currentSlide));
        newSlide.id = Date.now();
        this.slides.splice(this.currentSlideIndex + 1, 0, newSlide);
        this.renderSlidesList();
        this.save();
        this.notifications.show('Slide duplicated', 'success');
    }

    copySlide() {
        this.clipboard = {
            type: 'slide',
            data: JSON.parse(JSON.stringify(this.slides[this.currentSlideIndex]))
        };
        this.notifications.show('Slide copied', 'success');
    }

    pasteSlide() {
        if (this.clipboard && this.clipboard.type === 'slide') {
            const newSlide = JSON.parse(JSON.stringify(this.clipboard.data));
            newSlide.id = Date.now();
            this.slides.splice(this.currentSlideIndex + 1, 0, newSlide);
            this.renderSlidesList();
            this.save();
            this.notifications.show('Slide pasted', 'success');
        }
    }

    deleteSlide() {
        if (this.slides.length > 1) {
            this.slides.splice(this.currentSlideIndex, 1);
            this.currentSlideIndex = Math.max(0, this.currentSlideIndex - 1);
            this.renderSlidesList();
            this.renderCurrentSlide();
            this.save();
            this.notifications.show('Slide deleted', 'success');
        } else {
            this.notifications.show('Cannot delete last slide', 'warning');
        }
    }

    copySelected() {
        if (this.selectedElement) {
            const elementData = this.getElementData(this.selectedElement);
            if (elementData) {
                this.clipboard = {
                    type: 'element',
                    data: JSON.parse(JSON.stringify(elementData))
                };
                this.notifications.show('Element copied', 'success');
            }
        }
    }

    cutSelected() {
        this.copySelected();
        this.deleteSelectedElement();
    }

    paste() {
        if (!this.clipboard) return;

        if (this.clipboard.type === 'element') {
            const newElement = JSON.parse(JSON.stringify(this.clipboard.data));
            newElement.id = Date.now();
            newElement.x += 20; // Offset pasted element
            newElement.y += 20;
            
            if (!this.slides[this.currentSlideIndex].elements) {
                this.slides[this.currentSlideIndex].elements = [];
            }
            
            this.slides[this.currentSlideIndex].elements.push(newElement);
            this.renderCurrentSlide();
            this.save();
            this.notifications.show('Element pasted', 'success');
        }
    }

    duplicateSelected() {
        if (this.selectedElement) {
            this.copySelected();
            this.paste();
        }
    }

    bindElements() {
        try {
            // Required elements
            this.slidesList = this.getRequiredElement('slidesList');
            this.currentSlide = this.getRequiredElement('currentSlide');
            this.presentationTitle = this.getRequiredElement('presentationTitle');
            this.presentationsList = this.getRequiredElement('presentationsList');
            
            // Element creation tools
            this.addTextBtn = this.getRequiredElement('addTextbox');
            this.addRectBtn = this.getRequiredElement('addRect');
            this.addCircleBtn = this.getRequiredElement('addCircle');
            
            // Element property controls
            this.elementProperties = this.getRequiredElement('elementProperties');
            this.elementColor = this.getRequiredElement('elementColor');
            this.elementOpacity = this.getRequiredElement('elementOpacity');
            
            // Control buttons
            this.newSlideBtn = this.getRequiredElement('newSlide');
            this.presentBtn = this.getRequiredElement('present');
            
            // Presentation manager elements
            this.presentationManagerBtn = this.getRequiredElement('presentationManager');
            this.presentationManagerModal = document.querySelector('#presentationManager.modal');
            this.modalCloseBtn = this.presentationManagerModal.querySelector('.modal-close');
            this.newPresentationBtn = this.getRequiredElement('newPresentationBtn');
            this.bringForwardBtn = this.getRequiredElement('bringForward');
            this.sendBackwardBtn = this.getRequiredElement('sendBackward');
            this.deleteElementBtn = this.getRequiredElement('deleteElement');
            
            // Optional elements
            this.bgColorInput = document.getElementById('bgColor');
            this.layoutSelect = document.getElementById('slideLayout');
        } catch (error) {
            this.notifications?.show('Failed to initialize: Missing required elements', 'error');
            console.error('Initialization error:', error);
            throw error;
        }
    }

    getRequiredElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Required element #${id} not found`);
        }
        return element;
    }

    bindEvents() {
        // Required event listeners
        this.newSlideBtn.addEventListener('click', () => this.createNewSlide());
        this.presentBtn.addEventListener('click', () => this.startPresentation());
        this.presentationTitle.addEventListener('input', () => {
            this.title = this.presentationTitle.textContent;
            this.save();
        });

        // Update presentation manager events
        this.presentationManagerBtn.addEventListener('click', () => this.togglePresentationManager());
        this.modalCloseBtn.addEventListener('click', () => this.togglePresentationManager());
        this.presentationManagerModal.addEventListener('click', (e) => {
            if (e.target === this.presentationManagerModal) {
                this.togglePresentationManager();
            }
        });
        this.newPresentationBtn.addEventListener('click', () => {
            this.createNewPresentation();
            this.togglePresentationManager();
        });

        // Optional event listeners
        if (this.bgColorInput) {
            this.bgColorInput.addEventListener('change', (e) => this.updateSlideBackground(e.target.value));
        }
        
        if (this.layoutSelect) {
            this.layoutSelect.addEventListener('change', (e) => this.updateSlideLayout(e.target.value));
        }

        // Auto-save on slide content changes
        this.currentSlide.addEventListener('input', () => this.save());
    }

    save() {
        try {
            this.updateSlideContent();
            this.manager.savePresentation(this.id, this.title, this.slides);
            this.showMinimalSaveStatus('success');
        } catch (error) {
            this.showMinimalSaveStatus('error');
            console.error('Save error:', error);
        }
    }

    showMinimalSaveStatus(status = 'success') {
        const now = Date.now();
        // Only show new notification if enough time has passed
        if (now - this.lastNotificationTime < this.notificationThrottle) {
            return;
        }
        
        const statusText = document.getElementById('saveStatus');
        if (!statusText) {
            const statusContainer = document.createElement('div');
            statusContainer.id = 'saveStatus';
            statusContainer.className = 'save-status';
            document.querySelector('.presentation-controls').appendChild(statusContainer);
        }

        const statusIcon = status === 'success' ? 
            '<i class="fas fa-check"></i>' : 
            '<i class="fas fa-exclamation-circle"></i>';
        
        document.getElementById('saveStatus').innerHTML = statusIcon;
        document.getElementById('saveStatus').className = `save-status ${status}`;

        this.lastNotificationTime = now;
    }

    showSaveIndicator() {
        const indicator = document.getElementById('saveIndicator');
        indicator.textContent = 'Saved';
        indicator.style.opacity = '1';
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }

    autoSave() {
        setInterval(() => this.save(), 30000); // Auto-save every 30 seconds
    }

    createNewSlide() {
        const slide = {
            id: Date.now(),
            backgroundColor: '#ffffff',
            layout: 'title',
            content: {
                title: 'New Slide',
                body: ''
            }
        };

        this.slides.push(slide);
        this.currentSlideIndex = this.slides.length - 1;
        this.renderSlidesList();
        this.renderCurrentSlide();
    }

    renderSlidesList() {
        this.slidesList.innerHTML = this.slides.map((slide, index) => `
            <div class="slide-thumbnail ${index === this.currentSlideIndex ? 'active' : ''}"
                 onclick="presentation.selectSlide(${index})"
                 style="background-color: ${slide.backgroundColor}">
                <div class="slide-number">${index + 1}</div>
            </div>
        `).join('');
    }

    renderCurrentSlide() {
        const slide = this.slides[this.currentSlideIndex];
        this.currentSlide.style.backgroundColor = slide.backgroundColor;
        
        // Update properties panel if elements exist
        if (this.bgColorInput) {
            this.bgColorInput.value = slide.backgroundColor;
        }
        
        if (this.layoutSelect) {
            this.layoutSelect.value = slide.layout || 'blank';
        }

        // Clear existing content
        this.currentSlide.innerHTML = '';

        // Add new content
        if (slide.elements && Array.isArray(slide.elements)) {
            slide.elements.forEach(elementData => {
                try {
                    const element = new SlideElement(
                        elementData.type,
                        elementData.x,
                        elementData.y
                    );
                    Object.assign(element, elementData);
                    this.currentSlide.appendChild(element.createElement());
                } catch (error) {
                    console.error('Failed to render element:', error);
                }
            });
        }
    }

    getLayoutTemplate(slide) {
        switch(slide.layout) {
            case 'title':
                return `
                    <div class="slide-content title-layout">
                        <h1 contenteditable="true">${slide.content.title}</h1>
                    </div>
                `;
            case 'content':
                return `
                    <div class="slide-content content-layout">
                        <h2 contenteditable="true">${slide.content.title}</h2>
                        <div contenteditable="true" class="body-content">${slide.content.body}</div>
                    </div>
                `;
            // Add more layouts as needed
            default:
                return '';
        }
    }

    selectSlide(index) {
        this.currentSlideIndex = index;
        this.renderSlidesList();
        this.renderCurrentSlide();
    }

    updateSlideBackground(color) {
        this.slides[this.currentSlideIndex].backgroundColor = color;
        this.renderSlidesList();
        this.renderCurrentSlide();
    }

    updateSlideLayout(layout) {
        this.slides[this.currentSlideIndex].layout = layout;
        this.renderCurrentSlide();
    }

    startPresentation() {
        this.isPresenting = true;
        this.presentationContainer.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Initialize presentation controls
        const controls = this.presentationContainer.querySelector('.presentation-controls');
        const prevBtn = document.getElementById('prevSlide');
        const nextBtn = document.getElementById('nextSlide');
        const exitBtn = document.getElementById('exitPresentation');
        
        prevBtn.onclick = () => this.previousSlide();
        nextBtn.onclick = () => this.nextSlide();
        exitBtn.onclick = () => this.exitPresentation();
        
        // Mouse movement handler for controls visibility
        let hideTimeout;
        const handleMouseMove = () => {
            controls.classList.remove('hidden');
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                controls.classList.add('hidden');
            }, 3000);
        };
        
        this.presentationContainer.addEventListener('mousemove', handleMouseMove);
        this.presentationContainer.addEventListener('click', handleMouseMove);
        
        // Initial hide timeout
        handleMouseMove();
        
        // Keyboard controls
        this.presentationKeyHandler = (e) => this.handlePresentationKeyboard(e);
        document.addEventListener('keydown', this.presentationKeyHandler);
        
        // Show keyboard shortcuts
        this.showKeyboardShortcuts();
        
        // Clear and render first slide
        this.presentationSlide.innerHTML = '';
        this.renderPresentationSlide();
        this.updateSlideCounter();

        // Store cleanup functions
        this.presentationCleanup = () => {
            clearTimeout(hideTimeout);
            this.presentationContainer.removeEventListener('mousemove', handleMouseMove);
            this.presentationContainer.removeEventListener('click', handleMouseMove);
            document.removeEventListener('keydown', this.presentationKeyHandler);
        };
    }

    renderPresentationSlide(direction = 'none') {
        const slide = this.slides[this.currentSlideIndex];
        
        // Create new slide content
        const content = document.createElement('div');
        content.className = 'slide-content';
        content.style.backgroundColor = slide.backgroundColor;

        // Add transition classes
        if (direction !== 'none') {
            content.classList.add(`slide-enter-${direction}`);
        }
        
        // Clone slide elements
        if (slide.elements && Array.isArray(slide.elements)) {
            slide.elements.forEach(elementData => {
                try {
                    const element = document.createElement('div');
                    element.className = `slide-element ${elementData.type}-element`;
                    element.style.position = 'absolute';
                    element.style.left = `${elementData.x}px`;
                    element.style.top = `${elementData.y}px`;
                    element.style.width = `${elementData.width}px`;
                    element.style.height = `${elementData.height}px`;
                    element.style.zIndex = elementData.zIndex;

                    if (elementData.type === 'text') {
                        element.innerHTML = elementData.content || '';
                    } else {
                        element.style.backgroundColor = elementData.color;
                        element.style.opacity = elementData.opacity / 100;
                        if (elementData.type === 'circle') {
                            element.style.borderRadius = '50%';
                        }
                    }

                    content.appendChild(element);
                } catch (error) {
                    console.error('Failed to render element:', error);
                }
            });
        }

        // Handle transitions
        const currentContent = this.presentationSlide.querySelector('.slide-content');
        if (currentContent) {
            const exitDirection = direction === 'right' ? 'left' : 'right';
            currentContent.classList.add(`slide-exit-${exitDirection}`);
            currentContent.addEventListener('animationend', () => {
                currentContent.remove();
            }, { once: true });
        }

        this.presentationSlide.appendChild(content);

        // Remove any orphaned slides after animation
        setTimeout(() => {
            const oldSlides = this.presentationSlide.querySelectorAll('.slide-content:not(:last-child)');
            oldSlides.forEach(slide => slide.remove());
        }, 300);
    }

    nextSlide() {
        if (this.currentSlideIndex < this.slides.length - 1) {
            this.currentSlideIndex++;
            this.renderPresentationSlide('right');
            this.updateSlideCounter();
        }
    }

    previousSlide() {
        if (this.currentSlideIndex > 0) {
            this.currentSlideIndex--;
            this.renderPresentationSlide('left');
            this.updateSlideCounter();
        }
    }

    exitPresentation() {
        this.isPresenting = false;
        this.presentationContainer.classList.remove('active');
        document.body.style.overflow = '';
        if (this.presentationCleanup) {
            this.presentationCleanup();
            this.presentationCleanup = null;
        }
        this.presentationSlide.innerHTML = '';
    }

    updateSlideCounter() {
        const counter = document.getElementById('slideCounter');
        counter.textContent = `${this.currentSlideIndex + 1}/${this.slides.length}`;
    }

    handlePresentationKeyboard(e) {
        if (!this.isPresenting) return;

        switch(e.key) {
            case 'ArrowRight':
            case 'Space':
            case 'PageDown':
                e.preventDefault();
                this.nextSlide();
                break;
            case 'ArrowLeft':
            case 'PageUp':
                e.preventDefault();
                this.previousSlide();
                break;
            case 'Escape':
                e.preventDefault();
                this.exitPresentation();
                break;
            case '?':
                e.preventDefault();
                this.toggleKeyboardShortcuts();
                break;
        }
    }

    showKeyboardShortcuts() {
        // Create keyboard shortcuts overlay if it doesn't exist
        if (!document.querySelector('.keyboard-shortcuts')) {
            const shortcuts = document.createElement('div');
            shortcuts.className = 'keyboard-shortcuts';
            shortcuts.innerHTML = `
                <div><kbd>→</kbd> or <kbd>Space</kbd> Next slide</div>
                <div><kbd>←</kbd> Previous slide</div>
                <div><kbd>Esc</kbd> Exit presentation</div>
                <div><kbd>?</kbd> Toggle shortcuts</div>
            `;
            this.presentationContainer.appendChild(shortcuts);
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                shortcuts.classList.add('visible');
                setTimeout(() => shortcuts.classList.remove('visible'), 3000);
            }, 500);
        }
    }

    toggleKeyboardShortcuts() {
        const shortcuts = document.querySelector('.keyboard-shortcuts');
        if (shortcuts) {
            shortcuts.classList.toggle('visible');
        }
    }

    createNewPresentation() {
        try {
            if (!this.manager.canCreateNew()) {
                this.notifications.show('Maximum number of presentations reached', 'warning');
                return;
            }
            this.id = Date.now();
            this.title = 'Untitled Presentation';
            this.slides = [];
            this.currentSlideIndex = 0;
            this.presentationTitle.textContent = this.title;
            this.createNewSlide();
            this.save();
            this.setupPresentationList();
            this.notifications.show('New presentation created', 'success');
        } catch (error) {
            this.notifications.show('Failed to create presentation', 'error');
            console.error('Create error:', error);
        }
    }

    loadPresentation(id) {
        const presentation = this.manager.loadPresentation(id);
        if (presentation) {
            this.id = presentation.id;
            this.title = presentation.title;
            this.slides = presentation.slides;
            this.currentSlideIndex = 0;
            this.presentationTitle.textContent = this.title;
            this.renderSlidesList();
            this.renderCurrentSlide();
        }
    }

    setupPresentationList() {
        const presentations = this.manager.getAllPresentations();
        this.presentationsList.innerHTML = Object.values(presentations)
            .sort((a, b) => b.lastModified - a.lastModified)
            .map(p => `
                <div class="presentation-item">
                    <div class="presentation-info">
                        <div class="presentation-title">${p.title}</div>
                        <div class="presentation-date">Last modified: ${new Date(p.lastModified).toLocaleString()}</div>
                    </div>
                    <div class="presentation-actions">
                        <button class="primary-btn" onclick="presentation.loadAndClose(${p.id})">
                            <i class="fas fa-folder-open"></i> Open
                        </button>
                        <button class="delete-btn" onclick="presentation.deletePresentation(${p.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
    }

    deletePresentation(id) {
        if (confirm('Are you sure you want to delete this presentation?')) {
            try {
                this.manager.deletePresentation(id);
                this.setupPresentationList();
                if (this.id === id) {
                    this.createNewPresentation();
                }
                this.notifications.show('Presentation deleted', 'success');
            } catch (error) {
                this.notifications.show('Failed to delete presentation', 'error');
                console.error('Delete error:', error);
            }
        }
    }

    togglePresentationsList() {
        const modal = document.getElementById('presentationsModal');
        modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    }

    initializeElementTools() {
        this.addTextBtn.addEventListener('click', () => this.addElement('text'));
        this.addRectBtn.addEventListener('click', () => this.addElement('shape'));
        this.addCircleBtn.addEventListener('click', () => this.addElement('circle'));
        
        this.currentSlide.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());

        this.elementColor.addEventListener('change', (e) => this.updateElementStyle('color', e.target.value));
        this.elementOpacity.addEventListener('input', (e) => this.updateElementStyle('opacity', e.target.value));
        this.bringForwardBtn.addEventListener('click', () => this.updateElementZIndex(1));
        this.sendBackwardBtn.addEventListener('click', () => this.updateElementZIndex(-1));
        this.deleteElementBtn.addEventListener('click', () => this.deleteSelectedElement());
    }

    addElement(type) {
        try {
            const rect = this.currentSlide.getBoundingClientRect();
            const x = (rect.width - 100) / 2;
            const y = (rect.height - 50) / 2;
            
            const element = new SlideElement(type, x, y);
            const elementNode = element.createElement();
            
            this.currentSlide.appendChild(elementNode);
            this.selectElement(elementNode);
            
            // Save element to slide data
            if (!this.slides[this.currentSlideIndex].elements) {
                this.slides[this.currentSlideIndex].elements = [];
            }
            this.slides[this.currentSlideIndex].elements.push(element);
            this.save();
            this.notifications.show(`Added new ${type} element`, 'success');
        } catch (error) {
            this.notifications.show('Failed to add element', 'error');
            console.error('Add element error:', error);
        }
    }

    handleMouseDown(e) {
        const element = e.target.closest('.slide-element');
        if (!element) {
            this.deselectElement();
            return;
        }

        if (e.target.classList.contains('resize-handle')) {
            this.isResizing = true;
            this.resizeHandle = e.target.classList[1]; // nw, ne, sw, se
        } else {
            this.isDragging = true;
            const rect = element.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        }

        this.selectElement(element);
    }

    handleMouseMove(e) {
        if (!this.selectedElement) return;

        if (this.isDragging) {
            const rect = this.currentSlide.getBoundingClientRect();
            let x = e.clientX - rect.left - this.dragOffset.x;
            let y = e.clientY - rect.top - this.dragOffset.y;

            x = Math.max(0, Math.min(x, rect.width - this.selectedElement.offsetWidth));
            y = Math.max(0, Math.min(y, rect.height - this.selectedElement.offsetHeight));

            this.updateElementPosition(this.selectedElement, x, y);
        } else if (this.isResizing) {
            const rect = this.currentSlide.getBoundingClientRect();
            const elementRect = this.selectedElement.getBoundingClientRect();
            const deltaX = e.clientX - (rect.left + parseInt(this.selectedElement.style.left));
            const deltaY = e.clientY - (rect.top + parseInt(this.selectedElement.style.top));

            switch (this.resizeHandle) {
                case 'se':
                    this.selectedElement.style.width = `${deltaX}px`;
                    this.selectedElement.style.height = `${deltaY}px`;
                    break;
                case 'sw':
                    const newWidthSW = elementRect.right - e.clientX;
                    this.selectedElement.style.left = `${e.clientX - rect.left}px`;
                    this.selectedElement.style.width = `${newWidthSW}px`;
                    this.selectedElement.style.height = `${deltaY}px`;
                    break;
                case 'ne':
                    const newHeightNE = elementRect.bottom - e.clientY;
                    this.selectedElement.style.top = `${e.clientY - rect.top}px`;
                    this.selectedElement.style.width = `${deltaX}px`;
                    this.selectedElement.style.height = `${newHeightNE}px`;
                    break;
                case 'nw':
                    const newWidthNW = elementRect.right - e.clientX;
                    const newHeightNW = elementRect.bottom - e.clientY;
                    this.selectedElement.style.left = `${e.clientX - rect.left}px`;
                    this.selectedElement.style.top = `${e.clientY - rect.top}px`;
                    this.selectedElement.style.width = `${newWidthNW}px`;
                    this.selectedElement.style.height = `${newHeightNW}px`;
                    break;
            }

            // Enforce minimum size
            const minSize = 50;
            if (parseInt(this.selectedElement.style.width) < minSize) {
                this.selectedElement.style.width = `${minSize}px`;
            }
            if (parseInt(this.selectedElement.style.height) < minSize) {
                this.selectedElement.style.height = `${minSize}px`;
            }
        }
    }

    handleMouseUp() {
        if (this.isDragging || this.isResizing) {
            this.updateElementData();
            this.save();
        }
        this.isDragging = false;
        this.isResizing = false;
    }

    selectElement(element) {
        this.deselectElement();
        this.selectedElement = element;
        element.classList.add('selected');
        this.elementProperties.style.display = 'block';
        
        // Update property controls
        const elementData = this.getElementData(element);
        if (elementData) {
            this.elementColor.value = elementData.color;
            this.elementOpacity.value = elementData.opacity;
        }
    }

    deselectElement() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
        }
        this.selectedElement = null;
        this.elementProperties.style.display = 'none';
    }

    updateElementStyle(property, value) {
        if (!this.selectedElement) return;

        const elementData = this.getElementData(this.selectedElement);
        if (!elementData) return;

        switch (property) {
            case 'color':
                this.selectedElement.style.backgroundColor = value;
                elementData.color = value;
                break;
            case 'opacity':
                this.selectedElement.style.opacity = value / 100;
                elementData.opacity = parseInt(value);
                break;
        }

        this.save();
    }

    updateElementZIndex(change) {
        if (!this.selectedElement) return;

        const elementData = this.getElementData(this.selectedElement);
        if (!elementData) return;

        elementData.zIndex += change;
        this.selectedElement.style.zIndex = elementData.zIndex;
        this.save();
    }

    deleteSelectedElement() {
        try {
            if (!this.selectedElement) return;

            const elementId = this.selectedElement.id.replace('element-', '');
            this.slides[this.currentSlideIndex].elements = 
                this.slides[this.currentSlideIndex].elements.filter(e => e.id !== parseInt(elementId));
            
            this.selectedElement.remove();
            this.deselectElement();
            this.save();
            this.notifications.show('Element deleted', 'success');
        } catch (error) {
            this.notifications.show('Failed to delete element', 'error');
            console.error('Delete error:', error);
        }
    }

    getElementData(element) {
        const elementId = parseInt(element.id.replace('element-', ''));
        return this.slides[this.currentSlideIndex].elements?.find(e => e.id === elementId);
    }

    updateElementData() {
        if (!this.selectedElement) return;

        const elementData = this.getElementData(this.selectedElement);
        if (!elementData) return;

        const rect = this.selectedElement.getBoundingClientRect();
        const slideRect = this.currentSlide.getBoundingClientRect();

        elementData.x = rect.left - slideRect.left;
        elementData.y = rect.top - slideRect.top;
        elementData.width = rect.width;
        elementData.height = rect.height;
        
        if (elementData.type === 'text') {
            elementData.content = this.selectedElement.innerHTML;
        }
    }

    updateSlideContent() {
        const currentSlide = this.slides[this.currentSlideIndex];
        const contentElements = this.currentSlide.querySelectorAll('[contenteditable="true"]');
        
        contentElements.forEach(el => {
            if (el.classList.contains('slide-title')) {
                currentSlide.content.title = el.innerHTML;
            } else if (el.classList.contains('slide-body')) {
                currentSlide.content.body = el.innerHTML;
            }
        });
    }

    togglePresentationManager() {
        this.presentationManagerModal.classList.toggle('active');
        if (this.presentationManagerModal.classList.contains('active')) {
            this.setupPresentationList();
        }
    }

    loadAndClose(id) {
        this.loadPresentation(id);
        this.togglePresentationManager();
    }

    initializeRichTextTools() {
        const tools = {
            bold: document.getElementById('boldText'),
            italic: document.getElementById('italicText'),
            underline: document.getElementById('underlineText'),
            alignLeft: document.getElementById('alignLeft'),
            alignCenter: document.getElementById('alignCenter'),
            alignRight: document.getElementById('alignRight'),
            bulletList: document.getElementById('bulletList'),
            numberedList: document.getElementById('numberedList'),
            fontFamily: document.getElementById('fontFamily'),
            fontSize: document.getElementById('fontSize'),
            textColor: document.getElementById('textColor'),
            toggleGrid: document.getElementById('toggleGrid'),
            gridSize: document.getElementById('gridSize'),
            gridColor: document.getElementById('gridColor'),
            snapToGrid: document.getElementById('snapToGrid')
        };

        // Text formatting
        tools.bold.onclick = () => document.execCommand('bold', false);
        tools.italic.onclick = () => document.execCommand('italic', false);
        tools.underline.onclick = () => document.execCommand('underline', false);
        
        // Alignment
        tools.alignLeft.onclick = () => document.execCommand('justifyLeft', false);
        tools.alignCenter.onclick = () => document.execCommand('justifyCenter', false);
        tools.alignRight.onclick = () => document.execCommand('justifyRight', false);
        
        // Lists
        tools.bulletList.onclick = () => document.execCommand('insertUnorderedList', false);
        tools.numberedList.onclick = () => document.execCommand('insertOrderedList', false);
        
        // Font controls
        tools.fontFamily.onchange = (e) => document.execCommand('fontName', false, e.target.value);
        tools.fontSize.onchange = (e) => document.execCommand('fontSize', false, e.target.value);
        tools.textColor.onchange = (e) => document.execCommand('foreColor', false, e.target.value);

        // Grid controls
        tools.toggleGrid.onclick = () => this.toggleGrid();
        tools.gridSize.onchange = (e) => this.updateGridSize(e.target.value);
        tools.gridColor.onchange = (e) => this.updateGridColor(e.target.value);
        tools.snapToGrid.onchange = (e) => this.toggleSnapToGrid(e.target.checked);

        // Update toolbar state on selection
        document.addEventListener('selectionchange', () => this.updateToolbarState());

        // Update grid controls
        const snapToGrid = document.getElementById('snapToGrid');
        const gridSize = document.getElementById('gridSize');
        const gridColor = document.getElementById('gridColor');

        snapToGrid.addEventListener('change', (e) => {
            this.snapToGrid = e.target.checked;
        });

        gridSize.addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            if (this.gridEnabled) this.renderGrid();
        });

        gridColor.addEventListener('change', (e) => {
            this.gridColor = e.target.value;
            if (this.gridEnabled) this.renderGrid();
        });
    }

    updateToolbarState() {
        if (!this.selectedElement?.isContentEditable) return;
        
        const state = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            // ...add more states as needed
        };

        // Update button states
        Object.entries(state).forEach(([command, active]) => {
            const button = document.getElementById(`${command}Text`);
            if (button) {
                button.classList.toggle('active', active);
            }
        });
    }

    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        document.getElementById('toggleGrid').classList.toggle('active');
        this.renderGrid();
    }

    renderGrid() {
        if (!this.gridEnabled) {
            if (this.currentSlide.querySelector('.grid-overlay')) {
                this.currentSlide.querySelector('.grid-overlay').innerHTML = '';
            }
            return;
        }

        let gridOverlay = this.currentSlide.querySelector('.grid-overlay');
        if (!gridOverlay) {
            gridOverlay = document.createElement('div');
            gridOverlay.className = 'grid-overlay';
            this.currentSlide.appendChild(gridOverlay);
        }

        const bounds = this.currentSlide.getBoundingClientRect();
        const svg = `
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
                        <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" 
                              fill="none" 
                              stroke="${this.gridColor}" 
                              stroke-width="0.5"
                              vector-effect="non-scaling-stroke"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>`;
        
        gridOverlay.innerHTML = svg;
    }

    snapToGridValue(value) {
        if (!this.snapToGrid) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    updateElementPosition(element, x, y) {
        if (this.snapToGrid) {
            x = Math.round(x / this.gridSize) * this.gridSize;
            y = Math.round(y / this.gridSize) * this.gridSize;
        }
        
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }

    // Update handleMouseMove to use snap to grid
    handleMouseMove(e) {
        if (!this.selectedElement) return;

        if (this.isDragging) {
            const rect = this.currentSlide.getBoundingClientRect();
            let x = e.clientX - rect.left - this.dragOffset.x;
            let y = e.clientY - rect.top - this.dragOffset.y;

            x = Math.max(0, Math.min(x, rect.width - this.selectedElement.offsetWidth));
            y = Math.max(0, Math.min(y, rect.height - this.selectedElement.offsetHeight));

            this.updateElementPosition(this.selectedElement, x, y);
        } else if (this.isResizing) {
            const rect = this.currentSlide.getBoundingClientRect();
            const elementRect = this.selectedElement.getBoundingClientRect();
            const deltaX = e.clientX - (rect.left + parseInt(this.selectedElement.style.left));
            const deltaY = e.clientY - (rect.top + parseInt(this.selectedElement.style.top));

            switch (this.resizeHandle) {
                case 'se':
                    this.selectedElement.style.width = `${deltaX}px`;
                    this.selectedElement.style.height = `${deltaY}px`;
                    break;
                case 'sw':
                    const newWidthSW = elementRect.right - e.clientX;
                    this.selectedElement.style.left = `${e.clientX - rect.left}px`;
                    this.selectedElement.style.width = `${newWidthSW}px`;
                    this.selectedElement.style.height = `${deltaY}px`;
                    break;
                case 'ne':
                    const newHeightNE = elementRect.bottom - e.clientY;
                    this.selectedElement.style.top = `${e.clientY - rect.top}px`;
                    this.selectedElement.style.width = `${deltaX}px`;
                    this.selectedElement.style.height = `${newHeightNE}px`;
                    break;
                case 'nw':
                    const newWidthNW = elementRect.right - e.clientX;
                    const newHeightNW = elementRect.bottom - e.clientY;
                    this.selectedElement.style.left = `${e.clientX - rect.left}px`;
                    this.selectedElement.style.top = `${e.clientY - rect.top}px`;
                    this.selectedElement.style.width = `${newWidthNW}px`;
                    this.selectedElement.style.height = `${newHeightNW}px`;
                    break;
            }

            // Enforce minimum size
            const minSize = 50;
            if (parseInt(this.selectedElement.style.width) < minSize) {
                this.selectedElement.style.width = `${minSize}px`;
            }
            if (parseInt(this.selectedElement.style.height) < minSize) {
                this.selectedElement.style.height = `${minSize}px`;
            }
        }
    }

    initToolbarDrag() {
        const toolbar = document.querySelector('.toolbar');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        toolbar.addEventListener('mousedown', (e) => {
            if (e.target.tagName.toLowerCase() !== 'button' && 
                e.target.tagName.toLowerCase() !== 'select' &&
                e.target.tagName.toLowerCase() !== 'input') {
                isDragging = true;
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                toolbar.style.cursor = 'grabbing';
                toolbar.style.transition = 'none';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;

                toolbar.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                toolbar.style.cursor = 'grab';
                toolbar.style.transition = 'all 0.3s ease';
            }
        });
    }

    initPanelToggles() {
        // Add mobile toggle buttons to the header
        const header = document.querySelector('.top-header');
        const toggleButtons = document.createElement('div');
        toggleButtons.className = 'panel-toggles';
        toggleButtons.innerHTML = `
            <button class="toggle-slides"><i class="fas fa-images"></i></button>
            <button class="toggle-properties"><i class="fas fa-sliders-h"></i></button>
        `;
        header.appendChild(toggleButtons);

        // Handle toggle clicks
        const slidesPanel = document.querySelector('.slides-panel');
        const propertiesPanel = document.querySelector('.properties-panel');

        toggleButtons.querySelector('.toggle-slides').addEventListener('click', () => {
            slidesPanel.classList.toggle('active');
            propertiesPanel.classList.remove('active');
        });

        toggleButtons.querySelector('.toggle-properties').addEventListener('click', () => {
            propertiesPanel.classList.toggle('active');
            slidesPanel.classList.remove('active');
        });

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.slides-panel') && 
                !e.target.closest('.properties-panel') && 
                !e.target.closest('.panel-toggles')) {
                slidesPanel.classList.remove('active');
                propertiesPanel.classList.remove('active');
            }
        });
    }

    initRulers() {
        const editorArea = document.querySelector('.editor-area');
        
        // Create rulers
        this.rulerH = document.createElement('div');
        this.rulerV = document.createElement('div');
        this.rulerH.className = 'ruler-h';
        this.rulerV.className = 'ruler-v';
        
        editorArea.appendChild(this.rulerH);
        editorArea.appendChild(this.rulerV);
        
        this.updateRulers();
        
        // Add ruler toggle to toolbar
        const toolbarGroup = document.querySelector('.toolbar-group:last-child');
        const rulerToggle = document.createElement('button');
        rulerToggle.innerHTML = '<i class="fas fa-ruler-combined"></i>';
        rulerToggle.title = 'Toggle Rulers';
        rulerToggle.onclick = () => this.toggleRulers();
        toolbarGroup.appendChild(rulerToggle);
    }

    updateRulers() {
        if (!this.showRulers) return;
        
        const canvas = this.currentSlide;
        const bounds = canvas.getBoundingClientRect();
        
        // Clear existing markers
        this.rulerH.innerHTML = '';
        this.rulerV.innerHTML = '';
        
        // Add markers every 50 pixels
        for (let x = 0; x < bounds.width; x += 50) {
            const marker = document.createElement('div');
            marker.className = 'ruler-marker';
            marker.style.left = `${x}px`;
            marker.textContent = x;
            
            const line = document.createElement('div');
            line.className = 'ruler-line';
            line.style.left = `${x}px`;
            
            this.rulerH.appendChild(marker);
            this.rulerH.appendChild(line);
        }
        
        for (let y = 0; y < bounds.height; y += 50) {
            const marker = document.createElement('div');
            marker.className = 'ruler-marker';
            marker.style.top = `${y}px`;
            marker.textContent = y;
            
            const line = document.createElement('div');
            line.className = 'ruler-line';
            line.style.top = `${y}px`;
            
            this.rulerV.appendChild(marker);
            this.rulerV.appendChild(line);
        }
    }

    toggleRulers() {
        this.showRulers = !this.showRulers;
        this.rulerH.style.display = this.showRulers ? 'block' : 'none';
        this.rulerV.style.display = this.showRulers ? 'block' : 'none';
        if (this.showRulers) this.updateRulers();
    }
}

// Initialize the presentation
window.addEventListener('DOMContentLoaded', () => {
    window.presentation = new Presentation();
});
