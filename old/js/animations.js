// Cloud Animation Configuration
const CLOUD_PATHS = [
    'assets/icons/Layer 2.png',  // 997x378
    'assets/icons/Layer 3.png',  // 1469x702
    'assets/icons/Layer 4.png'   // 964x452
];

function createCloud(container) {
    const cloudIndex = Math.floor(Math.random() * CLOUD_PATHS.length);
    const cloud = document.createElement('div');
    cloud.className = `cloud size-${cloudIndex + 1} ascending-cloud`;
    cloud.style.backgroundImage = `url('${CLOUD_PATHS[cloudIndex]}')`;
    
    // Random horizontal position, accounting for cloud width
    const cloudWidth = [997, 1469, 964][cloudIndex];
    const maxLeft = window.innerWidth - (cloudWidth * 0.5);
    cloud.style.left = Math.random() * maxLeft + 'px';
    
    container.appendChild(cloud);
    
    // Remove cloud after animation
    setTimeout(() => cloud.remove(), 4000);
}

// Entry Sequence Animation
document.addEventListener('DOMContentLoaded', () => {
    const enterButton = document.querySelector('.enter-button');
    
    enterButton.addEventListener('click', () => {
        // 1. Hide enter screen
        document.querySelector('.enter-screen').style.display = 'none';
        
        // 2. Show and animate gates
        const gatesContainer = document.querySelector('.gates-container');
        gatesContainer.style.display = 'block';
        
        setTimeout(() => {
            gatesContainer.classList.add('gates-open');
        }, 100);

        // 3. Start cloud sequence
        setTimeout(() => {
            gatesContainer.style.display = 'none';
            const cloudsContainer = document.querySelector('.clouds-container');
            cloudsContainer.style.display = 'block';
            
            // Create clouds at intervals
            const cloudInterval = setInterval(() => {
                createCloud(cloudsContainer);
            }, 500);

            // Stop creating clouds after 3 seconds
            setTimeout(() => {
                clearInterval(cloudInterval);
            }, 3000);

            // 4. Show desktop
            setTimeout(() => {
                cloudsContainer.style.display = 'none';
                document.querySelector('.desktop').style.display = 'block';
            }, 4000);
        }, 2500);
    });
});
