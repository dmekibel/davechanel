// Main Application Logic
document.addEventListener('DOMContentLoaded', () => {
    // Desktop initialization will go here

    // Window management will go here

    // File system will go here
});

// Update clock
function updateClock() {
    const clock = document.querySelector('.clock');
    const now = new Date();
    clock.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Update clock every minute
setInterval(updateClock, 60000);
updateClock(); // Initial update
document.addEventListener('DOMContentLoaded', () => {
    // Initialize and display the clock in the system tray
    updateClock();
    setInterval(updateClock, 60000);
    document.querySelector('.clock').style.display = 'block';
});
