// State management
let currentFileParam = null;
let selectedBase64Image = null;
let webcamStream = null;

// DOM Elements
const currentPhoto = document.getElementById('currentPhoto');
const noPhotoPlaceholder = document.getElementById('noPhotoPlaceholder');
const photoSpinner = document.getElementById('photoSpinner');
const photoStatusBadge = document.getElementById('photoStatusBadge');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// Tabs & Panes
const tabUpload = document.getElementById('tabUpload');
const tabCamera = document.getElementById('tabCamera');
const uploadPane = document.getElementById('uploadPane');
const cameraPane = document.getElementById('cameraPane');

// Upload Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Camera Elements
const webcamVideo = document.getElementById('webcamVideo');
const photoCanvas = document.getElementById('photoCanvas');
const startCamBtn = document.getElementById('startCamBtn');
const captureBtn = document.getElementById('captureBtn');

// Preview Elements
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const cancelPreviewBtn = document.getElementById('cancelPreviewBtn');
const uploadBtn = document.getElementById('uploadBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const serverTypeSelect = document.getElementById('serverType');
const apiUrlInput = document.getElementById('apiUrl');
const gdriveHelp = document.getElementById('gdriveHelp');

// Safe localStorage wrappers to prevent crashes in restricted environments (e.g., ERP embedded webviews)
function safeGetItem(key, defaultValue) {
    try {
        return localStorage.getItem(key) || defaultValue;
    } catch (e) {
        console.warn("Storage access denied:", e);
        return defaultValue;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn("Storage write denied:", e);
    }
}

// Initialize configuration
const config = {
    serverType: safeGetItem('photo_serverType', 'local'),
    apiUrl: safeGetItem('photo_apiUrl', 'http://localhost:3000')
};

// ----------------------------------------------------
// Page Load Initialization
// ----------------------------------------------------
function initApp() {
    // 1. Setup initial settings form values
    serverTypeSelect.value = config.serverType;
    apiUrlInput.value = config.apiUrl;
    toggleGDriveHelp();

    // 2. Attach Event Listeners (Must do this first so buttons always work)
    setupEventListeners();

    // 3. Automatically start webcam since it is the default tab
    startWebcam();

    // 4. Read filename from URL query (support both 'file' and 'filename')
    const urlParams = new URLSearchParams(window.location.search);
    currentFileParam = urlParams.get('file') || urlParams.get('filename');
    
    if (!currentFileParam) {
        fileNameDisplay.textContent = 'Aguardando parâmetro (?file=nome.jpg)...';
        fileNameDisplay.style.borderColor = 'var(--danger)';
        updateStatusBadge('error', 'Sem Parâmetro');
        return;
    }

    // Clean up filename (make sure it ends with .jpg or similar)
    fileNameDisplay.textContent = currentFileParam;
    
    // 5. Load current image
    loadCurrentPhoto();
}

// Robust page initialization that runs even if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// ----------------------------------------------------
// Core Photo Loading Lógica
// ----------------------------------------------------
async function loadCurrentPhoto() {
    if (!currentFileParam) return;
    
    showSpinner(true);
    updateStatusBadge('warning', 'Carregando...');

    if (config.serverType === 'gdrive') {
        try {
            const baseUrl = config.apiUrl.replace(/\/$/, '');
            const checkUrl = `${baseUrl}?file=${encodeURIComponent(currentFileParam)}&t=${new Date().getTime()}`;
            
            const response = await fetch(checkUrl);
            if (!response.ok) {
                throw new Error('Falha na resposta do servidor');
            }
            
            const data = await response.json();
            if (data.exists && data.url) {
                currentPhoto.src = data.url;
                currentPhoto.classList.remove('placeholder');
                noPhotoPlaceholder.classList.add('hidden');
            } else {
                console.log("Foto não encontrada no Google Drive. Tentando buscar localmente...");
                await loadLocalPhotoFallback();
            }
        } catch (err) {
            console.warn("Erro ao buscar imagem no Google Drive. Tentando buscar localmente...", err);
            await loadLocalPhotoFallback();
        }
    } else {
        // Resolve direct URL to check/show photo for local server
        const checkUrl = getPhotoUrl(currentFileParam);
        
        // Force reload by adding a cache-busting timestamp
        const cacheBuster = `t=${new Date().getTime()}`;
        const urlWithBuster = checkUrl.includes('?') ? `${checkUrl}&${cacheBuster}` : `${checkUrl}?${cacheBuster}`;

        currentPhoto.src = urlWithBuster;
        currentPhoto.classList.remove('placeholder');
        noPhotoPlaceholder.classList.add('hidden');
    }
}

// Fired if image fails to load (e.g. 404 Not Found)
function handleImageError() {
    showSpinner(false);
    currentPhoto.classList.add('placeholder');
    noPhotoPlaceholder.classList.remove('hidden');
    updateStatusBadge('error', 'Sem Foto');
}

// Fired when image loads successfully
currentPhoto.addEventListener('load', () => {
    showSpinner(false);
    if (!currentPhoto.classList.contains('placeholder')) {
        updateStatusBadge('success', 'Salva');
    }
});

// Helper to determine base url
function getPhotoUrl(filename) {
    const baseUrl = config.apiUrl.replace(/\/$/, ''); // strip trailing slash
    if (config.serverType === 'gdrive') {
        return `${baseUrl}?file=${filename}`;
    } else {
        return `${baseUrl}/uploads/${filename}`;
    }
}

// Retorna dinamicamente a URL do servidor local
function getLocalServerUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return window.location.origin;
    }
    return 'http://localhost:3000';
}


// Tenta carregar a imagem a partir do servidor local como fallback
async function loadLocalPhotoFallback() {
    const localBaseUrl = getLocalServerUrl();
    const localPhotoUrl = `${localBaseUrl}/uploads/${currentFileParam}`;
    const cacheBuster = `t=${new Date().getTime()}`;
    const urlWithBuster = `${localPhotoUrl}?${cacheBuster}`;

    try {
        const checkRes = await fetch(urlWithBuster, { method: 'HEAD' });
        if (checkRes.ok) {
            currentPhoto.src = urlWithBuster;
            currentPhoto.classList.remove('placeholder');
            noPhotoPlaceholder.classList.add('hidden');
            updateStatusBadge('success', 'Salva Local');
        } else {
            handleImageError();
        }
    } catch (e) {
        console.error("Falha ao carregar foto local de fallback:", e);
        handleImageError();
    }
}

// ----------------------------------------------------
// UI State Helpers
// ----------------------------------------------------
function showSpinner(show) {
    if (show) {
        photoSpinner.classList.remove('hidden');
    } else {
        photoSpinner.classList.add('hidden');
    }
}

function updateStatusBadge(type, text) {
    photoStatusBadge.className = `status-badge ${type}`;
    photoStatusBadge.textContent = text;
}

function toggleGDriveHelp() {
    if (serverTypeSelect.value === 'gdrive') {
        gdriveHelp.style.display = 'block';
    } else {
        gdriveHelp.style.display = 'none';
    }
}

// ----------------------------------------------------
// Event Listeners Setup
// ----------------------------------------------------
function setupEventListeners() {
    // Settings modal triggers
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
    serverTypeSelect.addEventListener('change', toggleGDriveHelp);
    
    saveSettingsBtn.addEventListener('click', () => {
        config.serverType = serverTypeSelect.value;
        config.apiUrl = apiUrlInput.value.trim();
        
        safeSetItem('photo_serverType', config.serverType);
        safeSetItem('photo_apiUrl', config.apiUrl);
        
        settingsModal.classList.remove('active');
        loadCurrentPhoto();
    });

    // Tab Navigation
    tabUpload.addEventListener('click', () => switchTab('upload'));
    tabCamera.addEventListener('click', () => switchTab('camera'));

    // Drag & Drop
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFileSelect(file);
    });

    // Webcam Controls
    startCamBtn.addEventListener('click', startWebcam);
    captureBtn.addEventListener('click', capturePhoto);

    // Upload & Cancel Actions
    cancelPreviewBtn.addEventListener('click', resetPreview);
    uploadBtn.addEventListener('click', uploadPhoto);
}

// ----------------------------------------------------
// Tab Switcher
// ----------------------------------------------------
function switchTab(type) {
    if (type === 'upload') {
        tabUpload.classList.add('active');
        tabCamera.classList.remove('active');
        uploadPane.classList.add('active');
        cameraPane.classList.remove('active');
        stopWebcam();
    } else {
        tabUpload.classList.remove('active');
        tabCamera.classList.add('active');
        uploadPane.classList.remove('active');
        cameraPane.classList.add('active');
        startWebcam();
    }
}

// ----------------------------------------------------
// File Reading
// ----------------------------------------------------
function handleFileSelect(file) {
    if (!file) return;

    if (!file.type.match('image.*')) {
        alert('Por favor, selecione apenas arquivos de imagem (.png, .jpg, .jpeg)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        showPreview(e.target.result);
    };
    reader.readAsDataURL(file);
}

function showPreview(base64Data) {
    selectedBase64Image = base64Data;
    imagePreview.src = base64Data;
    previewContainer.classList.remove('hidden');
    
    // Auto-scroll to preview
    previewContainer.scrollIntoView({ behavior: 'smooth' });
}

function resetPreview() {
    selectedBase64Image = null;
    imagePreview.src = '';
    previewContainer.classList.add('hidden');
    fileInput.value = ''; // clear input
}

// ----------------------------------------------------
// Camera Functionality
// ----------------------------------------------------
async function startWebcam() {
    try {
        startCamBtn.disabled = true;
        startCamBtn.textContent = 'Iniciando...';
        
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 },
            audio: false
        });

        webcamVideo.srcObject = webcamStream;
        
        startCamBtn.classList.add('hidden');
        captureBtn.classList.remove('hidden');
        captureBtn.disabled = false;
        
    } catch (err) {
        console.error("Webcam Error: ", err);
        alert('Não foi possível acessar a câmera. Verifique se deu permissão.');
        startCamBtn.disabled = false;
        startCamBtn.textContent = 'Ativar Câmera';
    }
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    webcamVideo.srcObject = null;
    startCamBtn.classList.remove('hidden');
    startCamBtn.disabled = false;
    startCamBtn.textContent = 'Ativar Câmera';
    captureBtn.classList.add('hidden');
}

function capturePhoto() {
    if (!webcamStream) return;

    const width = webcamVideo.videoWidth;
    const height = webcamVideo.videoHeight;
    photoCanvas.width = width;
    photoCanvas.height = height;

    const context = photoCanvas.getContext('2d');
    
    // Mirror horizontally to match preview
    context.translate(width, 0);
    context.scale(-1, 1);
    
    context.drawImage(webcamVideo, 0, 0, width, height);

    // Reset transform
    context.setTransform(1, 0, 0, 1, 0, 0);

    const base64Data = photoCanvas.toDataURL('image/jpeg', 0.9);
    showPreview(base64Data);
    
    // Stop camera feed after capturing to save resources
    stopWebcam();
}

// ----------------------------------------------------
// Image Upload Lógica
// ----------------------------------------------------
async function uploadPhoto() {
    if (!currentFileParam || !selectedBase64Image) return;

    setUploadingState(true);
    updateStatusBadge('warning', 'Enviando...');

    const payload = {
        filename: currentFileParam,
        image: selectedBase64Image
    };

    let uploadSuccess = false;
    let driveError = null;

    // 1. Tenta enviar para o Google Drive se configurado
    if (config.serverType === 'gdrive') {
        const uploadUrl = config.apiUrl.replace(/\/$/, '');
        try {
            console.log("Tentando enviar foto para o Google Drive...");
            const response = await fetch(uploadUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Google Drive respondeu com status ${response.status}`);
            }

            const data = await response.json();
            if (data && data.success === false) {
                throw new Error(data.error || 'Erro interno no Google Apps Script');
            }

            resetPreview();
            loadCurrentPhoto();
            updateStatusBadge('success', 'Salva (Drive)');
            alert('Foto salva com sucesso no Google Drive!');
            uploadSuccess = true;
        } catch (err) {
            console.warn("Serviço do Google não encontrado ou falhou. Detalhes:", err);
            driveError = err;
            // Fallback para upload local
        }
    }

    // 2. Upload local (fluxo direto ou fallback após falha do Google Drive)
    if (!uploadSuccess) {
        const isFallback = (config.serverType === 'gdrive');
        if (isFallback) {
            console.log("Iniciando upload de fallback para o servidor local...");
        }

        const localUrl = getLocalServerUrl();

        try {
            const response = await fetch(localUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Servidor local respondeu com status ${response.status}`);
            }

            const data = await response.json();

            resetPreview();
            loadCurrentPhoto();

            if (isFallback) {
                updateStatusBadge('success', 'Salva Local');
                alert(`Serviço do Google Drive não encontrado/falhou. A imagem foi salva localmente na pasta 'uploads'.\n\nErro: ${driveError.message}`);
            } else {
                updateStatusBadge('success', 'Salva');
                alert('Foto salva com sucesso localmente!');
            }
            uploadSuccess = true;
        } catch (err) {
            console.error("Erro no upload local:", err);
            updateStatusBadge('error', 'Falha no Upload');
            if (isFallback) {
                alert(`Falha no upload para o Google Drive (${driveError.message}) e falha no fallback local: ${err.message}`);
            } else {
                alert(`Erro ao salvar foto localmente: ${err.message}`);
            }
        }
    }

    setUploadingState(false);
}

function setUploadingState(isUploading) {
    if (isUploading) {
        uploadBtn.disabled = true;
        btnText.textContent = 'Enviando...';
        btnSpinner.classList.remove('hidden');
        cancelPreviewBtn.style.pointerEvents = 'none';
        tabUpload.style.pointerEvents = 'none';
        tabCamera.style.pointerEvents = 'none';
    } else {
        uploadBtn.disabled = false;
        btnText.textContent = 'Salvar Foto no Servidor';
        btnSpinner.classList.add('hidden');
        cancelPreviewBtn.style.pointerEvents = 'auto';
        tabUpload.style.pointerEvents = 'auto';
        tabCamera.style.pointerEvents = 'auto';
    }
}
