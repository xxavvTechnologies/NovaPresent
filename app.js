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
        this.folders = JSON.parse(localStorage.getItem('presentation_folders')) || {
            default: {
                name: 'All Presentations',
                presentations: []
            }
        };
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

    saveFolders() {
        localStorage.setItem('presentation_folders', JSON.stringify(this.folders));
    }

    createFolder(name) {
        const folderId = `folder_${Date.now()}`;
        this.folders[folderId] = {
            name,
            presentations: []
        };
        this.saveFolders();
        return folderId;
    }

    movePresentation(presentationId, targetFolderId) {
        // Remove from all folders
        Object.values(this.folders).forEach(folder => {
            folder.presentations = folder.presentations.filter(id => id !== presentationId);
        });
        
        // Add to target folder
        this.folders[targetFolderId].presentations.push(presentationId);
        this.saveFolders();
    }

    renameFolder(folderId, newName) {
        if (this.folders[folderId]) {
            this.folders[folderId].name = newName;
            this.saveFolders();
        }
    }

    deleteFolder(folderId) {
        if (folderId === 'default') return false;
        
        // Move presentations to default folder
        const presentations = this.folders[folderId].presentations;
        this.folders.default.presentations.push(...presentations);
        
        delete this.folders[folderId];
        this.saveFolders();
        return true;
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
        this.installedExtensions = new Set(JSON.parse(localStorage.getItem('installedExtensions') || '[]'));
        this.sidebarWidth = parseInt(localStorage.getItem('sidebarWidth')) || 300;
        this.activeExtension = null;
        this.currentPresentationId = localStorage.getItem('lastOpenedPresentation');
        this.hasUnsavedChanges = false;
        this.init();
        this.initToolbarDrag();
        this.initPanelToggles();
        this.setupGrid();
        this.initExtensions();

        // Add cleanup handler
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    init() {
        this.bindElements();
        this.bindEvents();
        
        // Show presentation manager first if no presentation is open
        if (!this.currentPresentationId) {
            this.togglePresentationManager();
        } else {
            const presentation = this.manager.loadPresentation(this.currentPresentationId);
            if (presentation) {
                this.loadPresentation(presentation.id);
            } else {
                this.togglePresentationManager();
            }
        }
        
        this.setupPresentationList();
        this.autoSave();
        this.initializeElementTools();
        this.initializeRichTextTools();
        this.initToolbarDrag();
        this.initPanelToggles();
        this.setupGrid();
        this.initExtensions();
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
            this.hasUnsavedChanges = false;
        } catch (error) {
            this.showMinimalSaveStatus('error');
            console.error('Save error:', error);
        }
    }

    showMinimalSaveStatus(status = 'success') {
        const now = Date.now();
        if (now - this.lastNotificationTime < this.notificationThrottle) {
            return;
        }
        
        let saveStatus = document.getElementById('saveStatus');
        if (!saveStatus) return;
        
        // Reset animation by removing and re-adding the element
        const parent = saveStatus.parentElement;
        const clone = saveStatus.cloneNode(true);
        parent.replaceChild(clone, saveStatus);
        saveStatus = clone;
        
        const statusIcon = status === 'success' ? 
            '<i class="fas fa-check"></i>' : 
            '<i class="fas fa-times"></i>';
        
        saveStatus.innerHTML = statusIcon;
        saveStatus.className = `save-status ${status}`;
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            saveStatus.style.opacity = '0';
        }, 2000);
        
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
        if (!slide) return;

        // Clean up old elements first
        Array.from(this.currentSlide.children).forEach(child => {
            if (child.classList.contains('slide-element')) {
                child.removeEventListener('mousedown', this.handleMouseDown);
                child.remove();
            }
        });

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

        // Add new content with proper cleanup
        if (slide.elements && Array.isArray(slide.elements)) {
            slide.elements.forEach(elementData => {
                try {
                    const element = new SlideElement(
                        elementData.type,
                        elementData.x,
                        elementData.y
                    );
                    Object.assign(element, elementData);
                    const elementNode = element.createElement();
                    
                    // Add proper event handling
                    elementNode.addEventListener('mousedown', (e) => this.handleMouseDown(e));
                    elementNode.addEventListener('dblclick', () => {
                        if (elementData.type === 'text') {
                            elementNode.focus();
                        }
                    });
                    
                    this.currentSlide.appendChild(elementNode);
                } catch (error) {
                    console.error('Failed to render element:', error);
                }
            });
        }

        // Re-render grid if enabled
        if (this.gridEnabled) {
            this.renderGrid();
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
        
        // Calculate and set available space CSS variables
        const updateAvailableSpace = () => {
            const { innerWidth, innerHeight } = window;
            document.documentElement.style.setProperty('--available-width', `${innerWidth}px`);
            document.documentElement.style.setProperty('--available-height', `${innerHeight}px`);
        };
        
        updateAvailableSpace();
        window.addEventListener('resize', updateAvailableSpace);
        
        // Initialize controls
        this.initPresentationControls();
        
        // Render first slide
        this.renderPresentationSlide();
        this.updateSlideCounter();
        
        // Store cleanup functions
        this.presentationCleanup = () => {
            window.removeEventListener('resize', updateAvailableSpace);
            document.removeEventListener('keydown', this.presentationKeyHandler);
            this.presentationContainer.removeEventListener('mousemove', this.handleMouseMove);
            clearTimeout(this.controlsTimeout);
        };
    }

    initPresentationControls() {
        const controls = this.presentationContainer.querySelector('.presentation-controls');
        
        // Button controls
        document.getElementById('prevSlide').onclick = () => this.previousSlide();
        document.getElementById('nextSlide').onclick = () => this.nextSlide();
        document.getElementById('exitPresentation').onclick = () => this.exitPresentation();
        
        // Auto-hide controls
        let controlsTimeout;
        const handleMouseMove = () => {
            controls.classList.remove('hidden');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => controls.classList.add('hidden'), 3000);
        };
        
        this.presentationContainer.addEventListener('mousemove', handleMouseMove);
        handleMouseMove();
        
        // Keyboard controls
        this.presentationKeyHandler = (e) => {
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
                case 'f':
                case 'F':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        };
        
        document.addEventListener('keydown', this.presentationKeyHandler);
    }

    renderPresentationSlide(direction = 'next') {
        const slide = this.slides[this.currentSlideIndex];
        if (!slide) return;

        // Create new slide with proper scaling
        const newSlide = document.createElement('div');
        newSlide.className = 'slide-content';
        newSlide.style.backgroundColor = slide.backgroundColor;

        // Calculate proper scale based on viewport
        const scale = Math.min(
            window.innerWidth / 1280,
            window.innerHeight / 720
        ) * 0.9;

        newSlide.style.transform = `scale(${scale})`;

        // Add transition classes
        newSlide.classList.add(`slide-enter-${direction}`);

        // Render slide elements with proper styling and positioning
        if (slide.elements && Array.isArray(slide.elements)) {
            slide.elements.forEach(elementData => {
                const element = document.createElement('div');
                element.className = `slide-element ${elementData.type}-element`;
                
                // Copy all styles and attributes
                Object.assign(element.style, {
                    position: 'absolute',
                    left: `${elementData.x}px`,
                    top: `${elementData.y}px`,
                    width: `${elementData.width}px`,
                    height: `${elementData.height}px`,
                    zIndex: elementData.zIndex,
                    transform: elementData.transform || '',
                    backgroundColor: elementData.type !== 'text' ? elementData.color : 'transparent',
                    opacity: elementData.type !== 'text' ? elementData.opacity / 100 : 1,
                    borderRadius: elementData.type === 'circle' ? '50%' : '',
                    border: elementData.border || '',
                    fontSize: elementData.fontSize || '',
                    fontFamily: elementData.fontFamily || '',
                    color: elementData.textColor || '',
                    fontWeight: elementData.fontWeight || '',
                    fontStyle: elementData.fontStyle || '',
                    textDecoration: elementData.textDecoration || '',
                    textAlign: elementData.textAlign || '',
                    lineHeight: elementData.lineHeight || ''
                });

                if (elementData.type === 'text') {
                    // Preserve text formatting
                    element.innerHTML = elementData.content || '';
                } else if (elementData.type === 'polygon' || elementData.type === 'freeform') {
                    // Handle SVG elements
                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.setAttribute('width', '100%');
                    svg.setAttribute('height', '100%');
                    
                    if (elementData.type === 'polygon') {
                        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                        polygon.setAttribute('points', elementData.points.join(' '));
                        polygon.setAttribute('fill', elementData.color);
                        polygon.setAttribute('opacity', elementData.opacity / 100);
                        svg.appendChild(polygon);
                    } else {
                        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                        path.setAttribute('d', elementData.pathData);
                        path.setAttribute('stroke', elementData.color);
                        path.setAttribute('stroke-width', '2');
                        path.setAttribute('fill', 'none');
                        path.setAttribute('opacity', elementData.opacity / 100);
                        svg.appendChild(path);
                    }
                    
                    element.appendChild(svg);
                }

                newSlide.appendChild(element);
            });
        }

        // Handle slide transition
        const currentSlide = this.presentationSlide.querySelector('.slide-content');
        if (currentSlide) {
            currentSlide.classList.add(`slide-exit-${direction}`);
            currentSlide.addEventListener('animationend', () => currentSlide.remove(), { once: true });
        }

        this.presentationSlide.appendChild(newSlide);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.presentationContainer.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
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
        // Get fresh data
        const presentations = this.manager.getAllPresentations();
        const organizer = document.createElement('div');
        organizer.className = 'presentation-organizer';

        // Create header with controls
        organizer.innerHTML = `
            <div class="organize-controls">
                <button class="primary-btn" id="newFolder">
                    <i class="fas fa-folder-plus"></i> New Folder
                </button>
                <div class="view-controls">
                    <select id="viewMode" class="secondary-btn">
                        <option value="all">All Presentations</option>
                        <option value="folders">By Folders</option>
                    </select>
                    <button id="refreshList" class="secondary-btn">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            <div id="presentationsContainer"></div>
        `;

        this.presentationsList.innerHTML = '';
        this.presentationsList.appendChild(organizer);

        const container = organizer.querySelector('#presentationsContainer');
        
        // Render all presentations first
        const allPresentationsSection = document.createElement('div');
        allPresentationsSection.className = 'presentations-section';
        
        Object.entries(presentations).forEach(([key, p]) => {
            const presentationElement = this.createPresentationElement(p);
            allPresentationsSection.appendChild(presentationElement);
        });
        
        container.appendChild(allPresentationsSection);

        // Then render folders
        Object.entries(this.manager.folders).forEach(([folderId, folder]) => {
            if (folderId !== 'default') {
                const folderElement = this.createFolderElement(folderId, folder, presentations);
                container.appendChild(folderElement);
            }
        });

        // Add event listeners
        document.getElementById('newFolder').addEventListener('click', () => {
            const name = prompt('Enter folder name:');
            if (name) {
                this.manager.createFolder(name);
                this.setupPresentationList(); // Refresh the list
            }
        });

        document.getElementById('viewMode').addEventListener('change', (e) => {
            const isFolder = e.target.value === 'folders';
            container.querySelectorAll('.presentations-section').forEach(section => {
                section.style.display = !isFolder ? 'block' : 'none';
            });
            container.querySelectorAll('.folder-section').forEach(folder => {
                folder.style.display = isFolder ? 'block' : 'none';
            });
        });

        document.getElementById('refreshList').addEventListener('click', () => {
            this.setupPresentationList();
        });
    }

    createPresentationElement(presentation) {
        const div = document.createElement('div');
        div.className = `presentation-item ${presentation.id === this.currentPresentationId ? 'active' : ''}`;
        div.dataset.id = presentation.id;
        
        div.innerHTML = `
            <div class="presentation-info">
                <div class="presentation-title">${presentation.title}</div>
                <div class="presentation-meta">
                    <span class="presentation-date">
                        <i class="far fa-clock"></i> 
                        ${new Date(presentation.lastModified).toLocaleDateString()}
                    </span>
                    <span class="presentation-slides">
                        <i class="far fa-file-powerpoint"></i> 
                        ${presentation.slides?.length || 0} slides
                    </span>
                </div>
            </div>
            <div class="presentation-actions">
                <select class="move-to-folder secondary-btn">
                    <option value="">Move to...</option>
                    ${Object.entries(this.manager.folders)
                        .map(([id, f]) => `<option value="${id}">${f.name}</option>`)
                        .join('')}
                </select>
                <button class="secondary-btn edit-btn" title="Rename">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="primary-btn open-btn" title="Open">
                    <i class="fas fa-folder-open"></i>
                </button>
                <button class="delete-btn" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Add event listeners
        div.querySelector('.open-btn').addEventListener('click', () => {
            this.loadAndClose(presentation.id);
        });

        div.querySelector('.edit-btn').addEventListener('click', () => {
            const titleElement = div.querySelector('.presentation-title');
            const currentTitle = titleElement.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentTitle;
            input.className = 'presentation-title-input';
            
            titleElement.replaceWith(input);
            input.focus();
            
            input.addEventListener('blur', () => {
                if (input.value && input.value !== currentTitle) {
                    presentation.title = input.value;
                    this.manager.savePresentation(presentation.id, presentation.title, presentation.slides);
                    titleElement.textContent = input.value;
                }
                input.replaceWith(titleElement);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                }
            });
        });

        div.querySelector('.delete-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this presentation?')) {
                this.deletePresentation(presentation.id);
            }
        });

        const moveSelect = div.querySelector('.move-to-folder');
        moveSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                this.manager.movePresentation(presentation.id, e.target.value);
                this.setupPresentationList();
            }
        });

        return div;
    }

    createFolderElement(folderId, folder, presentations) {
        const div = document.createElement('div');
        div.className = 'folder-section';
        div.dataset.folderId = folderId;
        
        div.innerHTML = `
            <div class="folder-header">
                <i class="fas fa-chevron-right folder-toggle"></i>
                <span class="folder-name">${folder.name}</span>
                <div class="folder-actions">
                    <button class="secondary-btn rename-folder">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="secondary-btn delete-folder">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="folder-content"></div>
        `;

        // Add folder presentations
        const content = div.querySelector('.folder-content');
        folder.presentations.forEach(id => {
            const presentation = presentations[`presentation_${id}`];
            if (presentation) {
                content.appendChild(this.createPresentationElement(presentation));
            }
        });

        // Add folder event listeners
        const header = div.querySelector('.folder-header');
        const toggle = div.querySelector('.folder-toggle');
        
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.folder-actions')) {
                content.classList.toggle('expanded');
                toggle.classList.toggle('expanded');
            }
        });

        div.querySelector('.rename-folder').addEventListener('click', () => {
            const nameSpan = div.querySelector('.folder-name');
            const newName = prompt('Enter new folder name:', folder.name);
            if (newName && newName !== folder.name) {
                this.manager.renameFolder(folderId, newName);
                nameSpan.textContent = newName;
            }
        });

        div.querySelector('.delete-folder').addEventListener('click', () => {
            if (confirm('Delete this folder? Presentations will be moved to All Presentations')) {
                this.manager.deleteFolder(folderId);
                this.setupPresentationList();
            }
        });

        return div;
    }

    loadAndClose(id) {
        this.loadPresentation(id);
        localStorage.setItem('lastOpenedPresentation', id);
        this.currentPresentationId = id;
        this.togglePresentationManager();
        this.setupPresentationList(); // Refresh list to show active state
    }

    deletePresentation(id) {
        if (confirm('Are you sure you want to delete this presentation?')) {
            this.manager.deletePresentation(id);
            if (this.currentPresentationId === id) {
                localStorage.removeItem('lastOpenedPresentation');
                this.currentPresentationId = null;
            }
            this.setupPresentationList();
            this.notifications.show('Presentation deleted', 'success');
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

        // Add alignment buttons event listeners
        const centerH = document.getElementById('centerHorizontally');
        const centerV = document.getElementById('centerVertically');
        
        if (centerH) {
            centerH.addEventListener('click', () => this.centerElementHorizontally());
        }
        if (centerV) {
            centerV.addEventListener('click', () => this.centerElementVertically());
        }

        // Add new shape tools
        document.getElementById('addPolygon').addEventListener('click', () => this.startDrawingPolygon());
        document.getElementById('addLine').addEventListener('click', () => this.startDrawingLine());
        document.getElementById('addArrow').addEventListener('click', () => this.startDrawingLine(true));
        document.getElementById('addFreeform').addEventListener('click', () => this.startFreeformDrawing());
        
        // Add import handler
        document.getElementById('importSlides').addEventListener('click', () => this.showImportModal());
        document.getElementById('slideUpload').addEventListener('change', (e) => this.handleSlideImport(e));
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

            // Apply grid snapping if enabled
            if (this.snapToGrid) {
                x = this.snapToGridValue(x);
                y = this.snapToGridValue(y);
            }

            // Constrain to slide boundaries
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
            this.handleElementOperation();
        }
        this.isDragging = false;
        this.isResizing = false;

        // Remove global event listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
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
            
            // Remove event listeners first
            this.selectedElement.removeEventListener('mousedown', this.handleMouseDown);
            
            const elementId = this.selectedElement.id.replace('element-', '');
            this.slides[this.currentSlideIndex].elements = 
                this.slides[this.currentSlideIndex].elements.filter(e => e.id !== parseInt(elementId));
            
            this.selectedElement.remove();
            this.deselectElement();
            this.handleElementOperation();
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
        localStorage.setItem('lastOpenedPresentation', id);
        this.currentPresentationId = id;
        this.togglePresentationManager();
        this.setupPresentationList(); // Refresh list to show active state
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
        const formatCommand = (command, value = null) => {
            if (this.selectedElement?.isContentEditable) {
                document.execCommand(command, false, value);
                this.updateElementData();
                this.handleElementOperation();
            }
        };

        tools.bold.onclick = () => formatCommand('bold');
        tools.italic.onclick = () => formatCommand('italic');
        tools.underline.onclick = () => formatCommand('underline');
        
        // Alignment
        tools.alignLeft.onclick = () => formatCommand('justifyLeft');
        tools.alignCenter.onclick = () => formatCommand('justifyCenter');
        tools.alignRight.onclick = () => formatCommand('justifyRight');
        
        // Lists
        tools.bulletList.onclick = () => formatCommand('insertUnorderedList');
        tools.numberedList.onclick = () => formatCommand('insertOrderedList');
        
        // Font controls
        tools.fontFamily.onchange = (e) => formatCommand('fontName', e.target.value);
        tools.fontSize.onchange = (e) => formatCommand('fontSize', e.target.value);
        tools.textColor.onchange = (e) => formatCommand('foreColor', e.target.value);

        // Grid controls
        tools.toggleGrid.onclick = () => this.toggleGrid();
        tools.gridSize.onchange = (e) => this.updateGridSize(e.target.value);
        tools.gridColor.onchange = (e) => this.updateGridColor(e.target.value);
        tools.snapToGrid.onchange = (e) => this.toggleSnapToGrid(e.target.checked);

        // Update toolbar state on selection
        document.addEventListener('selectionchange', () => this.updateToolbarState());
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
        let gridOverlay = this.currentSlide.querySelector('.grid-overlay');
        
        if (!gridOverlay) {
            gridOverlay = document.createElement('div');
            gridOverlay.className = 'grid-overlay';
            this.currentSlide.appendChild(gridOverlay);
        }

        if (this.gridEnabled) {
            const svg = `
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
                            <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" 
                                  fill="none" 
                                  stroke="${this.gridColor}" 
                                  stroke-width="1"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>`;
            gridOverlay.innerHTML = svg;
        } else {
            gridOverlay.innerHTML = '';
        }
    }

    snapToGridValue(value) {
        if (!this.snapToGrid) return value;
        return Math.round(value / this.gridSize) * this.gridSize;
    }

    updateElementPosition(element, x, y) {
        if (this.snapToGrid) {
            x = this.snapToGridValue(x);
            y = this.snapToGridValue(y);
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

    setupGrid() {
        // Add grid controls to properties panel
        const gridControls = this.getRequiredElement('gridControls');
        const toggleGrid = document.getElementById('toggleGrid');
        const snapToGrid = document.getElementById('snapToGrid');
        const gridSize = document.getElementById('gridSize');
        const gridColor = document.getElementById('gridColor');

        toggleGrid.addEventListener('click', () => this.toggleGrid());
        snapToGrid.addEventListener('change', (e) => this.toggleSnapToGrid(e.target.checked));
        gridSize.addEventListener('change', (e) => this.updateGridSize(parseInt(e.target.value)));
        gridColor.addEventListener('change', (e) => this.updateGridColor(e.target.value));
    }

    toggleSnapToGrid(enabled) {
        this.snapToGrid = enabled;
        if (enabled && this.selectedElement) {
            // Snap current element to grid
            const rect = this.selectedElement.getBoundingClientRect();
            const slideRect = this.currentSlide.getBoundingClientRect();
            const x = rect.left - slideRect.left;
            const y = rect.top - slideRect.top;
            this.updateElementPosition(this.selectedElement, x, y);
        }
    }

    updateGridSize(size) {
        this.gridSize = Math.max(5, Math.min(100, size));
        if (this.gridEnabled) {
            this.renderGrid();
        }
        if (this.snapToGrid && this.selectedElement) {
            // Re-snap element to new grid size
            const rect = this.selectedElement.getBoundingClientRect();
            const slideRect = this.currentSlide.getBoundingClientRect();
            const x = rect.left - slideRect.left;
            const y = rect.top - slideRect.top;
            this.updateElementPosition(this.selectedElement, x, y);
        }
    }

    updateGridColor(color) {
        this.gridColor = color;
        if (this.gridEnabled) {
            this.renderGrid();
        }
    }

    centerElementHorizontally() {
        if (!this.selectedElement) return;
        const slideRect = this.currentSlide.getBoundingClientRect();
        const elementRect = this.selectedElement.getBoundingClientRect();
        const x = (slideRect.width - elementRect.width) / 2;
        this.updateElementPosition(this.selectedElement, x, parseInt(this.selectedElement.style.top));
        this.updateElementData();
        this.save();
    }

    centerElementVertically() {
        if (!this.selectedElement) return;
        const slideRect = this.currentSlide.getBoundingClientRect();
        const elementRect = this.selectedElement.getBoundingClientRect();
        const y = (slideRect.height - elementRect.height) / 2;
        this.updateElementPosition(this.selectedElement, parseInt(this.selectedElement.style.left), y);
        this.updateElementData();
        this.save();
    }

    initExtensions() {
        // Extension store
        const addExtBtn = document.getElementById('addExtension');
        const extensionStore = document.getElementById('extensionStore');
        const closeStore = extensionStore.querySelector('.modal-close');
        const sidebar = document.querySelector('.extensions-sidebar');
        const resizeHandle = sidebar.querySelector('.resize-handle');
        
        // Resize functionality
        let isResizing = false;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'ew-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const mainContainer = document.querySelector('.main-container');
            const newWidth = Math.max(300, document.body.clientWidth - e.clientX);
            
            sidebar.style.width = `${newWidth}px`;
            mainContainer.style.gridTemplateColumns = `240px 1fr 240px ${newWidth}px`;
            this.sidebarWidth = newWidth;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                localStorage.setItem('sidebarWidth', this.sidebarWidth);
            }
        });

        // Store handlers
        addExtBtn.addEventListener('click', () => {
            extensionStore.classList.add('active');
        });
        
        closeStore.addEventListener('click', () => {
            extensionStore.classList.remove('active');
        });

        // Install handlers
        const installButtons = document.querySelectorAll('.install-btn');
        installButtons.forEach(btn => {
            const card = btn.closest('.extension-card');
            if (!card) return;
            
            const extId = card.dataset.extension;
            if (this.installedExtensions.has(extId)) {
                btn.textContent = 'Installed';
                btn.disabled = true;
            }

            btn.addEventListener('click', () => this.installExtension(extId, btn));
        });

        this.loadInstalledExtensions();

        // Add visibility check and reset
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.activeExtension) {
                const sidebar = document.querySelector('.extensions-sidebar');
                const iconBtn = document.querySelector(`.extension-icon-button[data-extension="${this.activeExtension}"]`);
                if (!sidebar.classList.contains('expanded') && iconBtn) {
                    this.toggleExtension(this.activeExtension, iconBtn);
                }
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            const sidebar = document.querySelector('.extensions-sidebar');
            if (sidebar.classList.contains('expanded')) {
                const mainContainer = document.querySelector('.main-container');
                mainContainer.classList.add('sidebar-expanded');
            }
        });
    }

    loadInstalledExtensions() {
        const extensionIcons = document.getElementById('extensionIcons');
        extensionIcons.innerHTML = '';

        this.installedExtensions.forEach(extId => {
            if (extId === 'novaGists') {
                const iconBtn = document.createElement('button');
                iconBtn.className = 'extension-icon-button';
                iconBtn.innerHTML = '<i class="fas fa-code"></i>';
                iconBtn.title = 'Nova Gists';
                
                iconBtn.addEventListener('click', () => this.toggleExtension(extId, iconBtn));
                extensionIcons.appendChild(iconBtn);
            }
        });
    }

    toggleExtension(extId, iconBtn) {
        const sidebar = document.querySelector('.extensions-sidebar');
        const extensionsList = document.getElementById('extensionsList');
        const mainContainer = document.querySelector('.main-container');
        
        // Toggle active state
        const isActive = iconBtn.classList.contains('active');
        
        // First clear all active states
        document.querySelectorAll('.extension-icon-button').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (isActive) {
            // Collapse sidebar
            sidebar.classList.remove('expanded');
            mainContainer.classList.remove('sidebar-expanded');
            this.activeExtension = null;
            
            // Clear content after transition
            setTimeout(() => {
                if (!sidebar.classList.contains('expanded')) {
                    extensionsList.innerHTML = '';
                }
            }, 300);
        } else {
            // Activate the clicked extension
            iconBtn.classList.add('active');
            sidebar.classList.add('expanded');
            mainContainer.classList.add('sidebar-expanded');
            this.activeExtension = extId;
            
            // Load extension content
            extensionsList.innerHTML = `
                <div class="extension-item">
                    <div class="extension-loading">
                        <i class="fas fa-spinner fa-spin"></i>
                        <div>Loading extension...</div>
                    </div>
                    <iframe class="extension-webview" src="https://gists.nova.xxavvgroup.com" frameborder="0"></iframe>
                </div>
            `;

            const webview = extensionsList.querySelector('.extension-webview');
            webview.addEventListener('load', () => {
                extensionsList.querySelector('.extension-loading')?.remove();
                webview.classList.add('loaded');
            });
        }
    }

    installExtension(extId, btn) {
        if (this.installedExtensions.has(extId)) return;
        
        this.installedExtensions.add(extId);
        localStorage.setItem('installedExtensions', JSON.stringify([...this.installedExtensions]));
        
        // Update button state
        btn.textContent = 'Installed';
        btn.disabled = true;
        
        // Update sidebar icons
        this.loadInstalledExtensions();
        
        // Hide store modal
        document.getElementById('extensionStore').classList.remove('active');
        
        this.notifications.show('Extension installed successfully', 'success');
    }

    removeExtension(extensionId) {
        this.installedExtensions.delete(extensionId);
        localStorage.setItem('installedExtensions', JSON.stringify([...this.installedExtensions]));
        
        // Update store button
        const storeBtn = document.querySelector(`.extension-card[data-extension="${extensionId}"] .install-btn`);
        if (storeBtn) {
            storeBtn.textContent = 'Install';
            storeBtn.disabled = false;
        }
        
        // Remove icon and collapse sidebar if it's active
        if (this.activeExtension === extensionId) {
            const sidebar = document.querySelector('.extensions-sidebar');
            const mainContainer = document.querySelector('.main-container');
            sidebar.classList.remove('expanded');
            mainContainer.classList.remove('sidebar-expanded');
            this.activeExtension = null;
        }
        
        this.loadInstalledExtensions();
        this.notifications.show('Extension removed', 'info');
    }

    startDrawingPolygon() {
        this.drawingMode = 'polygon';
        this.points = [];
        this.currentSlide.style.cursor = 'crosshair';
        
        const updatePreview = (e) => {
            const rect = this.currentSlide.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.points.length > 0) {
                const lastPoint = this.points[this.points.length - 1];
                if (this.previewLine) this.previewLine.remove();
                
                this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                this.previewLine.setAttribute('x1', lastPoint[0]);
                this.previewLine.setAttribute('y1', lastPoint[1]);
                this.previewLine.setAttribute('x2', x);
                this.previewLine.setAttribute('y2', y);
                this.previewLine.setAttribute('stroke', this.elementColor.value);
                this.previewLine.setAttribute('stroke-width', '2');
                this.previewLine.setAttribute('stroke-dasharray', '4');
                this.tempElement.appendChild(this.previewLine);
            }
        };
        
        const clickHandler = (e) => {
            const rect = this.currentSlide.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.points.length === 0) {
                this.points.push([x, y]);
                this.tempElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                this.tempElement.setAttribute('width', '100%');
                this.tempElement.setAttribute('height', '100%');
                this.tempElement.style.position = 'absolute';
                this.tempElement.style.left = '0';
                this.tempElement.style.top = '0';
                this.tempElement.classList.add('slide-element', 'polygon-element');
                this.currentSlide.appendChild(this.tempElement);
                
                this.currentSlide.addEventListener('mousemove', updatePreview);
            } else {
                this.points.push([x, y]);
                this.updatePolygonPath();
            }
        };
        
        this.currentSlide.addEventListener('click', clickHandler);
        
        // Double click to finish
        this.currentSlide.addEventListener('dblclick', () => {
            if (this.points.length >= 3) {
                this.currentSlide.removeEventListener('mousemove', updatePreview);
                this.currentSlide.removeEventListener('click', clickHandler);
                if (this.previewLine) this.previewLine.remove();
                this.finishPolygon();
            }
        }, { once: true });
    }

    updatePolygonPath() {
        if (!this.tempElement || this.points.length < 2) return;
        
        const polygon = this.tempElement.querySelector('polygon') || 
                       document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        
        polygon.setAttribute('points', this.points.map(p => p.join(',')).join(' '));
        polygon.setAttribute('fill', this.elementColor.value);
        polygon.setAttribute('opacity', this.elementOpacity.value / 100);
        
        if (!polygon.parentElement) {
            this.tempElement.appendChild(polygon);
        }
    }

    finishPolygon() {
        if (this.points.length < 3) {
            this.tempElement?.remove();
            return;
        }

        const element = {
            id: Date.now(),
            type: 'polygon',
            points: this.points,
            color: this.elementColor.value,
            opacity: parseInt(this.elementOpacity.value),
            x: Math.min(...this.points.map(p => p[0])),
            y: Math.min(...this.points.map(p => p[1])),
            width: Math.max(...this.points.map(p => p[0])) - Math.min(...this.points.map(p => p[0])),
            height: Math.max(...this.points.map(p => p[1])) - Math.min(...this.points.map(p => p[1])),
            zIndex: 1
        };

        if (!this.slides[this.currentSlideIndex].elements) {
            this.slides[this.currentSlideIndex].elements = [];
        }
        
        this.slides[this.currentSlideIndex].elements.push(element);
        this.save();
        
        this.points = [];
        this.currentSlide.style.cursor = 'default';
        this.notifications.show('Polygon created', 'success');
    }

    startFreeformDrawing() {
        this.drawingMode = 'freeform';
        this.points = [];
        this.currentSlide.style.cursor = 'crosshair';
        
        this.tempElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.tempElement.classList.add('slide-element', 'freeform-element');
        this.currentSlide.appendChild(this.tempElement);
        
        this.currentSlide.addEventListener('mousedown', this.startDrawing);
        this.currentSlide.addEventListener('mousemove', this.draw);
        this.currentSlide.addEventListener('mouseup', this.finishDrawing);
    }

    handleSlideImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        document.getElementById('uploadFileName').textContent = file.name;
        const progress = document.querySelector('.import-progress');
        progress.style.display = 'block';

        // Simulate conversion progress
        let percent = 0;
        const interval = setInterval(() => {
            percent += 5;
            document.querySelector('.progress').style.width = `${percent}%`;
            if (percent >= 100) {
                clearInterval(interval);
                this.finishImport();
            }
        }, 100);

        // Here you would typically send the file to your server
        // for processing or use a library to parse the PPTX
    }

    finishImport() {
        // Close import modal
        document.getElementById('importModal').style.display = 'none';
        
        // Show success notification
        this.notifications.show('Presentation imported successfully', 'success');
        
        // Reset upload form
        document.getElementById('slideUpload').value = '';
        document.getElementById('uploadFileName').textContent = 'No file chosen';
        document.querySelector('.import-progress').style.display = 'none';
        document.querySelector('.progress').style.width = '0%';
    }

    startDrawing = (e) => {
        if (this.drawingMode !== 'freeform') return;
        
        const rect = this.currentSlide.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDrawing = true;
        this.points = [[x, y]];
        
        // Create SVG path
        this.drawingPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.drawingPath.setAttribute('stroke', this.elementColor.value);
        this.drawingPath.setAttribute('stroke-width', '2');
        this.drawingPath.setAttribute('fill', 'none');
        this.drawingPath.setAttribute('opacity', this.elementOpacity.value / 100);
        this.tempElement.appendChild(this.drawingPath);
        
        // Initial path data
        const pathData = `M ${x} ${y}`;
        this.drawingPath.setAttribute('d', pathData);
    };

    draw = (e) => {
        if (!this.isDrawing) return;
        
        const rect = this.currentSlide.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.points.push([x, y]);
        
        // Update path data with smooth curve
        const pathData = this.getSmoothPathData(this.points);
        this.drawingPath.setAttribute('d', pathData);
    };

    finishDrawing = (e) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        if (this.points.length < 2) {
            this.tempElement?.remove();
            return;
        }

        // Create final element data
        const boundingBox = this.drawingPath.getBBox();
        const element = {
            id: Date.now(),
            type: 'freeform',
            pathData: this.drawingPath.getAttribute('d'),
            color: this.elementColor.value,
            opacity: parseInt(this.elementOpacity.value),
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
            zIndex: 1
        };

        // Add to slide elements
        if (!this.slides[this.currentSlideIndex].elements) {
            this.slides[this.currentSlideIndex].elements = [];
        }
        
        this.slides[this.currentSlideIndex].elements.push(element);
        this.save();
        
        // Reset drawing state
        this.points = [];
        this.currentSlide.style.cursor = 'default';
        this.drawingMode = null;
        
        // Remove event listeners
        this.currentSlide.removeEventListener('mousedown', this.startDrawing);
        this.currentSlide.removeEventListener('mousemove', this.draw);
        this.currentSlide.removeEventListener('mouseup', this.finishDrawing);
        
        this.notifications.show('Freeform shape created', 'success');
    };

    getSmoothPathData(points) {
        if (points.length < 2) return '';
        
        let pathData = `M ${points[0][0]} ${points[0][1]}`;
        
        // Use quadratic curves for smoother lines
        for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i][0] + points[i + 1][0]) / 2;
            const yc = (points[i][1] + points[i + 1][1]) / 2;
            pathData += ` Q ${points[i][0]} ${points[i][1]}, ${xc} ${yc}`;
        }
        
        // Add the last point
        const last = points[points.length - 1];
        pathData += ` L ${last[0]} ${last[1]}`;
        
        return pathData;
    }

    handleElementOperation() {
        this.hasUnsavedChanges = true;
        this.save();
    }

    // Add proper cleanup methods
    cleanup() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeydown);
        
        // Clean up elements
        if (this.selectedElement) {
            this.deselectElement();
        }

        // Clean up drawing mode
        if (this.drawingMode) {
            this.currentSlide.style.cursor = 'default';
            this.drawingMode = null;
        }

        // Save any pending changes
        if (this.hasUnsavedChanges) {
            this.save();
        }
    }
}

// Proper initialization and cleanup
window.addEventListener('DOMContentLoaded', () => {
    window.presentation = new Presentation();
});

window.addEventListener('beforeunload', () => {
    if (window.presentation) {
        window.presentation.cleanup();
    }
});
