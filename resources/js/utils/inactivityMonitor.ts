/**
 * Inactivity Monitor
 * 
 * Monitors user activity (mouse movement, keyboard, clicks, navigation)
 * and automatically logs out the user after 30 minutes of inactivity.
 */

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIMEOUT = 28 * 60 * 1000; // Show warning at 28 minutes
const CHECK_INTERVAL = 60 * 1000; // Check every 1 minute

let lastActivityTime = Date.now();
let inactivityTimer: NodeJS.Timeout | null = null;
let warningTimer: NodeJS.Timeout | null = null;
let warningShown = false;

/**
 * Update the last activity timestamp
 */
function updateActivity() {
    lastActivityTime = Date.now();
    warningShown = false;
    
    // Reset timers
    resetTimers();
    startTimers();
}

/**
 * Reset all timers
 */
function resetTimers() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (warningTimer) {
        clearTimeout(warningTimer);
        warningTimer = null;
    }
}

/**
 * Start inactivity timers
 */
function startTimers() {
    // Warning timer (28 minutes)
    warningTimer = setTimeout(() => {
        if (!warningShown) {
            showInactivityWarning();
            warningShown = true;
        }
    }, WARNING_TIMEOUT);

    // Logout timer (30 minutes)
    inactivityTimer = setTimeout(() => {
        handleInactivityLogout();
    }, INACTIVITY_TIMEOUT);
}

/**
 * Show warning modal before logout
 */
function showInactivityWarning() {
    // Create warning modal
    const modal = document.createElement('div');
    modal.id = 'inactivity-warning-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div class="flex items-center mb-4">
                <svg class="w-8 h-8 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 class="text-lg font-semibold text-gray-900">Inactivity Warning</h3>
            </div>
            <p class="text-gray-600 mb-6">
                You have been inactive for 28 minutes. You will be automatically logged out in 2 minutes for security reasons.
            </p>
            <div class="flex justify-end space-x-3">
                <button id="inactivity-warning-continue" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
                    I'm Still Here
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // Add click handler to continue button
    const continueBtn = document.getElementById('inactivity-warning-continue');
    continueBtn?.addEventListener('click', () => {
        updateActivity();
        modal.remove();
    });
}

/**
 * Handle automatic logout due to inactivity
 */
async function handleInactivityLogout() {
    console.log('[Inactivity Monitor] 30 minutes of inactivity detected. Logging out...');

    try {
        // Call logout API
        const response = await fetch('/api/logout-inactive', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            },
            body: JSON.stringify({
                reason: 'inactivity',
                inactive_duration: INACTIVITY_TIMEOUT / 1000, // in seconds
            }),
        });

        if (response.ok) {
            // Show logout message
            showLogoutMessage();
            
            // Redirect to login page after 3 seconds
            setTimeout(() => {
                window.location.href = '/login';
            }, 3000);
        } else {
            console.error('[Inactivity Monitor] Failed to logout:', response.statusText);
            // Force redirect anyway
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('[Inactivity Monitor] Error during logout:', error);
        // Force redirect anyway
        window.location.href = '/login';
    }
}

/**
 * Show logout message overlay
 */
function showLogoutMessage() {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-90';
    overlay.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
            <svg class="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 class="text-xl font-bold text-gray-900 mb-2">Session Expired</h3>
            <p class="text-gray-600 mb-4">
                You have been logged out due to 30 minutes of inactivity.
            </p>
            <p class="text-sm text-gray-500">
                Redirecting to login page...
            </p>
        </div>
    `;
    document.body.appendChild(overlay);
}

/**
 * Initialize the inactivity monitor
 */
export function initializeInactivityMonitor() {
    console.log('[Inactivity Monitor] Initialized - 30 minute timeout');

    // Track user activity events
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(eventName => {
        document.addEventListener(eventName, updateActivity, { passive: true });
    });

    // Track Inertia navigation (page changes)
    document.addEventListener('inertia:navigate', updateActivity);

    // Start the timers
    startTimers();

    // Periodic check (backup mechanism)
    setInterval(() => {
        const inactiveTime = Date.now() - lastActivityTime;
        
        if (inactiveTime >= INACTIVITY_TIMEOUT) {
            console.log('[Inactivity Monitor] Periodic check detected inactivity');
            handleInactivityLogout();
        }
    }, CHECK_INTERVAL);
}

/**
 * Destroy the inactivity monitor (cleanup)
 */
export function destroyInactivityMonitor() {
    resetTimers();
    
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(eventName => {
        document.removeEventListener(eventName, updateActivity);
    });
    
    document.removeEventListener('inertia:navigate', updateActivity);
    
    console.log('[Inactivity Monitor] Destroyed');
}
