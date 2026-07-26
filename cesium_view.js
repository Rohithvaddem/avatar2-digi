/*
   ====================================================
   Avatar 2 Digital Layout - 3D Satellite GIS Masterplan
   ====================================================
*/

let viewer = null;
let isCesiumActive = false;

// Project Site GIS Bounds (Karkalpahad Aspirealty Avatar 2 location: 16.92328 N, 78.53235 E)
const siteBounds = {
    west: 78.53100,
    south: 16.92050,
    east: 78.53380,
    north: 16.92620
};

// Suppress Cesium error popup panel globally
if (typeof Cesium !== 'undefined') {
    Cesium.showErrorPanel = function () {};
}

document.addEventListener('DOMContentLoaded', () => {
    setupCesiumControls();
});

function setupCesiumControls() {
    const toggleBtn = document.getElementById('toggleCesiumBtn');
    const cesiumContainer = document.getElementById('cesiumContainer');
    const mapContainer = document.getElementById('mapContainer');
    const mapTip = document.getElementById('mapTip');

    if (!toggleBtn || !cesiumContainer || !mapContainer) return;

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCesiumActive = !isCesiumActive;

        if (isCesiumActive) {
            toggleBtn.classList.add('active');
            toggleBtn.title = "View 2D Layout Mode";
            toggleBtn.innerHTML = '<i class="fa-solid fa-map"></i>';

            mapContainer.style.opacity = '0';
            mapContainer.style.pointerEvents = 'none';
            cesiumContainer.style.display = 'block';

            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-earth-americas"></i> Drag to Orbit &bull; Scroll to Zoom &bull; Click Plot to View Details';
            }

            if (!viewer) {
                initCesiumViewer();
            } else {
                viewer.resize();
            }

            // Force WebGL Canvas Viewport Resize after container display toggle
            setTimeout(() => {
                if (viewer) {
                    viewer.resize();
                    if (viewer.scene) {
                        viewer.scene.requestRender();
                    }
                }
            }, 100);
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.title = "View Cesium 3D Globe";
            toggleBtn.innerHTML = '<i class="fa-solid fa-earth-americas"></i>';

            cesiumContainer.style.display = 'none';
            mapContainer.style.opacity = '1';
            mapContainer.style.pointerEvents = 'auto';

            if (mapTip) {
                mapTip.innerHTML = '<i class="fa-solid fa-hand-pointer"></i> Drag to Pan &bull; Scroll or Pinch to Zoom';
            }
        }
    });
}

function initCesiumViewer() {
    if (typeof Cesium === 'undefined') {
        console.error('CesiumJS library not loaded.');
        return;
    }

    // Disable Cesium error panel
    Cesium.showErrorPanel = function () {};

    // Disable Cesium Ion token requirement
    Cesium.Ion.defaultAccessToken = '';

    // Initialize Cesium Viewer with open ESRI Satellite Imagery
    viewer = new Cesium.Viewer('cesiumContainer', {
        imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            credit: 'Esri World Imagery'
        }),
        animation: false,
        timeline: false,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: true,
        infoBox: false
    });

    // Ensure WebGL viewport resizes to full container dimensions
    viewer.resize();

    // Camera fly to site location (Karkalpahad Aspirealty Avatar 2 footprint)
    const centerLng = (siteBounds.west + siteBounds.east) / 2;
    const centerLat = (siteBounds.south + siteBounds.north) / 2;

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat - 0.0025, 550),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-45),
            roll: 0.0
        }
    });

    // Suppress render errors
    if (viewer.scene && viewer.scene.renderError) {
        viewer.scene.renderError.addEventListener((scene, error) => {
            console.warn('Cesium render event suppressed:', error);
        });
    }

    // ----------------------------------------------------
    // Layout Ground Overlay via CORS HTMLImageElement
    // ----------------------------------------------------
    const layoutRectangle = Cesium.Rectangle.fromDegrees(
        siteBounds.west,
        siteBounds.south,
        siteBounds.east,
        siteBounds.north
    );

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        if (!viewer) return;
        viewer.entities.add({
            name: "Avatar 2 Masterplan Overlay",
            rectangle: {
                coordinates: layoutRectangle,
                material: new Cesium.ImageMaterialProperty({
                    image: img,
                    transparent: true,
                    alpha: 0.95
                }),
                height: 0
            }
        });
    };
    img.onerror = function () {
        console.warn('Layout image failed to load via CORS image element.');
    };
    img.src = 'map_layout.jpg';

    // Generate Interactive 3D Plot Tiles
    generateCesiumPlots();

    // Click Selector Handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.plotNo) {
            const plotNo = pickedObject.id.plotNo;
            if (window.openPlotModal) {
                window.openPlotModal(plotNo);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

// ----------------------------------------------------
// Interactive 3D Plot Tiles & On-Ground Numbers
// ----------------------------------------------------

function getCesiumStatusColor(status) {
    const s = String(status).toUpperCase().trim();
    if (s === 'AVAILABLE') return { color: '#fffbe6', text: '#111827' }; // Cream Available
    if (s === 'SOLD' || s === 'BOOKED' || s === 'CLUB HOUSE') return { color: '#f59e0b', text: '#ffffff' }; // Gold Sold/Booked
    if (s === 'HOLD') return { color: '#eab308', text: '#111827' }; // Gold Hold
    if (s === 'MORTGAGE') return { color: '#f97316', text: '#ffffff' }; // Orange Mortgage
    return { color: '#fffbe6', text: '#111827' };
}

function generateCesiumPlots() {
    if (typeof plotCoordinates === 'undefined' || typeof plotData === 'undefined') return;

    Object.keys(plotCoordinates).forEach(plotNo => {
        const coords = plotCoordinates[plotNo];

        // Map (left, top) 1024x646 2D coordinates to geographic (lng, lat)
        const lng = siteBounds.west + (coords.left / 1024) * (siteBounds.east - siteBounds.west);
        const lat = siteBounds.north - (coords.top / 646) * (siteBounds.north - siteBounds.south);

        const plotDetail = plotData.find(p => String(p.plot_no) === String(plotNo));
        const status = plotDetail ? plotDetail.plot_status : 'AVAILABLE';
        const colorConfig = getCesiumStatusColor(status);

        // Extruded 3D vector tile for plot block
        const pWest = lng - 0.000075;
        const pEast = lng + 0.000075;
        const pSouth = lat - 0.000045;
        const pNorth = lat + 0.000045;

        const plotRectangle = Cesium.Rectangle.fromDegrees(pWest, pSouth, pEast, pNorth);

        const entity = viewer.entities.add({
            name: `Plot ${plotNo}`,
            rectangle: {
                coordinates: plotRectangle,
                material: Cesium.Color.fromCssColorString(colorConfig.color).withAlpha(0.85),
                outline: true,
                outlineColor: Cesium.Color.fromCssColorString('#1f2937'),
                height: 3,
                extrudedHeight: 4.5
            },
            label: {
                text: `${plotNo}`,
                font: 'bold 11px sans-serif',
                fillColor: Cesium.Color.fromCssColorString(colorConfig.text),
                outlineColor: colorConfig.text === '#ffffff' ? Cesium.Color.BLACK : Cesium.Color.TRANSPARENT,
                outlineWidth: 1.5,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
            }
        });

        entity.plotNo = plotNo;
    });
}
