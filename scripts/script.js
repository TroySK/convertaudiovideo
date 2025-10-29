let ffmpeg = null;
let isLoaded = false;

let isAudioToVideo = true;
let audioFile = null;
let imageFile = null;
let videoFile = null;

// DOM elements
const toggleBtn = document.getElementById('toggle-mode');
const inputLabel = document.getElementById('input-label');
const outputLabel = document.getElementById('output-label');
const leftLabel = document.getElementById('left-label');
const rightLabel = document.getElementById('right-label');
const audioDropZone = document.getElementById('audio-drop-zone');
const audioFileInput = document.getElementById('audio-file-input');
const imagePicker = document.getElementById('image-picker');
const imageDropZone = document.getElementById('image-drop-zone');
const imageFileInput = document.getElementById('image-file-input');
const convertBtn = document.getElementById('convert-btn');
const downloadBtn = document.getElementById('download-btn');
const outputArea = document.getElementById('output-area');

// Initialize FFmpeg
async function loadFFmpeg() {
    if (isLoaded) return;

    outputArea.innerHTML = '<p>Loading FFmpeg (~31 MB)... This may take a moment.</p>';

    try {
        ffmpeg = new FFmpegWASM.FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            console.log(message);
        });

        await ffmpeg.load({
            coreURL: await FFmpegUtil.toBlobURL('scripts/ffmpeg-core.js', 'text/javascript'),
            wasmURL: await FFmpegUtil.toBlobURL('scripts/ffmpeg-core.wasm', 'application/wasm'),
        });

        isLoaded = true;
        outputArea.innerHTML = '<p>FFmpeg loaded successfully! Ready to convert.</p>';
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        outputArea.innerHTML = '<p>Failed to load FFmpeg. Please refresh and try again.</p>';
    }
}

// Toggle mode
toggleBtn.addEventListener('click', () => {
    isAudioToVideo = !isAudioToVideo;
    updateUI();
});

function updateUI() {
    if (isAudioToVideo) {
        inputLabel.textContent = 'Audio File';
        outputLabel.textContent = 'Video Output';
        leftLabel.textContent = 'Audio';
        rightLabel.textContent = 'Video';
        imagePicker.style.display = 'block';
        audioFileInput.accept = 'audio/*';
    } else {
        inputLabel.textContent = 'Video File';
        outputLabel.textContent = 'Audio Output';
        leftLabel.textContent = 'Video';
        rightLabel.textContent = 'Audio';
        imagePicker.style.display = 'none';
        audioFileInput.accept = 'video/*';
    }
    // Reset files
    audioFile = null;
    imageFile = null;
    videoFile = null;
    outputArea.innerHTML = '<p>Converted file will appear here</p>';
    downloadBtn.style.display = 'none';
}

// Drag and drop functionality
function setupDropZone(dropZone, fileInput, callback) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            callback(files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            callback(e.target.files[0]);
        }
    });
}

setupDropZone(audioDropZone, audioFileInput, (file) => {
    if (isAudioToVideo) {
        audioFile = file;
        audioDropZone.querySelector('p').textContent = `Selected: ${file.name}`;
    } else {
        videoFile = file;
        audioDropZone.querySelector('p').textContent = `Selected: ${file.name}`;
    }
});

setupDropZone(imageDropZone, imageFileInput, (file) => {
    imageFile = file;
    imageDropZone.querySelector('p').textContent = `Selected: ${file.name}`;
});

// Convert button
convertBtn.addEventListener('click', async () => {
    if (!isLoaded) {
        await loadFFmpeg();
        return;
    }

    if (isAudioToVideo) {
        if (!audioFile || !imageFile) {
            alert('Please select both audio and image files');
            return;
        }
        await convertAudioToVideo();
    } else {
        if (!videoFile) {
            alert('Please select a video file. videoFile is: ' + videoFile);
            return;
        }
        await convertVideoToAudio();
    }
});

// Conversion functions
async function convertAudioToVideo() {
    try {
        outputArea.innerHTML = '<p>Converting...</p>';

        // Write files to FFmpeg FS
        await ffmpeg.writeFile('input.mp3', await FFmpegUtil.fetchFile(audioFile));
        await ffmpeg.writeFile('input.jpg', await FFmpegUtil.fetchFile(imageFile));

        // Run FFmpeg command
        await ffmpeg.exec(['-loop', '1', '-i', 'input.jpg', '-i', 'input.mp3', '-c:v', 'libx264', '-tune', 'stillimage', '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p', '-shortest', 'output.mp4']);

        // Read output file
        const data = await ffmpeg.readFile('output.mp4');

        // Create blob and display
        const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
        const videoUrl = URL.createObjectURL(videoBlob);

        outputArea.innerHTML = `
            <video controls style="max-width: 100%; max-height: 200px;">
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;

        // Setup download
        downloadBtn.style.display = 'block';
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = videoUrl;
            a.download = 'converted_video.mp4';
            a.click();
        };

    } catch (error) {
        console.error('Conversion failed:', error);
        outputArea.innerHTML = '<p>Conversion failed. Please try again.</p>';
    }
}

async function convertVideoToAudio() {
    try {
        outputArea.innerHTML = '<p>Converting...</p>';

        // Write file to FFmpeg FS
        await ffmpeg.writeFile('input.mp4', await FFmpegUtil.fetchFile(videoFile));

        // Run FFmpeg command
        await ffmpeg.exec(['-i', 'input.mp4', '-vn', '-acodec', 'mp3', '-ab', '192k', 'output.mp3']);

        // Read output file
        const data = await ffmpeg.readFile('output.mp3');

        // Create blob and display
        const audioBlob = new Blob([data.buffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);

        outputArea.innerHTML = `
            <audio controls style="width: 100%;">
                <source src="${audioUrl}" type="audio/mp3">
                Your browser does not support the audio tag.
            </audio>
        `;

        // Setup download
        downloadBtn.style.display = 'block';
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = 'extracted_audio.mp3';
            a.click();
        };

    } catch (error) {
        console.error('Conversion failed:', error);
        outputArea.innerHTML = '<p>Conversion failed. Please try again.</p>';
    }
}

// Initialize
updateUI();
