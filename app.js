/*
   ====================================================
   Avatar 2 Digital Layout App JS
   ====================================================
*/

// Application State
let plotData = [];
let activeFacingFilters = new Set();
let activeStatusFilters = new Set();

// Pan & Zoom state
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

// Coordinate Mapper State
let isMapperMode = false;
let activeMapperPlot = 1;

// Admin Mode state
let isAdminLoggedIn = sessionStorage.getItem('isAdminLoggedIn') === 'true';

// DOM Cache
const mapViewport = document.getElementById('mapViewport');
const mapContainer = document.getElementById('mapContainer');
const mapImage = document.getElementById('mapImage');
const plotsOverlay = document.getElementById('plotsOverlay');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const searchSuggestions = document.getElementById('searchSuggestions');
const facingFilterGrid = document.getElementById('facingFilterGrid');
const statusLegendList = document.getElementById('statusLegendList');
const plotModal = document.getElementById('plotModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalBody = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const mapTip = document.getElementById('mapTip');

// Sidebar responsive controls
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

// Statistics DOM
const statTotalPlots = document.getElementById('statTotalPlots');
const statAvailablePlots = document.getElementById('statAvailablePlots');
const statBookedPlots = document.getElementById('statBookedPlots');

// Mapper DOM
const mapperSection = document.getElementById('mapperSection');
const toggleMapperBtn = document.getElementById('toggleMapperBtn');
const mapperPanel = document.getElementById('mapperPanel');
const mapperActivePlot = document.getElementById('mapperActivePlot');
const mapperPlotList = document.getElementById('mapperPlotList');
const mapperExportBtn = document.getElementById('mapperExportBtn');

// Admin Login DOM
const loginModalBackdrop = document.getElementById('loginModalBackdrop');
const loginModalCloseBtn = document.getElementById('loginModalCloseBtn');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const sidebarFooter = document.getElementById('sidebarFooter');

// Setup Application
window.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupMapControls();
    setupSearch();
    setupFilters();
    setupMobileSidebar();
    setupMapper();
    setupAdmin();
});

// Initialization
function initApp() {
    // Check local storage for custom database updates
    const localData = localStorage.getItem('aspire_avatar2_data');
    if (localData) {
        try {
            plotData = JSON.parse(localData);
            renderPlotDots();
            updateStatistics();
            setTimeout(fitMapToViewport, 100);
            setupAdminState();
            return;
        } catch (e) {
            console.error('Error parsing local storage database', e);
        }
    }

    // Load standard data from data.json or fallback
    fetch('data.json')
        .then(res => {
            if (!res.ok) throw new Error('Data fetch failed');
            return res.json();
        })
        .then(data => {
            plotData = data;
            renderPlotDots();
            updateStatistics();
            setTimeout(fitMapToViewport, 100);
            setupAdminState();
        })
        .catch(err => {
            console.warn('Network issue. Falling back to data.js:', err);
            if (typeof plotDataRaw !== 'undefined') {
                plotData = plotDataRaw;
            } else {
                console.error('Offline dataset not found.');
            }
            renderPlotDots();
            updateStatistics();
            setTimeout(fitMapToViewport, 100);
            setupAdminState();
        });
}

// ----------------------------------------------------
// Rendering Functions
// ----------------------------------------------------

function getStatusColor(status) {
    const s = String(status).toUpperCase().trim();
    if (s === 'AVAILABLE') return 'var(--status-available)';
    if (s === 'SOLD' || s === 'BOOKED' || s === 'CLUB HOUSE') return 'var(--status-sold)';
    if (s === 'HOLD') return 'var(--status-hold)';
    if (s === 'MORTGAGE') return 'var(--status-mortgage)';
    return '#6b7280'; // gray default
}

function renderPlotDots() {
    plotsOverlay.innerHTML = '';
    
    Object.keys(plotCoordinates).forEach(plotNo => {
        const coords = plotCoordinates[plotNo];
        const detail = plotData.find(p => String(p.plot_no) === String(plotNo));
        const status = detail ? detail.plot_status : 'AVAILABLE';
        
        const dot = document.createElement('button');
        dot.className = 'plot-dot';
        dot.id = `plot-dot-${plotNo}`;
        dot.dataset.plotNo = plotNo;
        dot.dataset.facing = detail && detail.facing ? detail.facing : 'Unknown';
        dot.dataset.status = status;
        
        dot.style.setProperty('--plot-color', getStatusColor(status));
        
        // Mapped coordinates at exactly 1024x646 display size
        dot.style.left = `${coords.left - 7.5}px`;
        dot.style.top = `${coords.top - 7.5}px`;
        
        dot.textContent = plotNo;
        
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isMapperMode) return; // Disallow in mapper mode
            openPlotModal(plotNo);
        });
        
        plotsOverlay.appendChild(dot);
    });

    applyFilters();
}

// ----------------------------------------------------
// Map Control (Pan & Zoom) Functions
// ----------------------------------------------------

function setupMapControls() {
    mapViewport.addEventListener('mousedown', (e) => {
        // Disallow panning if clicking a dot or details modal
        if (e.target.closest('.plot-dot') || e.target.closest('#plotModal')) return;
        isPanning = true;
        mapViewport.style.cursor = 'grabbing';
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateMapTransform();
    });

    window.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            mapViewport.style.cursor = 'grab';
        }
    });

    // Zoom on wheel scroll
    mapViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        
        // Viewport center context coordinates
        const rect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate new scale
        const previousScale = zoomScale;
        if (e.deltaY < 0) {
            zoomScale = Math.min(zoomScale + zoomIntensity, 4.0);
        } else {
            zoomScale = Math.max(zoomScale - zoomIntensity, 0.4);
        }
        
        // Offset pan adjustment so mouse remains focal point
        panX -= (mouseX / previousScale) * (zoomScale - previousScale);
        panY -= (mouseY / previousScale) * (zoomScale - previousScale);
        
        updateMapTransform();
    }, { passive: false });

    // Touch support (mobile pan & pinch)
    let initialTouchDist = 0;
    mapViewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            if (e.target.closest('.plot-dot') || e.target.closest('#plotModal')) return;
            isPanning = true;
            startX = e.touches[0].clientX - panX;
            startY = e.touches[0].clientY - panY;
        } else if (e.touches.length === 2) {
            isPanning = false;
            initialTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    });

    mapViewport.addEventListener('touchmove', (e) => {
        if (isPanning && e.touches.length === 1) {
            panX = e.touches[0].clientX - startX;
            panY = e.touches[0].clientY - startY;
            updateMapTransform();
        } else if (e.touches.length === 2) {
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = currentDist / initialTouchDist;
            zoomScale = Math.max(0.4, Math.min(zoomScale * factor, 4.0));
            initialTouchDist = currentDist;
            updateMapTransform();
        }
    });

    mapViewport.addEventListener('touchend', () => {
        isPanning = false;
    });

    // Double click to reset viewport
    mapViewport.addEventListener('dblclick', (e) => {
        if (e.target.closest('.plot-dot') || e.target.closest('#plotModal')) return;
        fitMapToViewport();
    });

    // Hook floating map control buttons
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const recenterBtn = document.getElementById('recenterBtn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomScale = Math.min(zoomScale + 0.2, 4.0);
            updateMapTransform();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            zoomScale = Math.max(zoomScale - 0.2, 0.4);
            updateMapTransform();
        });
    }

    if (recenterBtn) {
        recenterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fitMapToViewport();
        });
    }
}

function updateMapTransform() {
    mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
}

function fitMapToViewport() {
    const vWidth = mapViewport.clientWidth;
    const vHeight = mapViewport.clientHeight;
    
    // Fit to exact display boundaries (1024x646)
    const scaleX = vWidth / 1024;
    const scaleY = vHeight / 646;
    
    zoomScale = Math.min(scaleX, scaleY, 1.0) * 0.92; // 8% padding
    
    // Centering calculations
    panX = (vWidth - 1024 * zoomScale) / 2;
    panY = (vHeight - 646 * zoomScale) / 2;
    
    updateMapTransform();
}

// ----------------------------------------------------
// Search Bar Implementation
// ----------------------------------------------------

function setupSearch() {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toUpperCase();
        if (query.length > 0) {
            searchClearBtn.style.display = 'block';
            showSearchSuggestions(query);
        } else {
            searchClearBtn.style.display = 'none';
            searchSuggestions.style.display = 'none';
        }
    });

    searchClearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchClearBtn.style.display = 'none';
        searchSuggestions.style.display = 'none';
        
        // Remove search highlights
        document.querySelectorAll('.plot-dot.highlighted').forEach(dot => {
            dot.classList.remove('highlighted');
        });
    });

    // Close suggestions dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchSuggestions.style.display = 'none';
        }
    });
}

function showSearchSuggestions(query) {
    searchSuggestions.innerHTML = '';
    
    // Filter plotDataRaw/coords mapped plots matching search
    const matches = Object.keys(plotCoordinates).filter(plotNo => {
        return String(plotNo).includes(query);
    }).sort((a, b) => parseInt(a) - parseInt(b));

    if (matches.length > 0) {
        matches.slice(0, 8).forEach(plotNo => {
            const detail = plotData.find(p => String(p.plot_no) === String(plotNo));
            const status = detail ? detail.plot_status : 'AVAILABLE';
            
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="suggestion-no">Plot #${plotNo}</span>
                <span class="suggestion-desc">${status} &bull; ${detail && detail.facing ? detail.facing : 'Unknown'}</span>
            `;
            
            div.addEventListener('click', () => {
                searchInput.value = plotNo;
                searchSuggestions.style.display = 'none';
                focusOnPlot(plotNo);
                openPlotModal(plotNo);
            });
            
            searchSuggestions.appendChild(div);
        });
        searchSuggestions.style.display = 'block';
    } else {
        searchSuggestions.style.display = 'none';
    }
}

function focusOnPlot(plotNo) {
    const coords = plotCoordinates[plotNo];
    if (!coords) return;
    
    document.querySelectorAll('.plot-dot.highlighted').forEach(dot => {
        dot.classList.remove('highlighted');
    });
    
    const dot = document.getElementById(`plot-dot-${plotNo}`);
    if (dot) dot.classList.add('highlighted');
    
    // Center viewport focusing on targets
    zoomScale = 1.0;
    const vWidth = mapViewport.clientWidth;
    const vHeight = mapViewport.clientHeight;
    
    panX = vWidth / 2 - coords.left * zoomScale;
    panY = vHeight / 2 - coords.top * zoomScale;
    
    updateMapTransform();
}

// ----------------------------------------------------
// Filter Panel Implementation
// ----------------------------------------------------

function setupFilters() {
    // 1. Facing Filters (Pills)
    facingFilterGrid.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const facing = pill.dataset.facing;
            if (activeFacingFilters.has(facing)) {
                activeFacingFilters.delete(facing);
                pill.classList.remove('active');
            } else {
                activeFacingFilters.add(facing);
                pill.classList.add('active');
            }
            applyFilters();
        });
    });

    document.getElementById('facingResetBtn').addEventListener('click', () => {
        activeFacingFilters.clear();
        facingFilterGrid.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
        applyFilters();
    });
}

function applyFilters() {
    document.querySelectorAll('.plot-dot').forEach(dot => {
        const plotNo = dot.dataset.plotNo;
        const facing = dot.dataset.facing;
        const status = dot.dataset.status;
        
        let show = true;
        
        // Apply Facing constraint
        if (activeFacingFilters.size > 0 && !activeFacingFilters.has(facing)) {
            show = false;
        }
        
        // Apply Status constraint
        if (activeStatusFilters.size > 0 && !activeStatusFilters.has(status)) {
            show = false;
        }
        
        if (show) {
            dot.classList.remove('filtered-out');
        } else {
            dot.classList.add('filtered-out');
        }
    });
}

// ----------------------------------------------------
// Details Modal Implementation
// ----------------------------------------------------

function openPlotModal(plotNo) {
    const item = plotData.find(p => String(p.plot_no) === String(plotNo)) || {
        plot_no: plotNo,
        plot_size: 'N/A',
        facing: 'N/A',
        plot_status: 'AVAILABLE',
        dim_north: 'N/A',
        dim_south: 'N/A',
        dim_east: 'N/A',
        dim_west: 'N/A',
        customer_name: 'N/A',
        reference_name: 'N/A'
    };
    
    const color = getStatusColor(item.plot_status);
    
    let editButtonHtml = '';
    if (isAdminLoggedIn) {
        editButtonHtml = `
            <button class="admin-login-btn" id="editPlotBtn" style="background: var(--accent); color: #fff; border: none; font-weight: 700; width: 100%; margin-top: 15px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; font-size: 14px;">
                <i class="fa-solid fa-pen-to-square"></i> Edit Plot Details
            </button>
        `;
    }
    
    modalBody.innerHTML = `
        <div class="detail-card">
            <div class="detail-row">
                <span class="detail-label">Plot Number</span>
                <span class="detail-val" style="font-size: 18px; font-weight: 700; color: var(--accent)"># ${item.plot_no}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="status-badge" style="--badge-color: ${color}; --badge-glow: ${color}">${item.plot_status}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Plot Area</span>
                <span class="detail-val">${item.plot_size ? item.plot_size + ' Sq. Yards' : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Facing Direction</span>
                <span class="detail-val">${item.facing || 'N/A'}</span>
            </div>
            <div class="detail-row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <span class="detail-label">Boundary Dimensions</span>
                <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; font-weight: 600; padding: 4px 6px; background: rgba(255,255,255,0.02); border-radius: 6px;">
                    <div>North: ${item.dim_north || 'N/A'}</div>
                    <div>South: ${item.dim_south || 'N/A'}</div>
                    <div>East: ${item.dim_east || 'N/A'}</div>
                    <div>West: ${item.dim_west || 'N/A'}</div>
                </div>
            </div>
            <div class="detail-row">
                <span class="detail-label">Customer Name</span>
                <span class="detail-val">${item.customer_name ? (isAdminLoggedIn ? item.customer_name : maskName(item.customer_name)) : 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Reference / Share</span>
                <span class="detail-val">${item.reference_name || 'N/A'}</span>
            </div>
        </div>
        ${editButtonHtml}
    `;
    
    if (isAdminLoggedIn) {
        const editBtn = document.getElementById('editPlotBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                openPlotEditForm(plotNo);
            });
        }
    }
    
    modalBackdrop.classList.add('show');
}

function maskName(name) {
    if (!name || name === 'N/A' || name === '') return 'N/A';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        const p = parts[0];
        if (p.length <= 3) return p;
        return p.slice(0, 2) + '*'.repeat(p.length - 3) + p.slice(-1);
    }
    return parts.map((p, idx) => {
        if (idx === 0) return p;
        return p[0] + '*';
    }).join(' ');
}

// Close listeners
modalCloseBtn.addEventListener('click', closePlotModal);
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closePlotModal();
});
mapViewport.addEventListener('click', (e) => {
    if (e.target === mapViewport || e.target === mapContainer || e.target === mapImage) {
        closePlotModal();
    }
});
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePlotModal();
});

function closePlotModal() {
    modalBackdrop.classList.remove('show');
}

// ----------------------------------------------------
// Statistics & Legends
// ----------------------------------------------------

function updateStatistics() {
    const totalCount = plotData.length;
    statTotalPlots.textContent = totalCount;
    
    let counts = { AVAILABLE: 0, SOLD: 0, HOLD: 0, MORTGAGE: 0 };
    plotData.forEach(p => {
        const s = String(p.plot_status).toUpperCase().trim();
        if (counts[s] !== undefined) {
            counts[s]++;
        } else if (s === 'BOOKED' || s === 'CLUB HOUSE' || s === 'REGISTERED') {
            counts.SOLD++;
        }
    });

    statAvailablePlots.textContent = counts.AVAILABLE;
    statBookedPlots.textContent = counts.SOLD;
    
    // Render Sidebar Legend items
    statusLegendList.innerHTML = `
        <div class="legend-item" id="legend-AVAILABLE" style="--legend-color: var(--status-available);">
            <div class="legend-label-group">
                <div class="legend-color-dot"></div>
                <span class="legend-name">Available</span>
            </div>
            <span class="legend-count">${counts.AVAILABLE}</span>
        </div>
        <div class="legend-item" id="legend-SOLD" style="--legend-color: var(--status-sold);">
            <div class="legend-label-group">
                <div class="legend-color-dot"></div>
                <span class="legend-name">Sold / Booked</span>
            </div>
            <span class="legend-count">${counts.SOLD}</span>
        </div>
        <div class="legend-item" id="legend-HOLD" style="--legend-color: var(--status-hold);">
            <div class="legend-label-group">
                <div class="legend-color-dot"></div>
                <span class="legend-name">Hold</span>
            </div>
            <span class="legend-count">${counts.HOLD}</span>
        </div>
        <div class="legend-item" id="legend-MORTGAGE" style="--legend-color: var(--status-mortgage);">
            <div class="legend-label-group">
                <div class="legend-color-dot"></div>
                <span class="legend-name">Mortgage</span>
            </div>
            <span class="legend-count">${counts.MORTGAGE}</span>
        </div>
    `;

    // Hook listeners for Legend selections
    Object.keys(counts).forEach(status => {
        const item = document.getElementById(`legend-${status}`);
        if (item) {
            item.addEventListener('click', () => {
                if (activeStatusFilters.has(status)) {
                    activeStatusFilters.delete(status);
                    item.classList.remove('active');
                } else {
                    activeStatusFilters.add(status);
                    item.classList.add('active');
                }
                applyFilters();
            });
        }
    });
}

// ----------------------------------------------------
// Coordinate Mapper (Admin Mode Only)
// ----------------------------------------------------

function setupMapper() {
    toggleMapperBtn.addEventListener('click', () => {
        isMapperMode = !isMapperMode;
        if (isMapperMode) {
            toggleMapperBtn.textContent = 'Stop';
            toggleMapperBtn.style.color = 'var(--status-mortgage)';
            mapperPanel.style.display = 'block';
            buildMapperPlotList();
            highlightActiveMapperButton();
            mapTip.innerHTML = `<i class="fa-solid fa-map-pin" style="color: var(--accent);"></i> Click on the Layout drawing to place Plot #${activeMapperPlot}`;
        } else {
            toggleMapperBtn.textContent = 'Start';
            toggleMapperBtn.style.color = 'var(--accent)';
            mapperPanel.style.display = 'none';
            mapTip.innerHTML = `<i class="fa-solid fa-hand-pointer"></i> Drag to Pan &bull; Scroll or Pinch to Zoom`;
        }
    });

    mapperActivePlot.addEventListener('input', () => {
        const val = parseInt(mapperActivePlot.value);
        if (val >= 1 && val <= 96) {
            activeMapperPlot = val;
            highlightActiveMapperButton();
            if (isMapperMode) {
                mapTip.innerHTML = `<i class="fa-solid fa-map-pin" style="color: var(--accent);"></i> Click on the Layout drawing to place Plot #${activeMapperPlot}`;
            }
        }
    });

    // Capture click on map container directly (1024x646 coordinates)
    mapContainer.addEventListener('click', (e) => {
        if (!isMapperMode) return;
        
        // Get absolute coordinates on the 1024x646 scale
        const rect = mapImage.getBoundingClientRect();
        const clickX = Math.round((e.clientX - rect.left) / zoomScale);
        const clickY = Math.round((e.clientY - rect.top) / zoomScale);
        
        // Save direct coordinates without scaling (fresh project!)
        plotCoordinates[activeMapperPlot] = {
            left: clickX,
            top: clickY
        };
        
        renderPlotDots();
        
        const activeBtn = document.getElementById(`mapper-btn-${activeMapperPlot}`);
        if (activeBtn) {
            activeBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            activeBtn.style.color = 'var(--status-available)';
            activeBtn.style.borderColor = 'var(--status-available)';
        }
        
        // Auto-advance up to plot 96
        if (activeMapperPlot < 96) {
            activeMapperPlot++;
            mapperActivePlot.value = activeMapperPlot;
            highlightActiveMapperButton();
            mapTip.innerHTML = `<i class="fa-solid fa-map-pin" style="color: var(--accent);"></i> Click on the Layout drawing to place Plot #${activeMapperPlot}`;
        }
    });

    mapperExportBtn.addEventListener('click', () => {
        const coordsStr = "const plotCoordinates = " + JSON.stringify(plotCoordinates, null, 4) + ";";
        
        // Create popup with exported code
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(5,7,10,0.85);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;';
        
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:16px;width:90%;max-width:550px;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.6);text-align:left;display:flex;flex-direction:column;gap:16px;';
        
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding-bottom:12px;">
                <span style="font-family:var(--font-heading);font-weight:700;font-size:16px;color:#fff;">Export coordinates config</span>
                <button id="closeExportPopup" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;">&times;</button>
            </div>
            <p style="font-size:12px;color:var(--text-secondary);line-height:1.4;">
                Copy all coordinates code below and replace the entire content inside <b>plot_coords.js</b> file.
            </p>
            <textarea readonly style="width:100%;height:250px;background:var(--bg-tertiary);border:1px solid var(--border-color);color:#a7f3d0;padding:12px;border-radius:8px;font-family:monospace;font-size:11px;outline:none;resize:none;">${coordsStr}</textarea>
            <button id="copyExportCode" class="admin-login-btn" style="background:var(--accent);color:#fff;border:none;font-weight:700;padding:12px;border-radius:8px;cursor:pointer;">
                <i class="fa-solid fa-copy"></i> Copy to Clipboard
            </button>
        `;
        
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        
        document.getElementById('closeExportPopup').addEventListener('click', () => overlay.remove());
        
        document.getElementById('copyExportCode').addEventListener('click', () => {
            navigator.clipboard.writeText(coordsStr).then(() => {
                alert('Copied to clipboard successfully!');
            });
        });
    });
}

function buildMapperPlotList() {
    mapperPlotList.innerHTML = '';
    for (let i = 1; i <= 96; i++) {
        const btn = document.createElement('button');
        btn.id = `mapper-btn-${i}`;
        btn.style.cssText = 'background:rgba(255,255,255,0.02);border:1px solid var(--border-color);color:var(--text-secondary);font-size:10px;font-weight:700;padding:6px 0;border-radius:4px;cursor:pointer;transition:all 0.15s;';
        btn.textContent = i;
        
        // Style green if already mapped
        if (plotCoordinates[i]) {
            btn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            btn.style.color = 'var(--status-available)';
            btn.style.borderColor = 'var(--status-available)';
        }
        
        btn.addEventListener('click', () => {
            activeMapperPlot = i;
            mapperActivePlot.value = i;
            highlightActiveMapperButton();
            mapTip.innerHTML = `<i class="fa-solid fa-map-pin" style="color: var(--accent);"></i> Click on the Layout drawing to place Plot #${activeMapperPlot}`;
        });
        
        mapperPlotList.appendChild(btn);
    }
}

function highlightActiveMapperButton() {
    for (let i = 1; i <= 96; i++) {
        const btn = document.getElementById(`mapper-btn-${i}`);
        if (btn) {
            if (i === activeMapperPlot) {
                btn.style.borderColor = 'var(--accent)';
                btn.style.boxShadow = '0 0 8px var(--accent-glow)';
                btn.style.color = '#fff';
            } else {
                btn.style.boxShadow = 'none';
                if (plotCoordinates[i]) {
                    btn.style.borderColor = 'var(--status-available)';
                    btn.style.color = 'var(--status-available)';
                } else {
                    btn.style.borderColor = 'var(--border-color)';
                    btn.style.color = 'var(--text-secondary)';
                }
            }
        }
    }
}

// ----------------------------------------------------
// Mobile responsive navigation
// ----------------------------------------------------

function setupMobileSidebar() {
    sidebarToggleBtn.addEventListener('click', () => {
        sidebar.classList.add('show');
    });
    sidebarCloseBtn.addEventListener('click', () => {
        sidebar.classList.remove('show');
    });
    sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 992) {
            if (e.target.closest('.suggestion-item') || e.target.closest('.filter-pill') || e.target.closest('.legend-item')) {
                sidebar.classList.remove('show');
            }
        }
    });
}

// ----------------------------------------------------
// Admin Mode Implementation
// ----------------------------------------------------

function setupAdmin() {
    const staffBtn = document.getElementById('staffLoginBtn');
    if (staffBtn) {
        staffBtn.addEventListener('click', () => {
            if (isAdminLoggedIn) return;
            loginModalBackdrop.classList.add('show');
            loginError.style.display = 'none';
            loginForm.reset();
        });
    }

    if (loginModalCloseBtn) {
        loginModalCloseBtn.addEventListener('click', () => {
            loginModalBackdrop.classList.remove('show');
        });
    }

    if (loginModalBackdrop) {
        loginModalBackdrop.addEventListener('click', (e) => {
            if (e.target === loginModalBackdrop) {
                loginModalBackdrop.classList.remove('show');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = loginUsername.value.trim();
            const password = loginPassword.value;

            if (username === 'admin' && password === 'admin') {
                isAdminLoggedIn = true;
                sessionStorage.setItem('isAdminLoggedIn', 'true');
                loginModalBackdrop.classList.remove('show');
                setupAdminState();
                renderPlotDots();
                alert('Welcome, Staff! Admin mode enabled. You can now edit plot details and place markers using Coordinate Mapper.');
            } else {
                loginError.style.display = 'block';
            }
        });
    }
}

function setupAdminState() {
    if (!sidebarFooter) return;

    if (isAdminLoggedIn) {
        if (mapperSection) mapperSection.style.display = 'block';

        sidebarFooter.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; padding: 0 4px;">
                <button class="admin-login-btn" id="exportDbBtn" style="background-color: var(--accent); color: #fff; border: none; font-weight: 700; cursor: pointer; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-size: 13px;">
                    <i class="fa-solid fa-download"></i> Export data.json
                </button>
                <button class="admin-login-btn" id="resetDbBtn" style="background-color: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-color); font-weight: 600; cursor: pointer; padding: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; font-size: 11px;">
                    <i class="fa-solid fa-rotate-left"></i> Reset to Default
                </button>
                <button class="admin-login-btn" id="logoutBtn" style="background-color: var(--status-mortgage); color: #fff; border: none; font-weight: 700; cursor: pointer; padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; font-size: 13px;">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> Admin Logout
                </button>
            </div>
        `;

        document.getElementById('exportDbBtn').addEventListener('click', () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plotData, null, 4));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "data.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        });

        document.getElementById('resetDbBtn').addEventListener('click', () => {
            if (confirm('Discard all local custom changes and reset the layout back to standard sheet data?')) {
                localStorage.removeItem('aspire_avatar2_data');
                window.location.reload();
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            isAdminLoggedIn = false;
            sessionStorage.removeItem('isAdminLoggedIn');
            alert('Admin mode disabled.');
            window.location.reload();
        });

        let banner = document.getElementById('adminBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'adminBanner';
            banner.style.cssText = 'background: linear-gradient(90deg, #b45309, #d97706); color: #fff; text-align: center; padding: 8px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; z-index: 1000; position: relative;';
            banner.innerHTML = `<i class="fa-solid fa-user-shield"></i> ADMINISTRATOR MODE ACTIVE &bull; Click any plot card to edit details, or use the Coordinate Mapper`;
            document.body.insertBefore(banner, document.body.firstChild);
        }
    } else {
        if (mapperSection) mapperSection.style.display = 'none';

        sidebarFooter.innerHTML = `
            <button class="admin-login-btn" id="staffLoginBtn" style="border: none; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-lock"></i> Staff Login
            </button>
        `;

        const banner = document.getElementById('adminBanner');
        if (banner) banner.remove();

        const staffBtn = document.getElementById('staffLoginBtn');
        if (staffBtn) {
            staffBtn.addEventListener('click', () => {
                loginModalBackdrop.classList.add('show');
                loginError.style.display = 'none';
                loginForm.reset();
            });
        }
    }
}

function openPlotEditForm(plotNo) {
    const item = plotData.find(p => String(p.plot_no) === String(plotNo)) || {
        plot_no: plotNo,
        plot_size: '',
        facing: 'East',
        plot_status: 'AVAILABLE',
        dim_north: '-',
        dim_south: '-',
        dim_east: '-',
        dim_west: '-',
        customer_name: '',
        reference_name: ''
    };

    modalBody.innerHTML = `
        <div class="edit-plot-form" style="display: flex; flex-direction: column; gap: 12px; text-align: left; max-height: 70vh; overflow-y: auto; padding-right: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
                <span style="font-weight: 700; color: var(--accent); font-size: 16px;"><i class="fa-solid fa-edit"></i> Edit Plot #${item.plot_no}</span>
                <button id="cancelEditBtn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-xmark"></i> Cancel
                </button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Plot Status</label>
                <select id="editStatus" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none; width: 100%;">
                    <option value="AVAILABLE" ${item.plot_status === 'AVAILABLE' ? 'selected' : ''}>AVAILABLE</option>
                    <option value="SOLD" ${item.plot_status === 'SOLD' ? 'selected' : ''}>SOLD</option>
                    <option value="MORTGAGE" ${item.plot_status === 'MORTGAGE' ? 'selected' : ''}>MORTGAGE</option>
                    <option value="HOLD" ${item.plot_status === 'HOLD' ? 'selected' : ''}>HOLD</option>
                </select>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Plot Size (Sq. Yards)</label>
                <input type="text" id="editSize" value="${item.plot_size || ''}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Facing Direction</label>
                <select id="editFacing" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none; width: 100%;">
                    <option value="East" ${item.facing === 'East' ? 'selected' : ''}>East</option>
                    <option value="West" ${item.facing === 'West' ? 'selected' : ''}>West</option>
                    <option value="North" ${item.facing === 'North' ? 'selected' : ''}>North</option>
                    <option value="South" ${item.facing === 'South' ? 'selected' : ''}>South</option>
                    <option value="North-East" ${item.facing === 'North-East' ? 'selected' : ''}>North-East</option>
                    <option value="North-West" ${item.facing === 'North-West' ? 'selected' : ''}>North-West</option>
                    <option value="South-East" ${item.facing === 'South-East' ? 'selected' : ''}>South-East</option>
                    <option value="South-West" ${item.facing === 'South-West' ? 'selected' : ''}>South-West</option>
                    <option value="East (Cross)" ${item.facing === 'East (Cross)' ? 'selected' : ''}>East (Cross)</option>
                    <option value="West (Cross)" ${item.facing === 'West (Cross)' ? 'selected' : ''}>West (Cross)</option>
                    <option value="North (Cross)" ${item.facing === 'North (Cross)' ? 'selected' : ''}>North (Cross)</option>
                </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">North Boundary</label>
                    <input type="text" id="editNorth" value="${item.dim_north || '-'}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">South Boundary</label>
                    <input type="text" id="editSouth" value="${item.dim_south || '-'}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">East Boundary</label>
                    <input type="text" id="editEast" value="${item.dim_east || '-'}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <label style="font-size: 11px; color: var(--text-secondary);">West Boundary</label>
                    <input type="text" id="editWest" value="${item.dim_west || '-'}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; outline: none;">
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Customer Name</label>
                <input type="text" id="editCustomer" value="${item.customer_name || ''}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none;" placeholder="Full name">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Reference / Share</label>
                <input type="text" id="editReference" value="${item.reference_name || ''}" style="background: var(--bg-tertiary); border: 1px solid var(--border-color); color: #fff; padding: 8px 10px; border-radius: 6px; font-size: 13px; outline: none;" placeholder="Developer / Land Owner">
            </div>
            
            <button id="savePlotEditBtn" class="admin-login-btn" style="background: var(--status-available); color: #fff; border: none; font-weight: 700; width: 100%; margin-top: 10px; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-save"></i> Save Changes
            </button>
        </div>
    `;

    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        openPlotModal(plotNo);
    });

    document.getElementById('savePlotEditBtn').addEventListener('click', () => {
        savePlotEdits(plotNo);
    });
}

function savePlotEdits(plotNo) {
    const editStatus = document.getElementById('editStatus').value;
    const editSize = document.getElementById('editSize').value.trim();
    const editFacing = document.getElementById('editFacing').value;
    const editNorth = document.getElementById('editNorth').value.trim();
    const editSouth = document.getElementById('editSouth').value.trim();
    const editEast = document.getElementById('editEast').value.trim();
    const editWest = document.getElementById('editWest').value.trim();
    const editCustomer = document.getElementById('editCustomer').value.trim();
    const editReference = document.getElementById('editReference').value.trim();

    let idx = plotData.findIndex(p => String(p.plot_no) === String(plotNo));

    const updatedPlot = {
        plot_no: String(plotNo),
        plot_size: editSize,
        facing: editFacing,
        plot_status: editStatus,
        dim_north: editNorth,
        dim_south: editSouth,
        dim_east: editEast,
        dim_west: editWest,
        customer_name: editCustomer,
        reference_name: editReference
    };

    if (idx !== -1) {
        plotData[idx] = updatedPlot;
    } else {
        plotData.push(updatedPlot);
    }

    localStorage.setItem('aspire_avatar2_data', JSON.stringify(plotData));

    renderPlotDots();
    updateStatistics();
    openPlotModal(plotNo);
}
