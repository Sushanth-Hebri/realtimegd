let countdown = 30; // Initial countdown value
let countdownInterval; // Variable to store the countdown interval ID
let buttonDisabled = false; // Variable to track button state

function generateQRCode() {
    // Check if the button is disabled
    if (buttonDisabled) {
        return;
    }

    fetch('/generateQR')
        .then(response => response.json())
        .then(data => {
            const { qrCodeData, qrCodeImage } = data;
            displayQRCode(qrCodeData, qrCodeImage);
            startCountdown(); // Start the 30-second countdown
            disableButton(); // Disable the button
        })
        .catch(error => {
            console.error('Error fetching QR code:', error);
        });
}

function displayQRCode(qrCodeData, qrCodeImage) {
    const qrCodeSection = document.getElementById('qrCodeSection');
    const timerSection = document.getElementById('timerSection');
    
    // Clear previous QR code
    qrCodeSection.innerHTML = '';

    // Display the new QR code
    qrCodeSection.innerHTML = `<img src="${qrCodeImage}" alt="QR Code">`;

    // Reset the countdown to 30 seconds
    countdown = 30;

    // Display the initial countdown value
    timerSection.innerText = countdown;
}

function startCountdown() {
    const timerSection = document.getElementById('timerSection');

    // Update the countdown every second
    countdownInterval = setInterval(() => {
        countdown--;

        // Display the updated countdown value
        timerSection.innerText = countdown + 's';

        // Check if the countdown has reached 0
        if (countdown === 0) {
            clearInterval(countdownInterval); // Stop the countdown
            enableButton(); // Enable the button
        }
    }, 1000);
}

function disableButton() {
    const generateButton = document.querySelector('.generate-button');
    generateButton.disabled = true;
    buttonDisabled = true;
    generateButton.style.backgroundColor = 'gray'; // Set the disabled button color
    generateButton.style.cursor = 'not-allowed'; // Change cursor style
}

function enableButton() {
    const generateButton = document.querySelector('.generate-button');
    generateButton.disabled = false;
    buttonDisabled = false;
    generateButton.style.backgroundColor = 'blue'; // Set the original button color
    generateButton.style.cursor = 'pointer'; // Reset cursor style
}

// Initial QR code generation on page load
generateQRCode();
